"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import {
  deliveryDateFilterOptions,
  deliveryDriverFilterOptions,
  deliveryJobFilterOptions,
  deliveryTicketStatusFilterOptions,
  deliveryTicketStatusLabels,
  deliveryTicketSummaryCards,
  deliveryTruckFilterOptions,
  matchesDeliveryDateFilter,
  placeholderDeliveryTickets,
  recentDeliveryActivity,
  upcomingDeliveries,
  type DeliveryTicketRow,
} from "@/components/delivery-tickets/delivery-ticket-utils";

type DeliveryTicketsListProps = {
  tickets?: DeliveryTicketRow[];
  summaryStats?: {
    scheduledToday: number;
    readyToShip: number;
    inTransit: number;
    deliveredThisWeek: number;
    openTickets: number;
  };
};

export function DeliveryTicketsList({
  tickets: ticketsProp,
  summaryStats,
}: DeliveryTicketsListProps = {}) {
  const tickets = ticketsProp ?? placeholderDeliveryTickets;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState("All");
  const [driverFilter, setDriverFilter] = useState("All");
  const [truckFilter, setTruckFilter] = useState("All");
  const [jobFilter, setJobFilter] = useState("All");

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        search.trim() === "" ||
        ticket.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
        ticket.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        ticket.customer.toLowerCase().includes(search.toLowerCase()) ||
        ticket.projectName.toLowerCase().includes(search.toLowerCase()) ||
        ticket.truck.toLowerCase().includes(search.toLowerCase()) ||
        ticket.driver.toLowerCase().includes(search.toLowerCase());

      const statusLabel = deliveryTicketStatusLabels[ticket.status];
      const matchesStatus =
        statusFilter === "All" || statusLabel === statusFilter;

      const matchesDeliveryDate = matchesDeliveryDateFilter(
        ticket.deliveryDate,
        deliveryDateFilter,
      );

      const matchesDriver =
        driverFilter === "All" || ticket.driver === driverFilter;

      const matchesTruck =
        truckFilter === "All" || ticket.truck === truckFilter;

      const matchesJob =
        jobFilter === "All" || ticket.jobNumber === jobFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDeliveryDate &&
        matchesDriver &&
        matchesTruck &&
        matchesJob
      );
    });
  }, [
    search,
    statusFilter,
    deliveryDateFilter,
    driverFilter,
    truckFilter,
    jobFilter,
    tickets,
  ]);

  const summaryCards = summaryStats
    ? [
        {
          label: "Scheduled Today",
          value: String(summaryStats.scheduledToday),
          detail: "Deliveries on today's schedule",
          accent: "sky" as const,
        },
        {
          label: "Ready to Ship",
          value: String(summaryStats.readyToShip),
          detail: "Tickets cleared for loading",
          accent: "emerald" as const,
        },
        {
          label: "In Transit",
          value: String(summaryStats.inTransit),
          detail: "Currently on the road",
          accent: "amber" as const,
        },
        {
          label: "Delivered This Week",
          value: String(summaryStats.deliveredThisWeek),
          detail: "Completed deliveries",
          accent: "emerald" as const,
        },
        {
          label: "Open Tickets",
          value: String(summaryStats.openTickets),
          detail: "Draft, scheduled, or in transit",
          accent: "rose" as const,
        },
      ]
    : deliveryTicketSummaryCards;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-400"
        >
          Export
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-400"
        >
          Print Schedule
        </button>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap">
        <input
          type="search"
          placeholder="Search ticket number, job number, customer, project, truck, or driver..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 xl:max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {deliveryTicketStatusFilterOptions.map((status) => (
            <option key={status} value={status}>
              Status: {status}
            </option>
          ))}
        </select>
        <select
          value={deliveryDateFilter}
          onChange={(event) => setDeliveryDateFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {deliveryDateFilterOptions.map((date) => (
            <option key={date} value={date}>
              Delivery Date: {date}
            </option>
          ))}
        </select>
        <select
          value={driverFilter}
          onChange={(event) => setDriverFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {deliveryDriverFilterOptions.map((driver) => (
            <option key={driver} value={driver}>
              Driver: {driver}
            </option>
          ))}
        </select>
        <select
          value={truckFilter}
          onChange={(event) => setTruckFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {deliveryTruckFilterOptions.map((truck) => (
            <option key={truck} value={truck}>
              Truck: {truck}
            </option>
          ))}
        </select>
        <select
          value={jobFilter}
          onChange={(event) => setJobFilter(event.target.value)}
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
        title="Delivery Ticket List"
        description={`${filteredTickets.length} ticket${filteredTickets.length === 1 ? "" : "s"} shown`}
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
              {filteredTickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No delivery tickets match your search or filters.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
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
                        <button
                          type="button"
                          disabled
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                        >
                          Print
                        </button>
                        <button
                          type="button"
                          disabled
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                        >
                          Mark Delivered
                        </button>
                        <button
                          type="button"
                          disabled
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                        >
                          More
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Upcoming Deliveries"
          description="Compact schedule grouped by delivery date."
        >
          <div className="space-y-4">
            {upcomingDeliveries.map((group) => (
              <div key={group.date}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {group.date}
                </p>
                <ul className="mt-2 space-y-2">
                  {group.deliveries.map((delivery) => (
                    <li
                      key={delivery.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                    >
                      <div>
                        <p className="font-mono text-[11px] font-medium text-slate-900">
                          {delivery.ticketNumber}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-800">
                          {delivery.projectName}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {delivery.truck} · {delivery.driver}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-[11px] font-medium text-slate-600">
                        {delivery.time}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent Delivery Activity"
          description="Latest delivery ticket updates."
        >
          <ul className="space-y-3">
            {recentDeliveryActivity.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
              >
                <p className="text-sm text-slate-800">{item.message}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.timestamp}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
