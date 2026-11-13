"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ResultPill,
  ScanCardHead,
  cellButtonClassName,
  cellLinkClassName,
  cellPrimaryButtonClassName,
  pluralize,
  scanCardClassName,
  type ScanResultTone,
} from "@/components/invoices/scan-in/scan-ui";
import { addLocalDays, toLocalDayInput } from "@/lib/date-only";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
import type {
  ScanInStillOutRow,
  StillOutUndo,
} from "@/lib/ticket-scan/view-types";

/**
 * A row someone just dealt with. It stays where it was, saying what was done
 * and offering Undo, until the screen is left.
 */
export type StillOutDone = {
  row: ScanInStillOutRow;
  /** Where the row sat in the list when it was dealt with. */
  index: number;
  pill: string;
  tone: ScanResultTone;
  text: string | null;
  invoice: { id: string; invoiceNumber: string } | null;
  undo: StillOutUndo | null;
};

type Entry = { row: ScanInStillOutRow; done: StillOutDone | null };

function mergeRows(
  rows: ScanInStillOutRow[],
  done: Record<string, StillOutDone>,
): Entry[] {
  const merged: Entry[] = rows
    .filter((row) => !done[row.ticketId])
    .map((row) => ({ row, done: null }));
  const kept = Object.values(done).sort((a, b) => a.index - b.index);
  for (const entry of kept) {
    merged.splice(Math.min(entry.index, merged.length), 0, {
      row: entry.row,
      done: entry,
    });
  }
  return merged;
}

/**
 * "Still out": tickets that went out and have no signed copy scanned in.
 * This is the check Reconcile Day used to be.
 */
export function ScanStillOut({
  rows,
  more,
  done,
  canFile,
  busy,
  onClose,
  onMove,
  onCancel,
  onUndo,
}: {
  rows: ScanInStillOutRow[];
  /** Tickets still out beyond the ones listed. */
  more: number;
  done: Record<string, StillOutDone>;
  canFile: boolean;
  busy: boolean;
  onClose: (row: ScanInStillOutRow, index: number) => void;
  onMove: (row: ScanInStillOutRow, index: number, newDate: string) => void;
  onCancel: (row: ScanInStillOutRow, index: number) => void;
  onUndo: (entry: StillOutDone) => void;
}) {
  const [moving, setMoving] = useState<{ ticketId: string; date: string } | null>(
    null,
  );
  const entries = mergeRows(rows, done);

  return (
    <section className={scanCardClassName}>
      <ScanCardHead
        title="Still out"
        hint="Tickets that have gone out with no signed copy scanned in. This is the Reconcile Day check."
      />
      {entries.length === 0 ? (
        <p className="px-4 py-3 text-sm font-semibold text-emerald-700">
          Nothing is out. Every ticket that went out has a signed copy.
        </p>
      ) : (
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Ticket</th>
                <th className={tableHeaderCellClassName}>Customer and project</th>
                <th className={tableHeaderCellClassName}>Date</th>
                <th className={tableHeaderCellClassName}>Status</th>
                <th className={tableHeaderCellClassName}>What happened</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {entries.map(({ row, done: outcome }, index) => (
                <tr key={row.ticketId} className={tableRowClassName}>
                  <td className={`${tableCellClassName} whitespace-nowrap`}>
                    <Link
                      href={`/delivery-tickets/${row.ticketId}`}
                      className="font-semibold text-slate-900 underline decoration-slate-300 hover:decoration-slate-600"
                    >
                      {row.ticketNumber}
                    </Link>
                  </td>
                  <td className={`${tableCellClassName} min-w-[10rem]`}>
                    {row.customerName}
                    {row.projectName ? (
                      <span className="block text-slate-500">
                        {row.projectName}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap`}>
                    <span className="mr-1.5 tabular-nums">{row.dateLabel}</span>
                    {!outcome && row.daysOut > 0 ? (
                      <ResultPill
                        label={pluralize(row.daysOut, "day")}
                        tone={row.daysOut >= 5 ? "bad" : "warn"}
                      />
                    ) : null}
                  </td>
                  <td className={tableCellClassName}>
                    {row.statusLabel}
                    {row.note ? (
                      <span className="block text-2xs text-slate-500">
                        {row.note}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${tableCellClassName} min-w-[14rem]`}>
                    {outcome ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <ResultPill label={outcome.pill} tone={outcome.tone} />
                        {outcome.text ? (
                          <span className="text-slate-600">{outcome.text}</span>
                        ) : null}
                        {outcome.invoice ? (
                          <Link
                            href={`/invoices/${outcome.invoice.id}`}
                            className={cellLinkClassName}
                          >
                            See invoice {outcome.invoice.invoiceNumber}
                          </Link>
                        ) : null}
                        {outcome.undo && canFile ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onUndo(outcome)}
                            className={cellLinkClassName}
                          >
                            Undo
                          </button>
                        ) : null}
                      </div>
                    ) : !canFile ? null : moving?.ticketId === row.ticketId ? (
                      <form
                        className="flex flex-wrap items-center gap-1.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (moving.date) {
                            onMove(row, index, moving.date);
                            setMoving(null);
                          }
                        }}
                      >
                        <input
                          type="date"
                          value={moving.date}
                          aria-label={`New delivery date for ${row.ticketNumber}`}
                          onChange={(event) =>
                            setMoving({
                              ticketId: row.ticketId,
                              date: event.target.value,
                            })
                          }
                          className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                        />
                        <button
                          type="submit"
                          disabled={busy || !moving.date}
                          className={cellPrimaryButtonClassName}
                        >
                          Move
                        </button>
                        <button
                          type="button"
                          onClick={() => setMoving(null)}
                          className={cellButtonClassName}
                        >
                          Never mind
                        </button>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onClose(row, index)}
                          title={
                            row.delivered
                              ? "Takes the ticket off this list. It is already marked delivered."
                              : row.signedNotDelivered
                                ? "Marks the ticket delivered, which makes its invoice."
                                : "Marks the ticket delivered, which makes its invoice, and takes it off this list."
                          }
                          className={cellButtonClassName}
                        >
                          {row.signedNotDelivered
                            ? "Mark delivered"
                            : "Delivered, no signed copy"}
                        </button>
                        {!row.delivered ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                setMoving({
                                  ticketId: row.ticketId,
                                  date: toLocalDayInput(
                                    addLocalDays(new Date(), 1),
                                  ),
                                })
                              }
                              title="It did not go out that day: pick the day it will."
                              className={cellButtonClassName}
                            >
                              Move date
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onCancel(row, index)}
                              className={cellButtonClassName}
                            >
                              Cancel ticket
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {more > 0 ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          {pluralize(more, "more ticket")} still out. The oldest are shown
          first.
        </p>
      ) : null}
    </section>
  );
}
