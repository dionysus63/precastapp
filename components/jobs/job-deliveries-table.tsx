"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { JobRelatedDelivery } from "@/components/jobs/job-utils";

type JobDeliveriesTableProps = {
  deliveries: JobRelatedDelivery[];
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
        expanded ? "rotate-90" : ""
      }`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function JobDeliveriesTable({ deliveries }: JobDeliveriesTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(ticketId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  }

  if (deliveries.length === 0) {
    return (
      <tr>
        <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
          No delivery tickets for this job yet.
        </td>
      </tr>
    );
  }

  return (
    <>
      {deliveries.map((ticket) => {
        const expanded = expandedIds.has(ticket.id);
        const hasLineItems = ticket.lineItems.length > 0;

        return (
          <Fragment key={ticket.id}>
            <tr className="hover:bg-slate-50/60">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(ticket.id)}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? `Hide items on ${ticket.ticketNumber}`
                        : `Show items on ${ticket.ticketNumber}`
                    }
                  >
                    <ChevronIcon expanded={expanded} />
                  </button>
                  <Link
                    href={`/delivery-tickets/${ticket.id}`}
                    className="font-medium text-slate-900 hover:text-slate-700"
                  >
                    {ticket.ticketNumber}
                  </Link>
                  {hasLineItems ? (
                    <span className="text-[10px] text-slate-400">
                      ({ticket.lineItems.length})
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-2.5 text-slate-700">{ticket.projectName}</td>
              <td className="px-3 py-2.5 text-slate-600">{ticket.deliveryDate}</td>
              <td className="px-3 py-2.5">
                <StatusBadge
                  label={ticket.statusLabel}
                  variant={ticket.statusVariant}
                />
              </td>
              <td className="px-3 py-2.5 text-slate-600">{ticket.lastUpdated}</td>
            </tr>
            {expanded ? (
              <tr className="bg-slate-50/40">
                <td colSpan={5} className="px-3 py-2">
                  {hasLineItems ? (
                    <div className="ml-6 overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
                      <table className="min-w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase tracking-wide text-slate-500">
                            <th className="px-2.5 py-2 font-semibold">#</th>
                            <th className="px-2.5 py-2 font-semibold">Item</th>
                            <th className="px-2.5 py-2 font-semibold">
                              Description
                            </th>
                            <th className="px-2.5 py-2 font-semibold">Qty</th>
                            <th className="px-2.5 py-2 font-semibold">
                              Weight
                            </th>
                            <th className="px-2.5 py-2 font-semibold">
                              Yard
                            </th>
                            <th className="px-2.5 py-2 font-semibold">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ticket.lineItems.map((line) => (
                            <tr key={line.id}>
                              <td className="px-2.5 py-1.5 text-slate-500">
                                {line.lineNumber}
                              </td>
                              <td className="px-2.5 py-1.5 font-medium text-slate-900">
                                {line.itemCode}
                              </td>
                              <td className="px-2.5 py-1.5 text-slate-700">
                                {line.description}
                              </td>
                              <td className="px-2.5 py-1.5 text-slate-600">
                                {line.quantity} {line.unit}
                              </td>
                              <td className="px-2.5 py-1.5 text-slate-600">
                                {line.totalWeight}
                              </td>
                              <td className="px-2.5 py-1.5 text-slate-600">
                                {line.yardLocation}
                              </td>
                              <td className="px-2.5 py-1.5">
                                <StatusBadge
                                  label={line.statusLabel}
                                  variant={line.statusVariant}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="ml-6 text-[11px] text-slate-500">
                      No line items on this ticket.
                    </p>
                  )}
                </td>
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}
