"use server";

import { PDFDocument } from "pdf-lib";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/app-settings";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { generateInvoicePdfBytes } from "@/lib/invoice-pdf-fill";
import { PDF_SAVE_OPTIONS } from "@/lib/pdf-save-options";
import { printPdfBytesOnServer } from "@/lib/ticket-printing";
import { withDatabaseRetry } from "@/lib/prisma";

export type PrintInvoiceDirectResult =
  | { success: true; copies: number }
  | { success: false; error: string };

/**
 * Silent print of an invoice on the server's ticket printer, repeated to the
 * configured pay-now copy count in ONE print job. Used by the walk-in
 * counter flow; DELIVERY_MANAGE so the desk can run it without invoice
 * permissions (the invoice itself was auto-created by completing the sale).
 */
export async function printInvoiceDirect(
  invoiceId: string,
): Promise<PrintInvoiceDirectResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!invoiceId.trim()) {
    return { success: false, error: "Invoice id is required." };
  }

  try {
    const settings = await getAppSettings();
    const printer = settings.ticketPrinterName;
    if (!printer) {
      return {
        success: false,
        error:
          "No ticket printer is configured. Set one under Settings → Printing.",
      };
    }

    const invoice = await withDatabaseRetry((client) =>
      client.invoice.findUnique({
        where: { id: invoiceId },
        include: INVOICE_PDF_INCLUDE,
      }),
    );
    if (!invoice) {
      return { success: false, error: "Invoice not found." };
    }

    const copies = settings.invoicePrintCopies;
    const singleBytes = await generateInvoicePdfBytes(invoice);
    let printBytes = singleBytes;
    if (copies > 1) {
      const merged = await PDFDocument.create();
      const source = await PDFDocument.load(singleBytes);
      for (let copy = 0; copy < copies; copy += 1) {
        const pages = await merged.copyPages(source, source.getPageIndices());
        for (const page of pages) {
          merged.addPage(page);
        }
      }
      printBytes = await merged.save(PDF_SAVE_OPTIONS);
    }

    await printPdfBytesOnServer(printBytes, {
      printer,
      monochrome: settings.ticketPrintColorMode === "monochrome",
    });

    return { success: true, copies };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not print the invoice.",
    };
  }
}
