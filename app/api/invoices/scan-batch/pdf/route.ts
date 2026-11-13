import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { contentDisposition, fileRouteErrorResponse } from "@/lib/http-responses";
import { generateInvoicesBatchPdfBytes } from "@/lib/invoice-pdf-fill";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { UNPAID_INVOICE_STATUSES } from "@/lib/invoice-status";
import { buildInvoiceSummaryHtml } from "@/lib/invoice-summary-html";
import { withDatabaseRetry } from "@/lib/prisma";
import { renderPdfBytesFromHtml } from "@/lib/quote-pdf";
import { parseFiledScanResult } from "@/lib/ticket-scan/batch-state";
import { formatFiledMoment } from "@/lib/ticket-scan/service";

/**
 * "Print Invoices" on Scan In: one PDF with the Invoice Summary page on top,
 * then the invoice of every ticket filed by that scan, in the order the
 * signed tickets came off the stack, so each invoice lands on its ticket.
 * Void invoices are left out.
 */
export async function GET(request: Request) {
  try {
    await requirePermission(AppPermission.INVOICES_VIEW);
    const scanId = new URL(request.url).searchParams.get("scan")?.trim();
    if (!scanId) {
      return new NextResponse("Which scan? (?scan=)", { status: 400 });
    }

    const batch = await withDatabaseRetry((prisma) =>
      prisma.ticketScanBatch.findUnique({
        where: { id: scanId },
        select: {
          status: true,
          resultJson: true,
          filedAt: true,
          createdAt: true,
        },
      }),
    );
    if (!batch || batch.status !== "FILED") {
      return new NextResponse("That scan was not found.", { status: 404 });
    }

    const ticketIds = parseFiledScanResult(batch.resultJson).tickets.map(
      (ticket) => ticket.ticketId,
    );
    const found =
      ticketIds.length > 0
        ? await withDatabaseRetry((prisma) =>
            prisma.invoice.findMany({
              where: {
                deliveryTicketId: { in: ticketIds },
                status: { in: [...UNPAID_INVOICE_STATUSES, "PAID"] },
              },
              include: INVOICE_PDF_INCLUDE,
            }),
          )
        : [];
    // Paper stack order, not invoice number order.
    const byTicket = new Map(
      found.map((invoice) => [invoice.deliveryTicketId, invoice]),
    );
    const invoices = ticketIds
      .map((ticketId) => byTicket.get(ticketId))
      .filter((invoice): invoice is (typeof found)[number] => invoice != null);

    if (invoices.length === 0) {
      return new NextResponse("No ticket from that scan has an invoice.", {
        status: 404,
      });
    }

    const filedLabel = formatFiledMoment(batch.filedAt ?? batch.createdAt);
    const summaryHtml = buildInvoiceSummaryHtml(invoices, {
      heading: `Scan filed ${filedLabel}`,
      order: "same order as the paper stack",
    });
    const summaryPdfBytes = await renderPdfBytesFromHtml(summaryHtml);
    const pdfBytes = await generateInvoicesBatchPdfBytes(
      invoices,
      summaryPdfBytes,
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(
          "inline",
          `invoices-scan-${filedLabel.replace(/[^0-9A-Za-z]+/g, "-")}.pdf`,
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Scan invoices PDF");
  }
}
