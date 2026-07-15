import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DispatcherWeekCalendar } from "@/components/delivery-tickets/dispatcher-week-calendar";
import { TodaysLoadsPanel } from "@/components/delivery-tickets/todays-loads-panel";
import { UnscheduledLoadsPanel } from "@/components/delivery-tickets/unscheduled-loads-panel";
import {
  deliveryTicketListSelect,
  mapDbDeliveryTicketToListRow,
} from "@/lib/delivery-ticket-mapper";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";

// The dispatcher calendar / today panel only need recent + upcoming tickets.
// Bounding by recency keeps these panels fast as historical tickets accumulate.
const SCHEDULE_LOOKBACK_DAYS = 56;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default async function DeliveryTicketsPage() {
  const scheduleCutoff = startOfToday();
  scheduleCutoff.setDate(scheduleCutoff.getDate() - SCHEDULE_LOOKBACK_DAYS);

  const [scheduleRecords, settings, draftRecords] = await withDatabaseRetry(
    (prisma) =>
      Promise.all([
        prisma.deliveryTicket.findMany({
          where: {
            deliveryDate: { gte: scheduleCutoff },
            ticketType: { not: "WALK_IN" },
          },
          orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
          select: deliveryTicketListSelect,
        }),
        getAppSettings(),
        // Job delivery loads awaiting scheduling (walk-ins and pickups are
        // dispatched elsewhere). DRAFT = unscheduled regardless of date.
        prisma.deliveryTicket.findMany({
          where: {
            status: "DRAFT",
            ticketType: "JOB",
            fulfillmentMethod: "DELIVERY",
            jobId: { not: null },
          },
          select: {
            jobId: true,
            jobNumber: true,
            projectName: true,
            customerName: true,
            totalWeight: true,
          },
        }),
      ]),
  );

  const scheduleRows = scheduleRecords.map(mapDbDeliveryTicketToListRow);
  const unscheduledDrafts = draftRecords
    .filter(
      (ticket): ticket is typeof ticket & { jobId: string } =>
        ticket.jobId !== null,
    )
    .map((ticket) => ({
      jobId: ticket.jobId,
      jobNumber: ticket.jobNumber ?? "—",
      projectName: ticket.projectName,
      customerName: ticket.customerName,
      totalWeight:
        ticket.totalWeight != null ? Number(ticket.totalWeight) : null,
    }));

  return (
    <DashboardShell
      title="Delivery Hub"
      subtitle="Dispatcher hub for scheduling, printing, and tracking deliveries."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/delivery-tickets/new"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            New Ticket
          </Link>
        </div>

        <DispatcherWeekCalendar tickets={scheduleRows} />
        <TodaysLoadsPanel
          tickets={scheduleRows}
          drivers={settings.drivers}
          trailers={settings.trailers}
        />
        <TodaysLoadsPanel
          tickets={scheduleRows}
          drivers={settings.drivers}
          trailers={settings.trailers}
          day="tomorrow"
        />
        <UnscheduledLoadsPanel drafts={unscheduledDrafts} />
      </div>
    </DashboardShell>
  );
}
