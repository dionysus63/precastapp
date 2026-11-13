import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { fileRouteErrorResponse } from "@/lib/http-responses";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { generateInvoicePdfBytes } from "@/lib/invoice-pdf-fill";
import { withDatabaseRetry } from "@/lib/prisma";
import { renderPdfPageImage } from "@/lib/ticket-scan/reader";

type RouteContext = {
  params: Promise<{ id: string; page: string }>;
};

/**
 * One page of an invoice as a picture: the "Invoice" side of the Signed
 * Ticket / Invoice switch on Scan In. `X-Page-Count` says how many pages the
 * invoice has.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.INVOICES_VIEW);
    const { id, page: pageRaw } = await context.params;
    const pageNumber = Number(pageRaw);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return new NextResponse("Page not found.", { status: 404 });
    }

    const invoice = await withDatabaseRetry((prisma) =>
      prisma.invoice.findUnique({
        where: { id },
        include: INVOICE_PDF_INCLUDE,
      }),
    );
    if (!invoice) {
      return new NextResponse("Invoice not found.", { status: 404 });
    }

    const pdfBytes = await generateInvoicePdfBytes(invoice);
    const image = await renderPdfPageImage(pdfBytes, pageNumber);
    return new NextResponse(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(image.bytes.length),
        "X-Page-Count": String(image.pageCount),
        // An unpaid invoice can still be edited: always the current one.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Invoice picture");
  }
}
