"use client";

import Link from "next/link";
import { memo } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import {
  deliveryDateFilterOptions,
  deliveryTicketStatusFormOptions,
  deliveryTicketStatusLabels,
  type DeliveryFilterOptions,
  type DeliveryTicketRow,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import type { PageInfo } from "@/lib/list-params";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
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
  pageInfo: PageInfo;
  filterOptions: DeliveryFilterOptions;
  filters: DeliveryTicketsListFilters;
};

// Memoized so typing in the search box doesn't re-render the full row set;
// rows only change when the server sends a new page.
const TicketsTable = memo(function TicketsTable({
  tickets,
}: {
  tickets: DeliveryTicketRow[];
}) {
  return (
    <div className={tableFlushWrapperClassName}>
      <table className={tableClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellClassName}>Ticket</th>
            <th className={tableHeaderCellClassName}>Customer</th>
            <th className={tableHeaderCellClassName}>Job</th>
            <th className={tableHeaderCellClassName}>Delivery Date</th>
            <th className={tableHeaderCellClassName}>Truck</th>
            <th className={tableHeaderCellClassName}>Driver</th>
            <th className={tableHeaderCellClassName}>Status</th>
            <th className={tableHeaderCellClassName}>Items</th>
            <th className={tableHeaderCellClassName}>Total Weight</th>
            <th className={tableHeaderCellClassName}>Actions</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {tickets.length === 0 ? (
            <tr>
              <td
                colSpan={10}
                className={`${tableCellBordersClassName} px-4 py-8 text-center text-sm text-slate-500`}
              >
                No delivery tickets match your search or filters.
              </td>
            </tr>
          ) : (
            tickets.map((ticket) => (
              <tr key={ticket.id} className={tableRowClassName}>
                <td className={tableCellClassName}>
                  <Link
                    href={`/delivery-tickets/${ticket.id}`}
                    className="font-mono text-[11px] font-semibold text-slate-900 hover:text-sky-700 hover:underline"
                  >
                    {ticket.ticketNumber}
                  </Link>
                </td>
                <td className={`${tableCellClassName} font-medium text-slate-900`}>
                  {ticket.customer}
                </td>
                <td className={tableCellClassName}>
                  {ticket.jobId ? (
                    <Link
                      href={`/jobs/${ticket.jobId}`}
                      className="font-medium text-sky-700 hover:underline"
                    >
                      {ticket.projectName}
                    </Link>
                  ) : (
                    <span className="text-slate-700">{ticket.projectName}</span>
                  )}
                  <span className="block font-mono text-[10px] text-slate-400">
                    {ticket.jobNumber}
                  </span>
                </td>
                <td className={`${tableCellClassName} whitespace-nowrap text-slate-600`}>
                  {ticket.deliveryDate}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>{ticket.truck}</td>
                <td className={`${tableCellClassName} text-slate-600`}>{ticket.driver}</td>
                <td className={tableCellClassName}>
                  <StatusBadge
                    label={deliveryTicketStatusLabels[ticket.status]}
                    variant={ticket.statusVariant}
                  />
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>{ticket.items}</td>
                <td className={`${tableCellClassName} font-medium text-slate-900`}>
                  {ticket.totalWeight}
                </td>
                <td className={tableCellClassName}>
                  <Link
                    href={`/delivery-tickets/${ticket.id}/preview`}
                    className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Print
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

// Renders a fragment: the actions row, dispatcher calendar, and today's loads
// panel are rendered by app/delivery-tickets/page.tsx as siblings inside the
// shared `space-y-4` wrapper, keeping this client boundary to filters + table.
export function DeliveryTicketsList({
  tickets,
  pageInfo,
  filterOptions,
  filters,
}: DeliveryTicketsListProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  return (
    <>
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
          {filterOptions.drivers.map((driver) => (
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
          {filterOptions.trucks.map((truck) => (
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
          {filterOptions.jobs.map((job) => (
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
        <TicketsTable tickets={tickets} />
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="ticket"
        />
      </SectionCard>
    </>
  );
}
