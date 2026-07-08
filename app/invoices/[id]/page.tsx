import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InvoiceDetailContent } from "@/components/invoices/invoice-detail-content";
import { getDefaultContactForRole } from "@/lib/customer-contacts";
import { mapDbInvoiceToDetailView } from "@/lib/invoice-mapper";
import { withDatabaseRetry } from "@/lib/prisma";
import { AppPermission } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;

  const invoice = await withDatabaseRetry((prisma) =>
    prisma.invoice.findUnique({
      where: { id },
      include: {
        deliveryTicket: { select: { id: true, ticketNumber: true } },
        lineItems: { orderBy: { lineNumber: "asc" } },
      },
    }),
  );

  if (!invoice) {
    notFound();
  }

  const view = mapDbInvoiceToDetailView(invoice);
  const user = await getCurrentUser();
  const canManage = user
    ? await hasPermission(user, AppPermission.INVOICES_MANAGE)
    : false;

  // Live lookup — invoices carry no contact snapshot; the billing default is
  // whoever handles AP for the customer today.
  const billingSnapshot = invoice.customerId
    ? await withDatabaseRetry((prisma) =>
        getDefaultContactForRole(prisma, invoice.customerId!, "BILLING"),
      )
    : null;
  const billingContact = billingSnapshot
    ? [billingSnapshot.contactName, billingSnapshot.contactEmail]
        .filter(Boolean)
        .join(" · ") || null
    : null;

  return (
    <DashboardShell title={view.title} subtitle={view.subtitle}>
      <InvoiceDetailContent
        invoice={view}
        ticketId={invoice.deliveryTicket.id}
        canManage={canManage}
        billingContact={billingContact}
      />
    </DashboardShell>
  );
}
