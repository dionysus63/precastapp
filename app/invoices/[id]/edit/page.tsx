import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { getInvoiceEditorData } from "@/app/invoices/actions";
import { AppPermission } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isUnpaidInvoiceStatus } from "@/lib/invoice-status";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canManage = user
    ? await hasPermission(user, AppPermission.INVOICES_MANAGE)
    : false;

  if (!canManage) {
    redirect(`/invoices/${id}`);
  }

  const invoice = await getInvoiceEditorData(id);
  if (!invoice) {
    notFound();
  }

  // An invoice stays editable until it is paid or voided.
  if (!isUnpaidInvoiceStatus(invoice.status)) {
    redirect(`/invoices/${id}`);
  }

  return (
    <DashboardShell
      title={`Edit ${invoice.invoiceNumber}`}
      subtitle="Fix a price, quantity or tax, then save. Changes update the invoice right away."
    >
      <InvoiceEditor
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        ticketNumber={invoice.deliveryTicket.ticketNumber ?? "—"}
        customerName={invoice.customerName}
        projectName={invoice.projectName}
        initialTaxRate={Number(invoice.taxRate)}
        initialDiscount={Number(invoice.discountAmount)}
        initialLines={invoice.lineItems.map((line) => ({
          id: line.id,
          lineNumber: line.lineNumber,
          lineType: line.lineType,
          itemCode: line.itemCode,
          description: line.description ?? "",
          quantity: Number(line.quantity),
          unit: line.unit,
          unitPrice: Number(line.unitPrice),
          needsPrice: line.needsPrice,
          taxable: line.taxable,
        }))}
      />
    </DashboardShell>
  );
}
