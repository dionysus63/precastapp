import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { buildDraftInvoiceCoverHtml } from "@/lib/draft-invoice-cover-html";
import { generateDraftInvoicesBatchPdfBytes } from "@/lib/invoice-pdf-fill";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { withDatabaseRetry } from "@/lib/prisma";
import { renderPdfBytesFromHtml } from "@/lib/quote-pdf";

/** The whole batch is loaded with full includes and rendered into one PDF in
 * memory, so an unbounded draft backlog could exhaust RAM. A day's billing is
 * far below this; ask the user to narrow by date instead of degrading. */
const MAX_BATCH_INVOICES = 200;

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    await requirePermission(AppPermission.INVOICES_VIEW);
    const url = new URL(request.url);
    const dateParam = parseDateParam(url.searchParams.get("date"));

    const invoices = await withDatabaseRetry((prisma) =>
      prisma.invoice.findMany({
        where: {
          status: "DRAFT",
          ...(dateParam
            ? {
                deliveryTicket: {
                  deliveryDate: {
                    gte: dateParam,
                    lte: new Date(
                      dateParam.getFullYear(),
                      dateParam.getMonth(),
                      dateParam.getDate(),
                      23,
                      59,
                      59,
                      999,
                    ),
                  },
                },
              }
            : {}),
        },
        orderBy: { invoiceNumber: "asc" },
        include: INVOICE_PDF_INCLUDE,
        take: MAX_BATCH_INVOICES + 1,
      }),
    );

    if (invoices.length === 0) {
      return new NextResponse("No draft invoices to print.", { status: 404 });
    }

    if (invoices.length > MAX_BATCH_INVOICES) {
      return new NextResponse(
        `Too many draft invoices to print in one batch (over ${MAX_BATCH_INVOICES}). Filter by delivery date and print smaller batches.`,
        { status: 413 },
      );
    }

    const coverHtml = await buildDraftInvoiceCoverHtml(invoices);
    const coverPdfBytes = await renderPdfBytesFromHtml(coverHtml);
    const pdfBytes = await generateDraftInvoicesBatchPdfBytes(
      invoices,
      coverPdfBytes,
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="draft-invoices.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate draft invoice batch PDF.";
    return new NextResponse(message, { status: 403 });
  }
}
