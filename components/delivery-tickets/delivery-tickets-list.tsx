"use client";

import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import { DispatcherWeekCalendar } from "@/components/delivery-tickets/dispatcher-week-calendar";
import { TodaysLoadsPanel } from "@/components/delivery-tickets/todays-loads-panel";
import {
  deliveryDateFilterOptions,
  deliveryDriverFilterOptions,
  deliveryJobFilterOptions,
  deliveryTicketStatusFormOptions,
  deliveryTicketStatusLabels,
  deliveryTruckFilterOptions,
  type DeliveryTicketRow,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import type { PageInfo } from "@/lib/list-params";

type DeliveryTicketsListFilters = {
  search: string;
  status: string;
  driver: string;
  truck: string;
  job: string;
  date: string;
};

type DeliveryTicketsListProps = {
  tickets: DeliveryTicketRow[];
  scheduleTickets: DeliveryTicketRow[];
  pageInfo: PageInfo;
  filters: DeliveryTicketsListFilters;
};

export function DeliveryTicketsList({
  tickets,
  scheduleTickets,
  pageInfo,
  filters,
}: DeliveryTicketsListProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/delivery-tickets/reconcile"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reconcile Day
        </Link>
        <Link
          href="/delivery-tickets/new"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          New Delivery Ticket
        </Link>
      </div>

      <DispatcherWeekCalendar tickets={scheduleTickets} />
      <TodaysLoadsPanel tickets={scheduleTickets} />

      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap">
        <input
          type="search"
          placeholder="Search ticket number, job number, customer, project, truck, or driver..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 xl:max-w-sm"
        />
        <select
          value={filters.status || "All"}
          onChange={(event) => setParams({ status: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          <option value="All">Status: All</option>
          {deliveryTicketStatusFormOptions.map((option) => (
            <option key={option.value} value={option.value}>
              Status: {option.label}
            </option>
          ))}
        </select>
        <select
          value={filters.date || "All"}
          onChange={(event) => setParams({ date: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {deliveryDateFilterOptions.map((date) => (
            <option key={date} value={date}>
              Delivery Date: {date}
            </option>
          ))}
        </select>
        <select
          value={filters.driver || "All"}
          onChange={(event) => setParams({ driver: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {deliveryDriverFilterOptions.map((driver) => (
            <option key={driver} value={driver}>
              Driver: {driver}
            </option>
          ))}
        </select>
        <select
          value={filters.truck || "All"}
          onChange={(event) => setParams({ truck: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {deliveryTruckFilterOptions.map((truck) => (
            <option key={truck} value={truck}>
              Truck: {truck}
            </option>
          ))}
        </select>
        <select
          value={filters.job || "All"}
          onChange={(event) => setParams({ job: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {deliveryJobFilterOptions.map((job) => (
            <option key={job} value={job}>
              Job: {job}
            </option>
          ))}
        </select>
      </div>

      <SectionCard
        title="All Delivery Tickets"
        description={`${pageInfo.total.toLocaleString()} ticket${pageInfo.total === 1 ? "" : "s"} match`}
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Ticket Number</th>
                <th className="px-4 py-2.5 font-semibold">Job Number</th>
                <th className="px-4 py-2.5 font-semibold">Project Name</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Delivery Date</th>
                <th className="px-4 py-2.5 font-semibold">Truck</th>
                <th className="px-4 py-2.5 font-semibold">Driver</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Items</th>
                <th className="px-4 py-2.5 font-semibold">Total Weight</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No delivery tickets match your search or filters.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
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
                    <td className="px-4 py-2.5 text-slate-700">
                      {ticket.customer}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {ticket.deliveryDate}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{ticket.truck}</td>
                    <td className="px-4 py-2.5 text-slate-600">{ticket.driver}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={deliveryTicketStatusLabels[ticket.status]}
                        variant={ticket.statusVariant}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{ticket.items}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {ticket.totalWeight}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
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
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="ticket"
        />
      </SectionCard>
    </div>
  );
}
