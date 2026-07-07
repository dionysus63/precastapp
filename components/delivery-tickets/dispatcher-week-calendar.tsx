"use client";

import Link from "next/link";
import { memo, useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import type { DeliveryTicketRow } from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  formatWeekRangeLabel,
  getDispatchDays,
  groupTicketsByDeliveryDate,
} from "@/lib/delivery-dispatch-utils";

type DispatcherWeekCalendarProps = {
  tickets: DeliveryTicketRow[];
};

function getReferenceDateForWeekOffset(weekOffset: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + weekOffset * 7);
  return date;
}

export const DispatcherWeekCalendar = memo(function DispatcherWeekCalendar({
  tickets,
}: DispatcherWeekCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const referenceDate = useMemo(
    () => getReferenceDateForWeekOffset(weekOffset),
    [weekOffset],
  );
  const weekdays = useMemo(
    () => getDispatchDays(referenceDate),
    [referenceDate],
  );
  const grouped = useMemo(
    () => groupTicketsByDeliveryDate(tickets, weekdays),
    [tickets, weekdays],
  );

  const title =
    weekOffset === 0 ? "This Week" : formatWeekRangeLabel(weekdays);

  return (
    <SectionCard
      title={title}
      description="Today plus the next four business days."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {weekOffset !== 0 ? (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setWeekOffset((offset) => offset - 1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            aria-label="Previous week"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((offset) => offset + 1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            aria-label="Next week"
          >
            →
          </button>
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-5">
        {weekdays.map((day) => {
          const dayTickets = grouped.get(day.dateIso) ?? [];
          return (
            <div
              key={day.dateIso}
              className={`rounded-lg border p-3 ${
                day.isToday
                  ? "border-sky-200 bg-sky-50/60"
                  : "border-slate-100 bg-slate-50/40"
              }`}
            >
              <div className="mb-3 border-b border-slate-100 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {day.label}
                </p>
                {day.isToday ? (
                  <p className="text-[10px] font-medium text-sky-700">Today</p>
                ) : null}
              </div>
              {dayTickets.length === 0 ? (
                <p className="text-xs text-slate-400">No deliveries scheduled</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayTickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="rounded-md border border-white/80 bg-white px-2 py-1.5 shadow-sm"
                    >
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {ticket.customer}
                      </p>
                      {ticket.jobId ? (
                        <Link
                          href={`/jobs/${ticket.jobId}`}
                          className="block truncate text-[11px] font-medium text-sky-700 hover:underline"
                        >
                          {ticket.projectName}
                        </Link>
                      ) : (
                        <p className="truncate text-[11px] text-slate-600">
                          {ticket.projectName}
                        </p>
                      )}
                      <Link
                        href={`/delivery-tickets/${ticket.id}`}
                        className="font-mono text-[10px] text-slate-500 hover:text-slate-900"
                      >
                        {ticket.ticketNumber}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
});
