import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InvoiceDraftEditor } from "@/components/invoices/invoice-draft-editor";
import { getDraftInvoiceEditorData } from "@/app/invoices/actions";
import { AppPermission } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDraftInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canManage = user
    ? await hasPermission(user, AppPermission.INVOICES_MANAGE)
    : false;

  if (!canManage) {
    redirect(`/invoices/${id}`);
  }

  const invoice = await getDraftInvoiceEditorData(id);
  if (!invoice) {
    notFound();
  }

  // Drafts and final unpaid invoices are editable; paid/void are immutable.
  if (invoice.status !== "DRAFT" && invoice.status !== "SENT") {
    redirect(`/invoices/${id}`);
  }
  const finalized = invoice.status === "SENT";

  return (
    <DashboardShell
      title={`Edit ${invoice.invoiceNumber}`}
      subtitle={
        finalized
          ? "This invoice is final — saved changes update it immediately."
          : "Adjust pricing, tax, and delivery before finalizing."
      }
    >
      <InvoiceDraftEditor
        finalized={finalized}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        ticketNumber={invoice.deliveryTicket.ticketNumber}
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
          taxable: line.taxable,
        }))}
      />
    </DashboardShell>
  );
}
