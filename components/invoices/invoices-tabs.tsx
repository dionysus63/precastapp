"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import { useListQuery } from "@/components/common/use-list-query";
import {
  finalizeInvoices,
  type InvoiceListRow,
} from "@/app/invoices/actions";
import {
  ReconcileDay,
  type ReconcileTicket,
} from "@/components/delivery-tickets/reconcile-day";
import { printPdfUrl } from "@/lib/print-pdf-url";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { PageInfo } from "@/lib/list-params";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

export type ReconcileTabData = {
  allowed: boolean;
  mode: "day" | "range" | "all" | "unreconciled";
  from: string;
  to: string;
  days: Array<{
    date: string;
    scheduledTickets: ReconcileTicket[];
    deliveredOtherDayTickets: ReconcileTicket[];
    reconciliation: {
      confirmedBy: string | null;
      confirmedAt: Date | null;
      notes: string | null;
    } | null;
  }>;
  truncated: boolean;
};

type InvoicesTabsProps = {
  invoices: InvoiceListRow[];
  paidWalkIns: InvoiceListRow[];
  pageInfo: PageInfo;
  tabCounts: { drafts: number; finals: number; paidWalkIns: number };
  initialTab: "drafts" | "final" | "reconcile";
  initialStatus: string;
  canManage: boolean;
  draftFrom: string;
  draftTo: string;
  reconcile: ReconcileTabData | null;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function groupByDeliveryDate(rows: InvoiceListRow[]): Map<string, InvoiceListRow[]> {
  const groups = new Map<string, InvoiceListRow[]>();
  for (const row of rows) {
    const key = row.deliveryDate
      ? new Date(row.deliveryDate).toISOString().slice(0, 10)
      : "No delivery date";
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }
  return new Map(
    [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)),
  );
}

