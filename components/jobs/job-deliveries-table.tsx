"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { JobRelatedDelivery } from "@/components/jobs/job-utils";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellWrapClassName,
  tableRowClassName,
} from "@/lib/table-styles";
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
        <td colSpan={5} className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}>
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
            <tr className={tableRowClassName}>
              <td className={tableCellClassName}>
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
              <td className={`${tableCellClassName} text-slate-700`}>{ticket.projectName}</td>
              <td className={`${tableCellClassName} text-slate-600`}>{ticket.deliveryDate}</td>
              <td className={tableCellClassName}>
                <StatusBadge
                  label={ticket.statusLabel}
                  variant={ticket.statusVariant}
                />
              </td>
              <td className={`${tableCellClassName} text-slate-600`}>{ticket.lastUpdated}</td>
            </tr>
            {expanded ? (
              <tr className="bg-slate-50/40">
                <td colSpan={5} className={tableCellClassName}>
                  {hasLineItems ? (
                    <div className="ml-6 overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
                      <table className={tableClassName}>
                        <thead>
                          <tr>
                            <th className={tableHeaderCellWrapClassName}>#</th>
                            <th className={tableHeaderCellWrapClassName}>Item</th>
                            <th className={tableHeaderCellWrapClassName}>
                              Description
                            </th>
                            <th className={tableHeaderCellWrapClassName}>Qty</th>
                            <th className={tableHeaderCellWrapClassName}>
                              Weight
                            </th>
                            <th className={tableHeaderCellWrapClassName}>
                              Yard
                            </th>
                            <th className={tableHeaderCellWrapClassName}>
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className={tableBodyClassName}>
                          {ticket.lineItems.map((line) => (
                            <tr key={line.id}>
                              <td className={`${tableCellClassName} text-slate-500`}>
                                {line.lineNumber}
                              </td>
                              <td className={`${tableCellClassName} font-medium text-slate-900`}>
                                {line.itemCode}
                              </td>
                              <td className={`${tableCellClassName} text-slate-700`}>
                                {line.description}
                              </td>
                              <td className={`${tableCellClassName} text-slate-600`}>
                                {line.quantity} {line.unit}
                              </td>
                              <td className={`${tableCellClassName} text-slate-600`}>
                                {line.totalWeight}
                              </td>
                              <td className={`${tableCellClassName} text-slate-600`}>
                                {line.yardLocation}
                              </td>
                              <td className={tableCellClassName}>
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
