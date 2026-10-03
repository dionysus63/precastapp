"use client";

import Link from "next/link";
import { memo, useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import type { DeliveryTicketRow } from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  formatWeekRangeLabel,
  getCurrentWeekWeekdays,
  groupTicketsByDeliveryDate,
} from "@/lib/delivery-dispatch-utils";

type DispatcherWeekCalendarProps = {
  tickets: DeliveryTicketRow[];
};

function formatTime(value: string | null): string {
  if (!value) {
    return "";
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
    () => getCurrentWeekWeekdays(referenceDate),
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
      description="Monday through Friday deliveries on the schedule."
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
                <ul className="space-y-2">
                  {dayTickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="rounded-md border border-white/80 bg-white px-2.5 py-2 shadow-sm"
                    >
                      <Link
                        href={`/delivery-tickets/${ticket.id}`}
                        className="font-mono text-[11px] font-semibold text-slate-900 hover:text-slate-700"
                      >
                        {ticket.ticketNumber}
                      </Link>
                      <p className="mt-1 text-xs font-medium text-slate-800">
                        {ticket.jobNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {ticket.projectName}
                      </p>
                      {ticket.deliveryTime ? (
                        <p className="mt-1 text-[10px] text-slate-500">
                          {formatTime(ticket.deliveryTime)}
                        </p>
                      ) : null}
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
