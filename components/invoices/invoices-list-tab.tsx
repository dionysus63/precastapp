"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import { PdfDragChip } from "@/components/common/pdf-drag-chip";
import { useListQuery } from "@/components/common/use-list-query";
import {
  listInvoiceSelectionForView,
  markInvoicePaid,
  type InvoiceListRow,
  type InvoiceSearchSuggestions,
} from "@/app/invoices/actions";
import {
  InvoiceListPreview,
  type InvoicePreviewSide,
} from "@/components/invoices/invoice-list-preview";
import { InvoiceListSearchBar } from "@/components/invoices/invoice-list-search-bar";
import { localTodayInput } from "@/lib/date-only";
import { formatUsd } from "@/lib/format";
import { useStoredFlag } from "@/lib/hooks/use-stored-flag";
import {
  hasInvoiceListSearch,
  MAX_SELECTED_INVOICES,
  selectedInvoicesFileName,
  selectedInvoicesPdfUrl,
  type InvoiceListSearch,
} from "@/lib/invoice-list-search";
import {
  INVOICE_LIST_FILTERS,
  invoiceStatusLabel,
  invoiceStatusVariant,
  isUnpaidInvoiceStatus,
  type InvoiceFilterCounts,
  type InvoiceListFilter,
} from "@/lib/invoice-status";
import type { PageInfo } from "@/lib/list-params";
import { printPdfUrl } from "@/lib/print-pdf-url";
import { reloadAfterAction } from "@/lib/reload-after-action";
import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
import { selectedWithBorderClassName } from "@/lib/selected-styles";

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

const barButtonClassName =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const barPrimaryButtonClassName =
  "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * "List | paper", side by side from a 1024px window up. The list keeps 69.5rem
 * (its columns without a sideways scroll) wherever the window has it; the
 * paper takes what is left, up to 38%, and never less than 22rem. On a
 * narrower window the paper stacks above the list.
 */
const previewSplitClassName =
  "grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_min(38%,max(22rem,calc(100%_-_70.25rem)))]";

/**
 * The list with the paper hidden: exactly as wide as it is beside the paper
 * (the whole width less the paper's column and the gap), so hiding the
 * preview moves nothing. Only where that is too narrow for the columns does
 * the list take the room the paper gave up, up to its 69.5rem.
 */
const listAloneClassName =
  "lg:w-[max(calc(100%_-_min(38%,max(22rem,calc(100%_-_70.25rem)))_-_0.75rem),min(100%,69.5rem))]";

/** Remembered per computer: the preview pane beside the list is hidden. */
const PREVIEW_HIDDEN_KEY = "precastapp:invoice-list-preview-hidden";

