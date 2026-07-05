import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { generateDraftInvoicesBatchPdfBytes } from "@/lib/invoice-pdf-fill";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { withDatabaseRetry } from "@/lib/prisma";

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
      }),
    );

    if (invoices.length === 0) {
      return new NextResponse("No draft invoices to print.", { status: 404 });
    }

    const pdfBytes = await generateDraftInvoicesBatchPdfBytes(invoices);

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
