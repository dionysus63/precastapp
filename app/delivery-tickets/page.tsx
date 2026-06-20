import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketsList } from "@/components/delivery-tickets/delivery-tickets-list";
import { listDeliveryTicketsForPage } from "@/app/delivery-tickets/actions";
import {
  computeDeliveryTicketSummaryStats,
  mapDbDeliveryTicketToListRow,
} from "@/lib/delivery-ticket-mapper";

export default async function DeliveryTicketsPage() {
  const tickets = await listDeliveryTicketsForPage();
  const rows = tickets.map(mapDbDeliveryTicketToListRow);
  const summaryStats = computeDeliveryTicketSummaryStats(tickets);

  return (
    <DashboardShell
      title="Delivery Tickets"
      subtitle="Create, schedule, print, and track deliveries."
    >
      <DeliveryTicketsList tickets={rows} summaryStats={summaryStats} />
    </DashboardShell>
  );
}
