import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketEditor } from "@/components/delivery-tickets/delivery-ticket-editor";
import { listJobsWithQuotes } from "@/app/operations/actions";
import { getAppSettings } from "@/lib/app-settings";

export default async function NewDeliveryTicketPage() {
  const [jobs, settings] = await Promise.all([
    listJobsWithQuotes(),
    getAppSettings(),
  ]);

  return (
    <DashboardShell
      title="New Delivery Ticket"
      subtitle="Schedule and prepare products or structures for delivery."
    >
      <Link
        href="/delivery-tickets"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Delivery Tickets
      </Link>

      <div className="mt-4">
        <DeliveryTicketEditor
          mode="create"
          jobs={jobs}
          fleetOptions={{
            trucks: settings.trucks,
            drivers: settings.drivers,
            trailers: settings.trailers,
            truckCapacityLabel: settings.truckCapacityLabel,
          }}
        />
      </div>
    </DashboardShell>
  );
}
