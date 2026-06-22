import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketsList } from "@/components/delivery-tickets/delivery-tickets-list";
import { listDeliveryTicketsForPage } from "@/app/delivery-tickets/actions";
import { mapDbDeliveryTicketToListRow } from "@/lib/delivery-ticket-mapper";

export default async function DeliveryTicketsPage() {
  const tickets = await listDeliveryTicketsForPage();
  const rows = tickets.map(mapDbDeliveryTicketToListRow);

  return (
    <DashboardShell
      title="Delivery Hub"
      subtitle="Dispatcher hub for scheduling, printing, and tracking deliveries."
    >
      <DeliveryTicketsList tickets={rows} />
    </DashboardShell>
  );
}
