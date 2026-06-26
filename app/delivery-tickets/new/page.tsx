import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketEditor } from "@/components/delivery-tickets/delivery-ticket-editor";
import {
  listJobsWithQuotes,
} from "@/app/operations/actions";
import { listStockProductsForTicket } from "@/app/delivery-tickets/actions";
import { getAppSettings } from "@/lib/app-settings";

type NewDeliveryTicketPageProps = {
  searchParams: Promise<{ jobId?: string; fulfillment?: string; type?: string }>;
};

export default async function NewDeliveryTicketPage({
  searchParams,
}: NewDeliveryTicketPageProps) {
  const { jobId, fulfillment, type } = await searchParams;
  const [jobs, products, settings] = await Promise.all([
    listJobsWithQuotes(),
    listStockProductsForTicket(),
    getAppSettings(),
  ]);

  const defaultJobId = jobId && jobs.some((job) => job.id === jobId) ? jobId : undefined;
  const isPickup = fulfillment === "pickup";
  const isWalkIn = type === "walkin";

  const defaultValues =
    defaultJobId || isPickup || isWalkIn
      ? {
          ...(defaultJobId ? { jobId: defaultJobId } : {}),
          ...(isWalkIn ? { ticketType: "WALK_IN" as const } : {}),
          ...(isPickup || isWalkIn
            ? { fulfillmentMethod: "PICKUP" as const }
            : {}),
        }
      : undefined;

  const heading = isWalkIn
    ? "New Walk-In Ticket"
    : isPickup
      ? "New Pickup Ticket"
      : "New Delivery Ticket";
  const subtitle = isPickup || isWalkIn
    ? "Prepare a counter / pickup order ready for the front desk."
    : "Schedule and prepare products or structures for delivery.";

  return (
    <DashboardShell title={heading} subtitle={subtitle}>
      <Link
        href={isPickup || isWalkIn ? "/walk-ins" : "/delivery-tickets"}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        {isPickup || isWalkIn ? "← Back to Walk-Ins" : "← Back to Delivery Hub"}
      </Link>

      <div className="mt-4">
        <DeliveryTicketEditor
          mode="create"
          jobs={jobs}
          products={products}
          defaultValues={defaultValues}
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
