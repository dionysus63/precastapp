import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { DriverSelect, TrailerSelect } from "@/components/delivery-tickets/fleet-select";
import { StatusSelect } from "@/components/delivery-tickets/status-select";
import { type DeliveryTicketRow } from "@/components/delivery-tickets/delivery-ticket-utils";
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
  drivers: string[];
  trailers: string[];
  day?: "today" | "tomorrow";
};

// Server component shell; only the assignment dropdowns hydrate on the client.
export function TodaysLoadsPanel({
  tickets,
  drivers,
  trailers,
  day = "today",
}: TodaysLoadsPanelProps) {
  const reference = new Date();
  if (day === "tomorrow") {
    reference.setDate(reference.getDate() + 1);
  }
  const todaysLoads = getTodaysScheduledLoads(tickets, reference);
  const dayLabel = reference.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
  const titlePrefix = day === "today" ? "Today's Loads" : "Tomorrow's Loads";
  const deliveredCount = todaysLoads.filter(
    (ticket) => ticket.status === "DELIVERED",
  ).length;
  const openCount = todaysLoads.length - deliveredCount;

  return (
    <SectionCard
      title={`${titlePrefix} (${dayLabel})`}
      description={`${openCount} scheduled load${openCount === 1 ? "" : "s"} for ${day}${
        deliveredCount > 0 ? ` · ${deliveredCount} delivered` : ""
      }.`}
      noPadding
    >
      {todaysLoads.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No deliveries scheduled for {day}.
        </p>
      ) : (
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Ticket</th>
                <th className={tableHeaderCellClassName}>Job</th>
                <th className={tableHeaderCellClassName}>Customer</th>
                <th className={tableHeaderCellClassName}>Project</th>
                <th className={tableHeaderCellClassName}>Driver</th>
                <th className={tableHeaderCellClassName}>Trailer</th>
                <th className={tableHeaderCellClassName}>Weight</th>
                <th className={tableHeaderCellClassName}>Status</th>
                <th className={tableHeaderCellClassName}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {todaysLoads.map((ticket) => {
                const delivered = ticket.status === "DELIVERED";
                return (
                <tr
                  key={ticket.id}
                  className={`${tableRowClassName}${delivered ? " bg-emerald-50/40" : ""}`}
                >
                  <td className={`${tableCellClassName} font-mono text-[11px] font-medium text-slate-900`}>
                    {ticket.ticketNumber}
                  </td>
                  <td className={`${tableCellClassName} font-mono text-[11px] text-slate-700`}>
                    {ticket.jobNumber}
                  </td>
                  <td className={`${tableCellClassName} font-medium text-slate-900`}>
                    {ticket.customer}
                  </td>
                  <td className={`${tableCellClassName} text-slate-700`}>
                    {ticket.projectName}
                  </td>
                  <td className={`${tableCellClassName}${delivered ? " text-slate-600" : ""}`}>
                    {delivered ? (
                      ticket.driver
                    ) : (
                      <DriverSelect
                        ticketId={ticket.id}
                        driver={ticket.driver === "—" ? null : ticket.driver}
                        drivers={drivers}
                      />
                    )}
                  </td>
                  <td className={`${tableCellClassName}${delivered ? " text-slate-600" : ""}`}>
                    {delivered ? (
                      ticket.trailer
                    ) : (
                      <TrailerSelect
                        ticketId={ticket.id}
                        trailer={ticket.trailer === "—" ? null : ticket.trailer}
                        trailers={trailers}
                      />
                    )}
                  </td>
                  <td className={`${tableCellClassName} font-medium text-slate-900`}>
                    {ticket.totalWeight}
                  </td>
                  <td className={tableCellClassName}>
                    <StatusSelect ticketId={ticket.id} status={ticket.status} />
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
                        href={`/delivery-tickets/${ticket.id}/preview?from=hub`}
                        className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Print
                      </Link>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
