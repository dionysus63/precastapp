import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { generateDraftInvoicesBatchPdfBytes } from "@/lib/invoice-pdf-fill";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { withDatabaseRetry } from "@/lib/prisma";

/** Same bound as the draft batch: one day's billing stays far below this. */
const MAX_BATCH_INVOICES = 200;

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * One combined PDF of every finalized (SENT or PAID, never VOID) invoice
 * whose invoice date falls on the given day. The date is required — an
 * unbounded "all finals ever" batch has no printing use case.
 */
export async function GET(request: Request) {
  try {
    await requirePermission(AppPermission.INVOICES_VIEW);
    const url = new URL(request.url);
    const date = parseDateParam(url.searchParams.get("date"));

    if (!date) {
      return new NextResponse("A date (YYYY-MM-DD) is required.", {
        status: 400,
      });
    }
    const endOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999,
    );

    const invoices = await withDatabaseRetry((prisma) =>
      prisma.invoice.findMany({
        where: {
          status: { in: ["SENT", "PAID"] },
          invoiceDate: { gte: date, lte: endOfDay },
        },
        orderBy: { invoiceNumber: "asc" },
        include: INVOICE_PDF_INCLUDE,
        take: MAX_BATCH_INVOICES + 1,
      }),
    );

    if (invoices.length === 0) {
      return new NextResponse("No finalized invoices for that day.", {
        status: 404,
      });
    }

    if (invoices.length > MAX_BATCH_INVOICES) {
      return new NextResponse(
        `Too many invoices to print in one batch (over ${MAX_BATCH_INVOICES}).`,
        { status: 413 },
      );
    }

    const pdfBytes = await generateDraftInvoicesBatchPdfBytes(invoices);

    const dateSlug = url.searchParams.get("date")!.trim();
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoices-${dateSlug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate invoice batch PDF.";
    return new NextResponse(message, { status: 403 });
  }
}
