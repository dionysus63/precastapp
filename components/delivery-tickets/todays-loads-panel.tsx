import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  deliveryTicketStatusLabels,
  type DeliveryTicketRow,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import { getTodaysScheduledLoads } from "@/lib/delivery-dispatch-utils";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
type TodaysLoadsPanelProps = {
  tickets: DeliveryTicketRow[];
};

function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const [hours, minutes] = value.split(":");
  const hour = Number(hours);
  if (Number.isNaN(hour)) {
    return value;
  }
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes ?? "00"} ${suffix}`;
}

// Server component: purely presentational (links only, no event handlers),
// so it renders once on the server and ships no hydration JS.
export function TodaysLoadsPanel({ tickets }: TodaysLoadsPanelProps) {
  const todaysLoads = getTodaysScheduledLoads(tickets);

  return (
    <SectionCard
      title="Today's Loads"
      description={`${todaysLoads.length} scheduled load${todaysLoads.length === 1 ? "" : "s"} for today.`}
      noPadding
    >
      {todaysLoads.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No deliveries scheduled for today.
        </p>
      ) : (
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Ticket</th>
                <th className={tableHeaderCellClassName}>Job</th>
                <th className={tableHeaderCellClassName}>Project</th>
                <th className={tableHeaderCellClassName}>Time</th>
                <th className={tableHeaderCellClassName}>Truck</th>
                <th className={tableHeaderCellClassName}>Driver</th>
                <th className={tableHeaderCellClassName}>Weight</th>
                <th className={tableHeaderCellClassName}>Status</th>
                <th className={tableHeaderCellClassName}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {todaysLoads.map((ticket) => (
                <tr key={ticket.id} className={tableRowClassName}>
                  <td className={`${tableCellClassName} font-mono text-[11px] font-medium text-slate-900`}>
                    {ticket.ticketNumber}
                  </td>
                  <td className={`${tableCellClassName} font-mono text-[11px] text-slate-700`}>
                    {ticket.jobNumber}
                  </td>
                  <td className={`${tableCellClassName} font-medium text-slate-900`}>
                    {ticket.projectName}
                  </td>
                  <td className={`${tableCellClassName} text-slate-600`}>
                    {formatTime(ticket.deliveryTime)}
                  </td>
                  <td className={`${tableCellClassName} text-slate-600`}>{ticket.truck}</td>
                  <td className={`${tableCellClassName} text-slate-600`}>{ticket.driver}</td>
                  <td className={`${tableCellClassName} font-medium text-slate-900`}>
                    {ticket.totalWeight}
                  </td>
                  <td className={tableCellClassName}>
                    <StatusBadge
                      label={deliveryTicketStatusLabels[ticket.status]}
                      variant={ticket.statusVariant}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={`/delivery-tickets/${ticket.id}`}
                        className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                      <Link
                        href={`/delivery-tickets/${ticket.id}/preview`}
                        className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Print
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
