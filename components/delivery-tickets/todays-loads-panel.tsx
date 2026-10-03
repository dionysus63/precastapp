"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  deliveryTicketStatusLabels,
  type DeliveryTicketRow,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import { getTodaysScheduledLoads } from "@/lib/delivery-dispatch-utils";

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

export const TodaysLoadsPanel = memo(function TodaysLoadsPanel({
  tickets,
}: TodaysLoadsPanelProps) {
  const todaysLoads = useMemo(() => getTodaysScheduledLoads(tickets), [tickets]);

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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Ticket</th>
                <th className="px-4 py-2.5 font-semibold">Job</th>
                <th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold">Time</th>
                <th className="px-4 py-2.5 font-semibold">Truck</th>
                <th className="px-4 py-2.5 font-semibold">Driver</th>
                <th className="px-4 py-2.5 font-semibold">Weight</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todaysLoads.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-[11px] font-medium text-slate-900">
                    {ticket.ticketNumber}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">
                    {ticket.jobNumber}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {ticket.projectName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {formatTime(ticket.deliveryTime)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{ticket.truck}</td>
                  <td className="px-4 py-2.5 text-slate-600">{ticket.driver}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {ticket.totalWeight}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      label={deliveryTicketStatusLabels[ticket.status]}
                      variant={ticket.statusVariant}
                    />
                  </td>
                  <td className="px-4 py-2.5">
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
});
