import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketDetailContent } from "@/components/delivery-tickets/delivery-ticket-detail-content";
import { mapDbDeliveryTicketToDetailView } from "@/lib/delivery-ticket-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

type DeliveryTicketDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeliveryTicketDetailPage({
  params,
}: DeliveryTicketDetailPageProps) {
  const { id } = await params;

  const dbTicket = await withDatabaseRetry((prisma) =>
    prisma.deliveryTicket.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { lineNumber: "asc" } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    }),
  );

  if (!dbTicket) {
    notFound();
  }

  const ticket = mapDbDeliveryTicketToDetailView(dbTicket);
  if (dbTicket.invoice) {
    ticket.relatedRecords.invoice = dbTicket.invoice.invoiceNumber;
  }

  return (
    <DashboardShell title={ticket.title} subtitle={ticket.subtitle}>
      <DeliveryTicketDetailContent
        ticket={ticket}
        ticketId={dbTicket.id}
        ticketStatus={dbTicket.status}
        hasInvoice={Boolean(dbTicket.invoice)}
        invoiceId={dbTicket.invoice?.id ?? null}
        pickupInfo={{
          fulfillmentMethod: dbTicket.fulfillmentMethod,
          paymentMethod: dbTicket.paymentMethod,
          paymentReceived: dbTicket.paymentReceived,
          pickedUpBy: dbTicket.pickedUpBy,
        }}
      />
    </DashboardShell>
  );
}