function InvoiceBadges({ row }: { row: InvoiceListRow }) {
  const badges: string[] = [];
  if (row.ticketType === "WALK_IN") badges.push("Walk-in");
  if (
    row.ticketType === "WALK_IN" &&
    row.paymentMethod === "PAY_NOW" &&
    !row.paymentReceived
  ) {
    badges.push("Payment due at pickup");
  }
  if (row.hasZeroPriceLine) badges.push("$0 line warning");
  if (badges.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

function DraftReviewTab({
  drafts,
  paidWalkIns,
  pageInfo,
  canManage,
  draftFrom,
  draftTo,
}: {
  drafts: InvoiceListRow[];
  paidWalkIns: InvoiceListRow[];
  pageInfo: PageInfo;
  canManage: boolean;
  draftFrom: string;
  draftTo: string;
}) {
  const confirm = useConfirm();
  const { setParams } = useListQuery();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [fromInput, setFromInput] = useState(draftFrom);
  const [toInput, setToInput] = useState(draftTo);
  const isFiltered = Boolean(draftFrom || draftTo);

  const grouped = useMemo(() => groupByDeliveryDate(drafts), [drafts]);
  const selectedTotal = drafts
    .filter((row) => selected.has(row.id))
    .reduce((sum, row) => sum + row.total, 0);

  const toggleAll = () => {
    if (selected.size === drafts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(drafts.map((row) => row.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finalizeSelected = async () => {
    const ids = selected.size > 0 ? [...selected] : drafts.map((row) => row.id);
    if (ids.length === 0) return;
    const count = ids.length;
    const total = ids.reduce((sum, id) => {
      const row = drafts.find((item) => item.id === id);
      return sum + (row?.total ?? 0);
    }, 0);
    if (
      !(await confirm({
        title: "Finalize invoices?",
        message: `Finalize ${count} draft invoice${count === 1 ? "" : "s"} totaling ${formatMoney(total)}?`,
        confirmLabel: "Finalize",
      }))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await finalizeInvoices(ids, invoiceDate);
      setMessage(result.error ?? `Finalized ${result.finalized ?? 0} invoice(s).`);
      if (!result.error) setSelected(new Set());
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Delivery date</span>
        <input
          type="date"
          value={fromInput}
          onChange={(event) => setFromInput(event.target.value)}
          aria-label="Delivery date from"
          className="rounded border border-slate-200 px-2 py-1"
        />
        <span>to</span>
        <input
          type="date"
          value={toInput}
          onChange={(event) => setToInput(event.target.value)}
          aria-label="Delivery date to"
          className="rounded border border-slate-200 px-2 py-1"
        />
        <button
          type="button"
          onClick={() =>
            setParams({ from: fromInput || null, to: toInput || null })
          }
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            setFromInput("");
            setToInput("");
            setParams({ from: null, to: null });
          }}
          className={`rounded-lg px-3 py-1.5 font-medium ${
            isFiltered
              ? "border border-slate-200 text-slate-700 hover:bg-slate-50"
              : "bg-slate-900 text-white"
          }`}
        >
          View all
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {pageInfo.total.toLocaleString()} draft invoice
          {pageInfo.total === 1 ? "" : "s"}
          {isFiltered
            ? ` with delivery date ${draftFrom || "…"} – ${draftTo || "…"}.`
            : " ready for review."}
        </p>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              Invoice date
              <input
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
                className="rounded border border-slate-200 px-2 py-1"
              />
            </label>
            {drafts.length > 0 ? (
              <Link
                href="/invoices/draft-batch/preview"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                Print all drafts
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium opacity-50"
              >
                Print all drafts
              </button>
            )}
            <button
              type="button"
              disabled={pending || drafts.length === 0}
              onClick={finalizeSelected}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {selected.size > 0
                ? `Finalize selected (${selected.size})`
                : "Finalize all on page"}
            </button>
          </div>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {message}
        </p>
      ) : null}

      {drafts.length === 0 ? (
        <p className="text-sm text-slate-500">
          {isFiltered
            ? "No draft invoices with a delivery date in this range."
            : "No draft invoices. Use the Reconcile Day tab to create them."}
        </p>
      ) : (
        [...grouped.entries()].map(([dateKey, rows]) => (
          <SectionCard
            key={dateKey}
            title={`Delivery date: ${dateKey === "No delivery date" ? "—" : dateKey}`}
            noPadding
          >
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    {canManage ? (
                      <th className={tableHeaderCellClassName}>
                        <input
                          type="checkbox"
                          checked={
                            drafts.length > 0 && selected.size === drafts.length
                          }
                          onChange={toggleAll}
                          aria-label="Select all drafts"
                        />
                      </th>
                    ) : null}
                    <th className={tableHeaderCellClassName}>Invoice</th>
                    <th className={tableHeaderCellClassName}>Ticket</th>
                    <th className={tableHeaderCellClassName}>Customer</th>
                    <th className={tableHeaderCellClassName}>Subtotal</th>
                    <th className={tableHeaderCellClassName}>Delivery</th>
                    <th className={tableHeaderCellClassName}>Tax</th>
                    <th className={tableHeaderCellClassName}>Total</th>
                    <th className={tableHeaderCellClassName}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {rows.map((row) => (
                    <tr key={row.id} className={tableRowClassName}>
                      {canManage ? (
                        <td className={tableCellClassName}>
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            aria-label={`Select ${row.invoiceNumber}`}
                          />
                        </td>
                      ) : null}
                      <td className={`${tableCellClassName} font-medium`}>
                        <Link
                          href={`/invoices/${row.id}`}
                          className="text-slate-900 hover:text-slate-700"
                        >
                          {row.invoiceNumber}
                        </Link>
                        <InvoiceBadges row={row} />
                      </td>
                      <td className={tableCellClassName}>{row.ticketNumber}</td>
                      <td className={tableCellClassName}>
                        {row.customerName}
                        <span className="block text-slate-500">
                          {row.projectName}
                        </span>
                      </td>
                      <td className={tableCellClassName}>{formatMoney(row.subtotal)}</td>
                      <td className={tableCellClassName}>
                        {formatMoney(row.deliveryAmount)}
                      </td>
                      <td className={tableCellClassName}>{formatMoney(row.salesTax)}</td>
                      <td className={`${tableCellClassName} font-medium`}>
                        {formatMoney(row.total)}
                      </td>
                      <td className={tableCellClassName}>
                        <div className="flex flex-wrap gap-2">
                          {canManage ? (
                            <Link
                              href={`/invoices/${row.id}/edit`}
                              className="text-sky-700 underline hover:text-sky-900"
                            >
                              Edit
                            </Link>
                          ) : null}
                          <a
                            href={`/api/invoices/${row.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-700 underline hover:text-slate-900"
                          >
                            View PDF
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              printPdfUrl(`/api/invoices/${row.id}/pdf`)
                            }
                            className="text-slate-700 underline hover:text-slate-900"
                          >
                            Print
                          </button>
                          {canManage ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={async () => {
                                if (
                                  !(await confirm({
                                    title: "Delete draft?",
                                    message: `Delete draft invoice ${row.invoiceNumber}? The delivery ticket can be converted again afterwards.`,
                                    confirmLabel: "Delete draft",
                                    variant: "danger",
                                  }))
                                ) {
                                  return;
                                }
                                startTransition(async () => {
                                  const { deleteDraftInvoice } = await import(
                                    "@/app/invoices/actions"
                                  );
                                  const result = await deleteDraftInvoice(
                                    row.id,
                                  );
                                  setMessage(result.error ?? "Draft deleted.");
                                });
                              }}
                              className="text-red-700 underline hover:text-red-900 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ))
      )}

      {pageInfo.totalPages > 1 ? (
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="draft invoice"
        />
      ) : null}

      {selected.size > 0 ? (
        <p className="text-xs text-slate-500">
          Selected total: {formatMoney(selectedTotal)}
        </p>
      ) : null}

      {paidWalkIns.length > 0 ? (
        <SectionCard title="Already paid walk-ins (reference only)">
          <button
            type="button"
            onClick={() => setShowPaid((value) => !value)}
            className="mb-3 text-xs font-medium text-slate-700 underline"
          >
            {showPaid ? "Hide" : "Show"} {paidWalkIns.length} paid walk-in
            {paidWalkIns.length === 1 ? "" : "s"}
          </button>
          {showPaid ? (
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Invoice</th>
                    <th className={tableHeaderCellClassName}>Ticket</th>
                    <th className={tableHeaderCellClassName}>Customer</th>
                    <th className={tableHeaderCellClassName}>Total</th>
                    <th className={tableHeaderCellClassName}>Status</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {paidWalkIns.map((row) => (
                    <tr key={row.id}>
                      <td className={tableCellClassName}>
                        <Link
                          href={`/invoices/${row.id}`}
                          className="font-medium text-slate-900"
                        >
                          {row.invoiceNumber}
                        </Link>
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                          Already paid
                        </span>
                      </td>
                      <td className={tableCellClassName}>{row.ticketNumber}</td>
                      <td className={tableCellClassName}>{row.customerName}</td>
                      <td className={tableCellClassName}>{formatMoney(row.total)}</td>
                      <td className={tableCellClassName}>
                        <StatusBadge label="PAID" variant="success" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>
      ) : null}
    </div>
  );
}

function FinalInvoicesTab({
  invoices,
  pageInfo,
  initialStatus,
  canManage,
}: {
  invoices: InvoiceListRow[];
  pageInfo: PageInfo;
  initialStatus: string;
  canManage: boolean;
}) {
  const confirm = useConfirm();
  const { setParams } = useListQuery();
  const statusFilter =
    initialStatus === "SENT" ||
    initialStatus === "PAID" ||
    initialStatus === "VOID"
      ? initialStatus
      : "ALL";
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Local date, not UTC — an evening print should default to today.
  const [printDay, setPrintDay] = useState(
    new Date().toLocaleDateString("en-CA"),
  );
  const [printPending, setPrintPending] = useState(false);

  async function printAllForDay() {
    if (!printDay || printPending) {
      return;
    }
    setMessage(null);
    setPrintPending(true);
    try {
      const url = `/api/invoices/final-batch/pdf?date=${printDay}`;
      // Probe first so an empty day shows a message instead of printing an
      // error page.
      const response = await fetch(url);
      if (!response.ok) {
        setMessage(await response.text());
        return;
      }
      printPdfUrl(url);
    } catch {
      setMessage("Could not generate the invoice batch PDF.");
    } finally {
      setPrintPending(false);
    }
  }

  const filtered = invoices;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "SENT", "PAID", "VOID"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setParams({ status: status === "ALL" ? null : status })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              statusFilter === status
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {status === "ALL" ? "All" : status === "SENT" ? "Final" : status}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <label htmlFor="print-day" className="font-medium">
            Invoice date
          </label>
          <input
            id="print-day"
            type="date"
            value={printDay}
            onChange={(event) => setPrintDay(event.target.value)}
            className="rounded border border-slate-200 px-2 py-1"
          />
          <button
            type="button"
            disabled={!printDay || printPending}
            onClick={printAllForDay}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {printPending ? "Preparing…" : "Print all for day"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {message}
        </p>
      ) : null}

      <SectionCard title="Invoices" noPadding>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No finalized invoices yet.
          </p>
        ) : (
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Invoice</th>
                  <th className={tableHeaderCellClassName}>Ticket</th>
                  <th className={tableHeaderCellClassName}>Customer</th>
                  <th className={tableHeaderCellClassName}>Invoice date</th>
                  <th className={tableHeaderCellClassName}>Total</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={tableHeaderCellClassName}>Actions</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {filtered.map((row) => (
                  <tr key={row.id} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-medium`}>
                      <Link
                        href={`/invoices/${row.id}`}
                        className="text-slate-900 hover:text-slate-700"
                      >
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className={tableCellClassName}>{row.ticketNumber}</td>
                    <td className={tableCellClassName}>
                      {row.customerName}
                      <span className="block text-slate-500">
                        {row.projectName}
                      </span>
                    </td>
                    <td className={tableCellClassName}>{formatDate(row.invoiceDate)}</td>
                    <td className={`${tableCellClassName} font-medium`}>
                      {formatMoney(row.total)}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge
                        label={row.status === "SENT" ? "Final" : row.status}
                        variant={
                          row.status === "PAID"
                            ? "success"
                            : row.status === "VOID"
                              ? "neutral"
                              : "info"
                        }
                      />
                    </td>
                    <td className={tableCellClassName}>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/api/invoices/${row.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-700 underline hover:text-slate-900"
                        >
                          View PDF
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            printPdfUrl(`/api/invoices/${row.id}/pdf`)
                          }
                          className="text-slate-700 underline hover:text-slate-900"
                        >
                          Print
                        </button>
                        {canManage && row.status === "SENT" ? (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  const { markInvoicePaid } = await import(
                                    "@/app/invoices/actions"
                                  );
                                  const result = await markInvoicePaid(row.id);
                                  setMessage(
                                    result.error ?? "Marked paid.",
                                  );
                                });
                              }}
                              className="text-emerald-700 underline hover:text-emerald-900 disabled:opacity-50"
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={async () => {
                                if (
                                  !(await confirm({
                                    title: "Void invoice?",
                                    message: `Void invoice ${row.invoiceNumber}?`,
                                    confirmLabel: "Void invoice",
                                    variant: "danger",
                                  }))
                                ) {
                                  return;
                                }
                                startTransition(async () => {
                                  const { voidInvoice } = await import(
                                    "@/app/invoices/actions"
                                  );
                                  const result = await voidInvoice(row.id);
                                  setMessage(result.error ?? "Invoice voided.");
                                });
                              }}
                              className="text-red-700 underline hover:text-red-900 disabled:opacity-50"
                            >
                              Void
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="invoice"
        />
      </SectionCard>
    </div>
  );
}

function ReconcileTab({
  data,
  canManageInvoices,
}: {
  data: ReconcileTabData;
  canManageInvoices: boolean;
}) {
  const { setParams } = useListQuery();
  const [fromInput, setFromInput] = useState(data.from);
  const [toInput, setToInput] = useState(data.to);

  if (!data.allowed) {
    return (
      <p className="text-sm text-slate-500">
        You need delivery management permission to reconcile delivery days.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Date</span>
        <input
          type="date"
          value={fromInput}
          onChange={(event) => setFromInput(event.target.value)}
          aria-label="Reconcile date from"
          className="rounded border border-slate-200 px-2 py-1"
        />
        <span>to</span>
        <input
          type="date"
          value={toInput}
          onChange={(event) => setToInput(event.target.value)}
          aria-label="Reconcile date to"
          className="rounded border border-slate-200 px-2 py-1"
        />
        <button
          type="button"
          onClick={() =>
            setParams({
              date: fromInput || null,
              dateTo: toInput || null,
              all: null,
              unreconciled: null,
            })
          }
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50"
        >
          Go
        </button>
        <button
          type="button"
          onClick={() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            // Local date, not UTC — matches how the page resolves "today".
            const date = yesterday.toLocaleDateString("en-CA");
            setFromInput(date);
            setToInput("");
            setParams({ date, dateTo: null, all: null, unreconciled: null });
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50"
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => {
            setFromInput("");
            setToInput("");
            setParams({ date: null, dateTo: null, all: null, unreconciled: null });
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            setFromInput("");
            setToInput("");
            setParams({ all: "1", date: null, dateTo: null, unreconciled: null });
          }}
          className={`rounded-lg px-3 py-1.5 font-medium ${
            data.mode === "all"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          View all
        </button>
        <button
          type="button"
          onClick={() => {
            setFromInput("");
            setToInput("");
            setParams({ unreconciled: "1", all: null, date: null, dateTo: null });
          }}
          className={`rounded-lg px-3 py-1.5 font-medium ${
            data.mode === "unreconciled"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          View all Unreconciled Days
        </button>
        {data.mode === "range" ? (
          <span className="text-slate-500">
            Showing {data.from} – {data.to}
          </span>
        ) : null}
      </div>

      {data.truncated ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Showing the most recent days only — narrow the date range to see
          older tickets.
        </p>
      ) : null}

      {data.days.length === 0 ? (
        <p className="text-sm text-slate-500">
          {data.mode === "day"
            ? "No delivery tickets for this date."
            : data.mode === "unreconciled"
              ? "No unreconciled days — every delivery day is confirmed."
              : "No delivery tickets in this range."}
        </p>
      ) : (
        data.days.map((day) => (
          <ReconcileDay
            key={day.date}
            date={day.date}
            scheduledTickets={day.scheduledTickets}
            deliveredOtherDayTickets={day.deliveredOtherDayTickets}
            reconciliation={day.reconciliation}
            canManageInvoices={canManageInvoices}
          />
        ))
      )}
    </div>
  );
}

export function InvoicesTabs({
  invoices,
  paidWalkIns,
  pageInfo,
  tabCounts,
  initialTab,
  initialStatus,
  canManage,
  draftFrom,
  draftTo,
  reconcile,
}: InvoicesTabsProps) {
  const { setParams } = useListQuery();
  const tab = initialTab;

  const tabButtonClassName = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium ${
      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() =>
            setParams({ tab: "reconcile", from: null, to: null, status: null })
          }
          className={tabButtonClassName(tab === "reconcile")}
        >
          Reconcile Day
        </button>
        <button
          type="button"
          onClick={() =>
            setParams({ tab: "drafts", date: null, dateTo: null, all: null })
          }
          className={tabButtonClassName(tab === "drafts")}
        >
          Draft Review ({tabCounts.drafts})
        </button>
        <button
          type="button"
          onClick={() =>
            setParams({
              tab: "final",
              status: null,
              from: null,
              to: null,
              date: null,
              dateTo: null,
              all: null,
            })
          }
          className={tabButtonClassName(tab === "final")}
        >
          Invoices ({tabCounts.finals})
        </button>
      </div>

      {tab === "drafts" ? (
        <DraftReviewTab
          drafts={invoices}
          paidWalkIns={paidWalkIns}
          pageInfo={pageInfo}
          canManage={canManage}
          draftFrom={draftFrom}
          draftTo={draftTo}
        />
      ) : tab === "reconcile" && reconcile ? (
        <ReconcileTab data={reconcile} canManageInvoices={canManage} />
      ) : (
        <FinalInvoicesTab
          invoices={invoices}
          pageInfo={pageInfo}
          initialStatus={initialStatus}
          canManage={canManage}
        />
      )}
    </div>
  );
}
