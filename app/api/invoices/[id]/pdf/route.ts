import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { generateInvoicePdfBytes } from "@/lib/invoice-pdf-fill";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.INVOICES_VIEW);
    const { id } = await context.params;

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

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate invoice PDF.";
    return new NextResponse(message, { status: 403 });
  }
}
