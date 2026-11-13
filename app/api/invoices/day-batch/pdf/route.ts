import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { parseLocalDay } from "@/lib/date-only";
import { contentDisposition, fileRouteErrorResponse } from "@/lib/http-responses";
import { generateInvoicesBatchPdfBytes } from "@/lib/invoice-pdf-fill";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { UNPAID_INVOICE_STATUSES } from "@/lib/invoice-status";
import { buildInvoiceSummaryHtml } from "@/lib/invoice-summary-html";
import { withDatabaseRetry } from "@/lib/prisma";
import { renderPdfBytesFromHtml } from "@/lib/quote-pdf";

/** The whole batch is loaded with full includes and rendered into one PDF in
 * memory. One day's billing stays far below this bound. */
const MAX_BATCH_INVOICES = 200;

function parseDateParam(value: string | null): Date | null {
  return value ? parseLocalDay(value) : null;
}

/**
 * "Print all for day": one PDF of every invoice made on the given day (open
 * or paid, never void), in invoice number order, behind the Invoice Summary
 * page the office types into QuickBooks from. The date is required — an
 * unbounded "every invoice ever" batch has no printing use case.
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
          status: { in: [...UNPAID_INVOICE_STATUSES, "PAID"] },
          invoiceDate: { gte: date, lte: endOfDay },
        },
        orderBy: { invoiceNumber: "asc" },
        include: INVOICE_PDF_INCLUDE,
        take: MAX_BATCH_INVOICES + 1,
      }),
    );

    if (invoices.length === 0) {
      return new NextResponse("No invoices were made on that day.", {
        status: 404,
      });
    }

    if (invoices.length > MAX_BATCH_INVOICES) {
      return new NextResponse(
        `Too many invoices to print in one batch (over ${MAX_BATCH_INVOICES}).`,
        { status: 413 },
      );
    }

    const summaryHtml = buildInvoiceSummaryHtml(invoices, {
      heading: `Invoices made ${date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })}`,
      order: "in invoice number order",
    });
    const summaryPdfBytes = await renderPdfBytesFromHtml(summaryHtml);
    const pdfBytes = await generateInvoicesBatchPdfBytes(
      invoices,
      summaryPdfBytes,
    );

    const dateSlug = url.searchParams.get("date")!.trim();
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition("inline", `invoices-${dateSlug}.pdf`),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Invoice batch PDF");
  }
}
