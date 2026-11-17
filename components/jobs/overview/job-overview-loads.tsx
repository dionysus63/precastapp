"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DeliveryTileMenu } from "@/components/delivery-tickets/delivery-tile-menu";
import { StatusSelect } from "@/components/delivery-tickets/status-select";
import {
  overviewEmptyCellClassName,
  overviewTableWrapperClassName,
} from "@/components/jobs/overview/overview-styles";
import type { JobOverviewLoad } from "@/lib/job-overview";
import { deliveryTicketStatusVariant } from "@/lib/status-variants";
import {
  tableActionButtonClassName,
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const COLUMN_COUNT = 6;

function SignedCopyCell({ load }: { load: JobOverviewLoad }) {
  switch (load.signedCopy) {
    case "in":
      return <StatusBadge label="Scanned in" variant="success" />;
    case "not-in":
      return <StatusBadge label="Not in" variant="warning" />;
    case "closed":
      return <StatusBadge label="No signed copy" variant="neutral" />;
    default:
      return <span className="text-slate-500">—</span>;
  }
}

/**
 * The job's loads on the Overview: change a load's status, print its
 * ticket, move its date or chase its signed copy without opening the
 * Deliveries tab. Cancelled loads are left to that tab.
 */
export function JobOverviewLoads({
  loads,
  canManageDeliveries,
  canScanIn,
}: {
  loads: JobOverviewLoad[];
  /** Change status, edit, move the date. */
  canManageDeliveries: boolean;
  /** Open Invoices → Scan In for a signed copy that is not in. */
  canScanIn: boolean;
}) {
  return (
    <div className={overviewTableWrapperClassName}>
      <table className={tableCompactClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellClassName}>Date</th>
            <th className={tableHeaderCellClassName}>Ticket</th>
            <th className={tableHeaderCellClassName}>On the Load</th>
            <th className={tableHeaderCellClassName}>Status</th>
            <th className={tableHeaderCellClassName}>Signed Copy</th>
            <th className={tableHeaderCellClassName}>Actions</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {loads.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className={overviewEmptyCellClassName}>
                No loads for this job yet.
              </td>
            </tr>
          ) : (
            loads.map((load) => {
              const delivered = load.status === "DELIVERED";
              return (
                <tr key={load.id} className={tableRowClassName}>
                  <td
                    className={`${tableCellClassName} whitespace-nowrap font-medium text-slate-900`}
                  >
                    {load.dateLabel}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap`}>
                    <Link
                      href={`/delivery-tickets/${load.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {load.ticketNumber}
                    </Link>
                    {load.isPickup ? (
                      <span className="ml-1.5 text-2xs text-slate-500">
                        Pickup
                      </span>
                    ) : null}
                  </td>
                  <td className={`${tableCellClassName} max-w-[18rem] text-slate-700`}>
                    {load.itemsSummary}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap`}>
                    {canManageDeliveries ? (
                      <StatusSelect ticketId={load.id} status={load.status} />
                    ) : (
                      <StatusBadge
                        label={load.statusLabel}
                        variant={deliveryTicketStatusVariant(load.status)}
                      />
                    )}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap`}>
                    <SignedCopyCell load={load} />
                  </td>
                  <td className={tableCellClassName}>
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={`/delivery-tickets/${load.id}/preview`}
                        className={tableActionButtonClassName}
                      >
                        Print
                      </Link>
                      {canManageDeliveries && !delivered ? (
                        <>
                          <Link
                            href={`/delivery-tickets/${load.id}/edit`}
                            className={tableActionButtonClassName}
                          >
                            Edit
                          </Link>
                          <DeliveryTileMenu
                            ticketId={load.id}
                            ticketNumber={load.ticketNumber}
                            deliveryDateIso={load.deliveryDateIso}
                            appearance="pill"
                            label="Change Date"
                          />
                        </>
                      ) : null}
                      {load.signedCopy === "not-in" && canScanIn ? (
                        <Link
                          href="/invoices?tab=scan"
                          className={tableActionButtonClassName}
                        >
                          Scan In
                        </Link>
                      ) : null}
                      {load.signedFileId ? (
                        <a
                          href={`/api/signed-tickets/${load.signedFileId}/download?view=1`}
                          target="_blank"
                          rel="noreferrer"
                          className={tableActionButtonClassName}
                        >
                          View Signed
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
