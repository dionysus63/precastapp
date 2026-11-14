import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  contentDisposition,
  fileRouteErrorResponse,
} from "@/lib/http-responses";
import {
  MAX_SELECTED_INVOICES,
  parseSelectedInvoiceIds,
  selectedInvoicesFileName,
} from "@/lib/invoice-list-search";
import { generateInvoicesBatchPdfBytes } from "@/lib/invoice-pdf-fill";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { withDatabaseRetry } from "@/lib/prisma";

/**
 * "Print selected" and "Download selected" on the Invoices list: the ticked
 * invoices as one PDF, in invoice number order, with no summary page.
 * `?ids=a,b,c` names them; `&download=1` saves the PDF as a file instead of
 * showing it.
 */
export async function GET(request: Request) {
  try {
    await requirePermission(AppPermission.INVOICES_VIEW);
    const url = new URL(request.url);
    const ids = parseSelectedInvoiceIds(url.searchParams.get("ids"));
    if (!ids) {
      return new NextResponse(
        `Pick between 1 and ${MAX_SELECTED_INVOICES} invoices.`,
        { status: 400 },
      );
    }

    const invoices = await withDatabaseRetry((prisma) =>
      prisma.invoice.findMany({
        where: { id: { in: ids } },
        orderBy: { invoiceNumber: "asc" },
        include: INVOICE_PDF_INCLUDE,
      }),
    );
    if (invoices.length === 0) {
      return new NextResponse("Those invoices were not found.", {
        status: 404,
      });
    }

    const pdfBytes = await generateInvoicesBatchPdfBytes(invoices);
    const fileName = selectedInvoicesFileName(
      invoices.map((invoice) => invoice.invoiceNumber),
    );
    const download = url.searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(
          download ? "attachment" : "inline",
          fileName,
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Selected invoices PDF");
  }
}