function stop(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/**
 * The one Invoices list. An invoice is here the moment its ticket is marked
 * delivered — there is no draft stage and nothing to finalize. "Price needed"
 * holds the ones with a line the app could not price.
 *
 * Above it: the status chips and the search boxes (contractor, job, invoice
 * dates, totals). Beside it: the clicked invoice as it prints, or its signed
 * ticket. Tick boxes pick invoices to print or download as one PDF; the
 * ticks stay while paging and filtering.
 */
export function InvoicesListTab({
  invoices,
  pageInfo,
  filter,
  search,
  filterCounts,
  suggestions,
  canManage,
}: {
  invoices: InvoiceListRow[];
  pageInfo: PageInfo;
  filter: InvoiceListFilter;
  search: InvoiceListSearch;
  filterCounts: InvoiceFilterCounts;
  suggestions: InvoiceSearchSuggestions;
  canManage: boolean;
}) {
  const { setParams } = useListQuery();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Local date, not UTC — an evening print should default to today.
  const [printDay, setPrintDay] = useState(localTodayInput);
  const [printPending, setPrintPending] = useState(false);

  /** Ticked invoices, id -> invoice number, across pages and filters. */
  const [ticked, setTicked] = useState<ReadonlyMap<string, string>>(new Map());
  const [selectingAll, setSelectingAll] = useState(false);

  const [previewHidden, setPreviewHidden] = useStoredFlag(
    PREVIEW_HIDDEN_KEY,
    false,
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [side, setSide] = useState<InvoicePreviewSide>("invoice");

  const searching = hasInvoiceListSearch(search);
  const showPreview = !previewHidden && invoices.length > 0;
  // Nothing clicked yet (or the clicked one is on another page): the first row.
  const previewAt = Math.max(
    0,
    invoices.findIndex((row) => row.id === previewId),
  );
  const previewRow = showPreview ? (invoices[previewAt] ?? null) : null;

  function showRow(row: InvoiceListRow, nextSide: InvoicePreviewSide) {
    setPreviewId(row.id);
    setSide(nextSide);
    if (previewHidden) {
      setPreviewHidden(false);
    }
  }

  function stepPreview(delta: number) {
    const next = invoices[previewAt + delta];
    if (next) {
      setPreviewId(next.id);
    }
  }

  // --- Tick boxes -----------------------------------------------------------

  const tickedIds = [...ticked.keys()];
  const tickedCount = tickedIds.length;
  const tickedOnPage = invoices.filter((row) => ticked.has(row.id)).length;
  const tickedElsewhere = tickedCount - tickedOnPage;
  const allOnPageTicked =
    invoices.length > 0 && tickedOnPage === invoices.length;
  const tooMany = tickedCount > MAX_SELECTED_INVOICES;
  const canUseTicked = tickedCount > 0 && !tooMany;
  /** The view holds more than this page, and not all of it is ticked yet. */
  const offerWholeView =
    pageInfo.total > invoices.length &&
    pageInfo.total <= MAX_SELECTED_INVOICES &&
    tickedCount < pageInfo.total;

  function setRowTicked(row: InvoiceListRow, on: boolean) {
    setTicked((current) => {
      const next = new Map(current);
      if (on) {
        next.set(row.id, row.invoiceNumber);
      } else {
        next.delete(row.id);
      }
      return next;
    });
  }

  function setPageTicked(on: boolean) {
    setTicked((current) => {
      const next = new Map(current);
      for (const row of invoices) {
        if (on) {
          next.set(row.id, row.invoiceNumber);
        } else {
          next.delete(row.id);
        }
      }
      return next;
    });
  }

  async function tickWholeView() {
    if (selectingAll) {
      return;
    }
    setMessage(null);
    setSelectingAll(true);
    try {
      const result = await listInvoiceSelectionForView({ filter, search });
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setTicked((current) => {
        const next = new Map(current);
        for (const invoice of result.invoices) {
          next.set(invoice.id, invoice.invoiceNumber);
        }
        return next;
      });
    } catch {
      setMessage("Could not load the invoices in this view.");
    } finally {
      setSelectingAll(false);
    }
  }

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

  const tickedHint =
    tickedCount === 0
      ? "Tick invoices to print or download them together."
      : `${tickedCount.toLocaleString()} selected${
          tickedElsewhere > 0
            ? ` (${tickedElsewhere.toLocaleString()} not on this page)`
            : ""
        }${tooMany ? `. At most ${MAX_SELECTED_INVOICES} at a time.` : ""}`;

  return (
    // The paper sits to the right of everything else, from the tabs down, so
    // a whole page fits the window. The list is on the left and stays where
    // it is when the preview is hidden.
    <div className={showPreview ? previewSplitClassName : listAloneClassName}>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={filter === chip.value}
              onClick={() =>
                setParams({
                  tab: "invoices",
                  status: chip.value === "ALL" ? null : chip.value,
                })
              }
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                filter === chip.value
                  ? selectedWithBorderClassName
                  : chip.value === "PRICE_NEEDED" &&
                      filterCounts.PRICE_NEEDED > 0
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

        <InvoiceListSearchBar search={search} suggestions={suggestions} />

        {message ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {message}
          </p>
        ) : null}

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Invoices</h3>
            <p
              className={`text-xs ${tooMany ? "text-red-700" : "text-slate-500"}`}
              aria-live="polite"
            >
              {tickedHint}
            </p>
            {offerWholeView ? (
              <button
                type="button"
                disabled={selectingAll}
                onClick={() => void tickWholeView()}
                className="text-xs text-sky-700 underline hover:text-sky-900 disabled:opacity-50"
              >
                {selectingAll
                  ? "Selecting…"
                  : `Select all ${pageInfo.total.toLocaleString()} in this view`}
              </button>
            ) : null}
            {tickedCount > 0 ? (
              <button
                type="button"
                onClick={() => setTicked(new Map())}
                className="text-xs text-sky-700 underline hover:text-sky-900"
              >
                Clear selection
              </button>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canUseTicked}
                onClick={() => printPdfUrl(selectedInvoicesPdfUrl(tickedIds))}
                title="Prints the ticked invoices as one job, in invoice number order"
                className={barPrimaryButtonClassName}
              >
                Print Selected{tickedCount > 0 ? ` (${tickedCount})` : ""}
              </button>
              {canUseTicked ? (
                <PdfDragChip
                  href={selectedInvoicesPdfUrl(tickedIds, { download: true })}
                  fileName={selectedInvoicesFileName([...ticked.values()])}
                  title="The ticked invoices as one PDF: click to save it, or drag it into an email or a folder"
                  label={`Download Selected (${tickedCount})`}
                  preparingLabel="Preparing…"
                  className={barButtonClassName}
                />
              ) : (
                <button type="button" disabled className={barButtonClassName}>
                  Download Selected
                </button>
              )}
              {invoices.length > 0 ? (
                // One button in one place for both: it does not jump away
                // from under the pointer, and nothing beside it shifts.
                <button
                  type="button"
                  aria-pressed={!previewHidden}
                  onClick={() => setPreviewHidden(!previewHidden)}
                  title={
                    previewHidden
                      ? "Show the clicked invoice to the right of the list"
                      : "Hide the preview on the right"
                  }
                  className={`${barButtonClassName} min-w-[7.5rem]`}
                >
                  {previewHidden ? "Show preview" : "Hide preview"}
                </button>
              ) : null}
            </div>
          </div>

          {invoices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {searching
                ? "No invoices match these filters."
                : filter === "ALL"
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
                    <th className={`${tableHeaderCellClassName} w-8 px-0 py-0`}>
                      <label
                        className="flex cursor-pointer items-center justify-center px-2 py-1.5"
                        title={
                          allOnPageTicked
                            ? "Untick every invoice on this page"
                            : "Tick every invoice on this page"
                        }
                      >
                        <input
                          type="checkbox"
                          aria-label="Select every invoice on this page"
                          checked={allOnPageTicked}
                          ref={(element) => {
                            if (element) {
                              element.indeterminate =
                                tickedOnPage > 0 && !allOnPageTicked;
                            }
                          }}
                          onChange={(event) =>
                            setPageTicked(event.target.checked)
                          }
                          className="h-4 w-4 cursor-pointer accent-slate-900"
                        />
                      </label>
                    </th>
                    <th className={tableHeaderCellClassName}>Invoice · Date</th>
                    <th className={tableHeaderCellClassName}>
                      Contractor / job
                    </th>
                    <th className={tableHeaderCellClassName}>Price</th>
                    <th className={tableHeaderCellClassName}>Tax</th>
                    <th className={tableHeaderCellClassName}>Total</th>
                    <th className={tableHeaderCellClassName}>Status</th>
                    <th className={tableHeaderCellClassName}>Signed ticket</th>
                    <th className={tableHeaderCellClassName}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {invoices.map((row) => {
                    const unpaid = isUnpaidInvoiceStatus(row.status);
                    const needsPrice = row.priceNeededItems.length > 0;
                    const isTicked = ticked.has(row.id);
                    const inPreview = previewRow?.id === row.id;
                    const shade = inPreview ? "bg-sky-50" : "";
                    const cell = `${tableCellClassName} ${shade}`;
                    return (
                      <tr
                        key={row.id}
                        tabIndex={showPreview ? 0 : undefined}
                        aria-selected={showPreview ? inPreview : undefined}
                        onClick={
                          showPreview
                            ? () => showRow(row, "invoice")
                            : undefined
                        }
                        onKeyDown={
                          showPreview
                            ? (event) => {
                                if (
                                  event.target === event.currentTarget &&
                                  (event.key === "Enter" || event.key === " ")
                                ) {
                                  event.preventDefault();
                                  showRow(row, "invoice");
                                }
                              }
                            : undefined
                        }
                        className={`align-top outline-none hover:bg-slate-50/60 focus-visible:bg-sky-50/60 ${
                          showPreview ? "cursor-pointer" : ""
                        }`}
                      >
                        <td
                          onClick={stop}
                          className={`${tableCellBordersClassName} ${shade} w-8 p-0 ${
                            inPreview ? "shadow-[inset_3px_0_0_#0284c7]" : ""
                          }`}
                        >
                          <label className="flex cursor-pointer items-center justify-center px-2 py-2">
                            <input
                              type="checkbox"
                              aria-label={`Select invoice ${row.invoiceNumber}`}
                              checked={isTicked}
                              onChange={(event) =>
                                setRowTicked(row, event.target.checked)
                              }
                              className="h-4 w-4 cursor-pointer accent-slate-900"
                            />
                          </label>
                        </td>
                        <td className={`${cell} whitespace-nowrap font-medium`}>
                          <Link
                            href={`/invoices/${row.id}`}
                            onClick={stop}
                            className="text-slate-900 hover:text-slate-700"
                          >
                            {row.invoiceNumber}
                          </Link>
                          <span
                            className="block font-normal text-slate-500"
                            title="Invoice date"
                          >
                            {formatDate(row.invoiceDate)}
                          </span>
                          <InvoiceBadges row={row} />
                        </td>
                        <td className={`${cell} min-w-[10rem]`}>
                          {row.customerName}
                          <span className="block text-slate-500">
                            {row.projectName}
                          </span>
                        </td>
                        <td
                          className={`${cell} whitespace-nowrap tabular-nums`}
                        >
                          {formatUsd(row.price)}
                        </td>
                        <td
                          className={`${cell} whitespace-nowrap tabular-nums`}
                        >
                          {formatUsd(row.salesTax)}
                        </td>
                        <td
                          className={`${cell} whitespace-nowrap font-medium tabular-nums`}
                        >
                          {formatUsd(row.total)}
                        </td>
                        <td className={`${cell} whitespace-nowrap`}>
                          <div className="flex items-center gap-1">
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
                        <td className={`${cell} whitespace-nowrap`}>
                          {row.signedTicket ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                showRow(row, "signed");
                              }}
                              title={`Show the signed copy of ticket ${row.ticketNumber} beside the list`}
                              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-900 hover:bg-emerald-100"
                            >
                              Signed Ticket
                            </button>
                          ) : (
                            <span
                              title={`No signed copy of ticket ${row.ticketNumber} has been scanned in`}
                              className="text-2xs font-semibold tracking-wide text-slate-400"
                            >
                              NOT AVAILABLE
                            </span>
                          )}
                        </td>
                        <td className={`${cell} whitespace-nowrap`}>
                          <div className="flex gap-2">
                            {canManage && unpaid ? (
                              <Link
                                href={`/invoices/${row.id}/edit`}
                                onClick={stop}
                                className="text-sky-700 underline hover:text-sky-900"
                              >
                                Edit
                              </Link>
                            ) : null}
                            <a
                              href={`/api/invoices/${row.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={stop}
                              className={rowLinkClassName}
                            >
                              View PDF
                            </a>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                printPdfUrl(`/api/invoices/${row.id}/pdf`);
                              }}
                              className={rowLinkClassName}
                            >
                              Print
                            </button>
                            {canManage && unpaid && !needsPrice ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startTransition(async () => {
                                    const result = await markInvoicePaid(
                                      row.id,
                                    );
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
        </section>
      </div>

      {showPreview ? (
        <div className="max-lg:order-first lg:sticky lg:top-[82px]">
          <InvoiceListPreview
            row={previewRow}
            side={side}
            onSideChange={setSide}
            onPrevious={() => stepPreview(-1)}
            onNext={() => stepPreview(1)}
            hasPrevious={previewAt > 0}
            hasNext={previewAt < invoices.length - 1}
          />
        </div>
      ) : null}
    </div>
  );
}
