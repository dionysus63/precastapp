"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import { useListQuery } from "@/components/common/use-list-query";
import { markInvoicePaid, type InvoiceListRow } from "@/app/invoices/actions";
import {
  ReconcileDay,
  type ReconcileTicket,
} from "@/components/delivery-tickets/reconcile-day";
import {
  INVOICE_LIST_FILTERS,
  invoiceStatusLabel,
  invoiceStatusVariant,
  isUnpaidInvoiceStatus,
  type InvoiceFilterCounts,
  type InvoiceListFilter,
} from "@/lib/invoice-status";
import { printPdfUrl } from "@/lib/print-pdf-url";
import {
  addLocalDays,
  localTodayInput,
  toLocalDayInput,
} from "@/lib/date-only";
import type { PageInfo } from "@/lib/list-params";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
import { reloadAfterAction } from "@/lib/reload-after-action";

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
  pageInfo: PageInfo;
  filterCounts: InvoiceFilterCounts;
  initialTab: "invoices" | "reconcile";
  filter: InvoiceListFilter;
  canManage: boolean;
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
  if (badges.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded bg-amber-50 px-1.5 py-0.5 text-3xs text-amber-800"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

const rowLinkClassName = "text-slate-700 underline hover:text-slate-900";

/**
 * The one Invoices list. An invoice is here the moment its ticket is marked
 * delivered — there is no draft stage and nothing to finalize. "Price needed"
 * holds the ones with a line the app could not price.
 */
function InvoicesListTab({
  invoices,
  pageInfo,
  filter,
  filterCounts,
  canManage,
}: {
  invoices: InvoiceListRow[];
  pageInfo: PageInfo;
  filter: InvoiceListFilter;
  filterCounts: InvoiceFilterCounts;
  canManage: boolean;
}) {
  const { setParams } = useListQuery();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Local date, not UTC — an evening print should default to today.
  const [printDay, setPrintDay] = useState(localTodayInput);
  const [printPending, setPrintPending] = useState(false);

  async function printAllForDay() {
    if (!printDay || printPending) {
      return;
    }
    setMessage(null);
    setPrintPending(true);
    try {
      const url = `/api/invoices/day-batch/pdf?date=${printDay}`;
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

  // Void is the rare one: its chip only shows when there is something in it
  // (or it is the view being looked at).
  const chips = INVOICE_LIST_FILTERS.filter(
    (chip) =>
      chip.value !== "VOID" || filterCounts.VOID > 0 || filter === "VOID",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={filter === chip.value}
            onClick={() =>
              setParams({ status: chip.value === "ALL" ? null : chip.value })
            }
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filter === chip.value
                ? "bg-slate-900 text-white"
                : chip.value === "PRICE_NEEDED" && filterCounts.PRICE_NEEDED > 0
                  ? "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {chip.label} ({filterCounts[chip.value].toLocaleString()})
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <label htmlFor="print-day" className="font-medium">
            Made on
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
            title="Prints the Invoice Summary page, then every invoice made on that day"
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
        {invoices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            {filter === "ALL"
              ? "No invoices yet. A ticket gets its invoice when it is marked delivered."
              : filter === "PRICE_NEEDED"
                ? "No invoice is waiting for a price."
                : "No invoices in this view."}
          </p>
        ) : (
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Invoice</th>
                  <th className={tableHeaderCellClassName}>Ticket</th>
                  <th className={tableHeaderCellClassName}>Contractor / job</th>
                  <th className={tableHeaderCellClassName}>Price</th>
                  <th className={tableHeaderCellClassName}>Tax</th>
                  <th className={tableHeaderCellClassName}>Total</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={tableHeaderCellClassName}>Actions</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {invoices.map((row) => {
                  const unpaid = isUnpaidInvoiceStatus(row.status);
                  const needsPrice = row.priceNeededItems.length > 0;
                  return (
                    <tr key={row.id} className={tableRowClassName}>
                      <td className={`${tableCellClassName} font-medium`}>
                        <Link
                          href={`/invoices/${row.id}`}
                          className="text-slate-900 hover:text-slate-700"
                        >
                          {row.invoiceNumber}
                        </Link>
                        <InvoiceBadges row={row} />
                      </td>
                      <td className={tableCellClassName}>
                        {row.ticketNumber}
                        <span className="block text-slate-500">
                          {formatDate(row.deliveryDate)}
                        </span>
                      </td>
                      <td className={tableCellClassName}>
                        {row.customerName}
                        <span className="block text-slate-500">
                          {row.projectName}
                        </span>
                      </td>
                      <td className={`${tableCellClassName} tabular-nums`}>
                        {formatMoney(row.price)}
                      </td>
                      <td className={`${tableCellClassName} tabular-nums`}>
                        {formatMoney(row.salesTax)}
                      </td>
                      <td
                        className={`${tableCellClassName} font-medium tabular-nums`}
                      >
                        {formatMoney(row.total)}
                      </td>
                      <td className={tableCellClassName}>
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge
                            label={invoiceStatusLabel(row.status)}
                            variant={invoiceStatusVariant(row.status)}
                          />
                          {needsPrice ? (
                            <span
                              title={`No price yet for: ${row.priceNeededItems.join(", ")}`}
                            >
                              <StatusBadge
                                label="Price needed"
                                variant="warning"
                              />
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className={tableCellClassName}>
                        <div className="flex flex-wrap gap-2">
                          {canManage && unpaid ? (
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
                            className={rowLinkClassName}
                          >
                            View PDF
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              printPdfUrl(`/api/invoices/${row.id}/pdf`)
                            }
                            className={rowLinkClassName}
                          >
                            Print
                          </button>
                          {canManage && unpaid && !needsPrice ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await markInvoicePaid(row.id);
                                  if (result.error) {
                                    setMessage(result.error);
                                    return;
                                  }
                                  reloadAfterAction({
                                    type: "success",
                                    text: `Invoice ${row.invoiceNumber} marked paid.`,
                                  });
                                });
                              }}
                              className="text-emerald-700 underline hover:text-emerald-900 disabled:opacity-50"
                            >
                              Mark paid
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            // Local date, not UTC — matches how the page resolves "today".
            const date = toLocalDayInput(addLocalDays(new Date(), -1));
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
  pageInfo,
  filterCounts,
  initialTab,
  filter,
  canManage,
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
          onClick={() => setParams({ tab: "reconcile", status: null })}
          className={tabButtonClassName(tab === "reconcile")}
        >
          Reconcile Day
        </button>
        <button
          type="button"
          onClick={() =>
            setParams({
              tab: null,
              status: null,
              date: null,
              dateTo: null,
              all: null,
              unreconciled: null,
            })
          }
          className={tabButtonClassName(tab === "invoices")}
        >
          Invoices ({filterCounts.ALL.toLocaleString()})
        </button>
      </div>

      {tab === "reconcile" && reconcile ? (
        <ReconcileTab data={reconcile} canManageInvoices={canManage} />
      ) : (
        <InvoicesListTab
          invoices={invoices}
          pageInfo={pageInfo}
          filter={filter}
          filterCounts={filterCounts}
          canManage={canManage}
        />
      )}
    </div>
  );
}
