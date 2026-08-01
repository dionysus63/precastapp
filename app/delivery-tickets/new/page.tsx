import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketEditor } from "@/components/delivery-tickets/delivery-ticket-editor";
import {
  listJobsWithQuotes,
} from "@/app/operations/actions";
import { listStockProductsForTicket } from "@/app/delivery-tickets/actions";
import { getAppSettings } from "@/lib/app-settings";
import { loadPriceListOptionsForForms } from "@/lib/price-list-service";

type NewDeliveryTicketPageProps = {
  searchParams: Promise<{
    jobId?: string;
    fulfillment?: string;
    type?: string;
    from?: string;
  }>;
};

/** Pages that link here pass `from` so back/cancel/preview return to them. */
const TICKET_ORIGINS = {
  "walk-ins": { href: "/walk-ins", label: "Back to Walk-Ins" },
  hub: { href: "/delivery-tickets", label: "Back to Delivery Hub" },
  all: { href: "/delivery-tickets/all", label: "Back to All Tickets" },
  home: { href: "/", label: "Back to Dashboard" },
} as const;

export default async function NewDeliveryTicketPage({
  searchParams,
}: NewDeliveryTicketPageProps) {
  const { jobId, fulfillment, type, from } = await searchParams;
  const [jobs, products, settings, priceListOptions] = await Promise.all([
    listJobsWithQuotes(),
    listStockProductsForTicket(),
    getAppSettings(),
    loadPriceListOptionsForForms(),
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
      : "New Ticket";
  const subtitle = isPickup || isWalkIn
    ? "Prepare a counter / pickup order ready for the front desk."
    : "Schedule and prepare products or structures for delivery.";

  const originKey =
    from && from in TICKET_ORIGINS
      ? (from as keyof typeof TICKET_ORIGINS)
      : isPickup || isWalkIn
        ? "walk-ins"
        : "hub";
  const origin = TICKET_ORIGINS[originKey];

  return (
    <DashboardShell title={heading} subtitle={subtitle}>
      <div>
        <DeliveryTicketEditor
          backHref={origin.href}
          backLabel={origin.label}
          returnTo={{ key: originKey, href: origin.href }}
          mode="create"
          jobs={jobs}
          products={products}
          priceListOptions={priceListOptions}
          defaultValues={defaultValues}
          fleetOptions={{
            drivers: settings.drivers,
            trailers: settings.trailers,
            loadCapacityLabel: settings.truckCapacityLabel,
          }}
        />
      </div>
    </DashboardShell>
  );
}
