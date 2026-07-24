import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  ScheduleLoadsEditor,
  type ScheduleTicketRow,
} from "@/components/delivery-tickets/schedule-loads-editor";
import { SchedulePrintActions } from "@/components/delivery-tickets/schedule-print-actions";
import { getAppSettings } from "@/lib/app-settings";
import { loadJobDeliverySchedule } from "@/lib/delivery-schedule-data";
import { formatDateIso } from "@/lib/delivery-dispatch-utils";
import { deliveryTicketStatusVariant } from "@/lib/status-variants";
import { ticketNumberLabel } from "@/components/delivery-tickets/delivery-ticket-utils";
import { formatQuantity } from "@/lib/format";

import { BackButton } from "@/components/dashboard/back-button";
type ScheduleLoadsPageProps = {
  searchParams: Promise<{ jobId?: string }>;
};

const EDITABLE_STATUSES = new Set(["DRAFT", "SCHEDULED"]);

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
      <p>{message}</p>
      <BackButton href="/delivery-tickets" label="Back to Delivery Hub" />
    </div>
  );
}

export default async function ScheduleLoadsPage({
  searchParams,
}: ScheduleLoadsPageProps) {
  const { jobId } = await searchParams;

  if (!jobId) {
    return (
      <DashboardShell
        title="Schedule Loads"
        subtitle="Assign delivery dates, drivers, and trailers to a job's created loads."
      >
        <EmptyState message="Open this page from the Delivery Hub's unscheduled-loads panel or a job's Deliveries tab so it knows which job to schedule." />
      </DashboardShell>
    );
  }

  const [schedule, settings] = await Promise.all([
    loadJobDeliverySchedule(jobId),
    getAppSettings(),
  ]);

  if (!schedule) {
    return (
      <DashboardShell
        title="Schedule Loads"
        subtitle="Assign delivery dates, drivers, and trailers to a job's created loads."
      >
        <EmptyState message="Job not found." />
      </DashboardShell>
    );
  }

  const { job, tickets } = schedule;

  const rows: ScheduleTicketRow[] = tickets.map((ticket) => ({
    id: ticket.id,
    ticketNumber: ticketNumberLabel(ticket.ticketNumber),
    status: ticket.status,
    statusVariant: deliveryTicketStatusVariant(ticket.status),
    loadSequence: ticket.loadSequence,
    contents: ticket.lineItems
      .map((line) => `${formatQuantity(line.quantity)}× ${line.itemCode}`)
      .join(", "),
    totalItems: ticket.totalItems ?? ticket.lineItems.length,
    totalWeight: ticket.totalWeight != null ? Number(ticket.totalWeight) : null,
    deliveryDate: ticket.deliveryDate ? formatDateIso(ticket.deliveryDate) : "",
    deliveryTime: ticket.deliveryTime ?? "",
    trailer: ticket.trailer ?? "",
    driver: ticket.driver ?? "",
    editable: EDITABLE_STATUSES.has(ticket.status),
    expectedUpdatedAt: ticket.updatedAt.toISOString(),
  }));

  return (
    <DashboardShell
      title={`Schedule Loads — ${job.jobNumber}`}
      subtitle={`${job.projectName} · ${job.customerName}`}
    >
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
        <BackButton href="/delivery-tickets" label="Back to Delivery Hub" />
        <Link
          href={`/jobs/${job.id}?tab=deliveries`}
          className="text-slate-500 hover:text-slate-900"
        >
          Job deliveries
        </Link>
        <Link
          href={`/delivery-tickets/plan?jobId=${job.id}`}
          className="text-slate-500 hover:text-slate-900"
        >
          Plan more loads
        </Link>
        {rows.length > 0 ? <SchedulePrintActions jobId={job.id} /> : null}
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState message="This job has no delivery tickets yet. Plan loads first, then schedule them here." />
        ) : (
          <ScheduleLoadsEditor
            key={rows.map((row) => row.expectedUpdatedAt).join("|")}
            jobId={job.id}
            rows={rows}
            fleetOptions={{
              drivers: settings.drivers,
              trailers: settings.trailers,
            }}
          />
        )}
      </div>
    </DashboardShell>
  );
}
