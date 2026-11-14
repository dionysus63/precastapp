"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvoiceSearchSuggestions } from "@/app/invoices/actions";
import { useListQuery } from "@/components/common/use-list-query";
import {
  hasInvoiceListSearch,
  INVOICE_LIST_SEARCH_KEYS,
  parseMoneyInput,
  type InvoiceListSearch,
} from "@/lib/invoice-list-search";

/** How long typing must pause before the list is searched again. */
const TYPING_PAUSE_MS = 400;
const DATE_PAUSE_MS = 700;

const labelClassName = "block text-xs font-medium text-slate-600";

function boxClassName(active: boolean, width: string): string {
  return `${width} rounded border px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 ${
    active ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
  }`;
}

type Sync = { committed: InvoiceListSearch; sent: InvoiceListSearch };

/**
 * The six boxes as one value that lives in the address. What is typed is kept
 * here and sent, all boxes together, once typing pauses. A change that comes
 * from somewhere else (Clear filters, the back button) replaces what is in
 * that box, while our own search coming back never overwrites what was typed
 * since. An amount that is not an amount yet is held back until it is one.
 */
function useSearchBoxes(
  committed: InvoiceListSearch,
): [InvoiceListSearch, (key: keyof InvoiceListSearch, value: string) => void] {
  const { setParams } = useListQuery();
  const [drafts, setDrafts] = useState(committed);
  const [sync, setSync] = useState<Sync>({ committed, sent: committed });

  if (
    INVOICE_LIST_SEARCH_KEYS.some(
      (key) => committed[key] !== sync.committed[key],
    )
  ) {
    const next = { ...drafts };
    for (const key of INVOICE_LIST_SEARCH_KEYS) {
      if (
        committed[key] !== sync.committed[key] &&
        committed[key] !== sync.sent[key]
      ) {
        next[key] = committed[key];
      }
    }
    setSync({ committed, sent: committed });
    setDrafts(next);
  }

  useEffect(() => {
    const wanted = { ...committed };
    for (const key of INVOICE_LIST_SEARCH_KEYS) {
      const value = drafts[key].trim();
      const isAmount = key === "min" || key === "max";
      if (value === "" || !isAmount || parseMoneyInput(value) != null) {
        wanted[key] = value;
      }
    }
    const changed = INVOICE_LIST_SEARCH_KEYS.filter(
      (key) => wanted[key] !== committed[key],
    );
    if (changed.length === 0) {
      return;
    }
    // A date box reports a (far too early) year after each digit typed, so
    // it waits a little longer than the others.
    const delay = changed.some((key) => key === "from" || key === "to")
      ? DATE_PAUSE_MS
      : TYPING_PAUSE_MS;
    const timer = window.setTimeout(() => {
      setSync((current) => ({ ...current, sent: wanted }));
      setParams({ tab: "invoices", ...wanted });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [drafts, committed, setParams]);

  const setDraft = useCallback(
    (key: keyof InvoiceListSearch, value: string) =>
      setDrafts((current) => ({ ...current, [key]: value })),
    [],
  );
  return [drafts, setDraft];
}

const acceptMoney = (value: string) => parseMoneyInput(value) != null;

/**
 * The search boxes above the Invoices list: contractor, job, a range of
 * invoice dates and a range of totals. Every box that has something in it
 * must match, on top of the status chip.
 */
export function InvoiceListSearchBar({
  search,
  suggestions,
}: {
  search: InvoiceListSearch;
  suggestions: InvoiceSearchSuggestions;
}) {
  const { setParams } = useListQuery();
  const [drafts, setDraft] = useSearchBoxes(search);
  const { customer, job, from, to, min, max } = drafts;
  const setCustomer = (value: string) => setDraft("customer", value);
  const setJob = (value: string) => setDraft("job", value);
  const setFrom = (value: string) => setDraft("from", value);
  const setTo = (value: string) => setDraft("to", value);
  const setMin = (value: string) => setDraft("min", value);
  const setMax = (value: string) => setDraft("max", value);

  const minBad = min.trim() !== "" && !acceptMoney(min.trim());
  const maxBad = max.trim() !== "" && !acceptMoney(max.trim());

  return (
    <div
      role="search"
      aria-label="Filter invoices"
      className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
    >
      <div>
        <label htmlFor="invoice-search-customer" className={labelClassName}>
          Contractor
        </label>
        <input
          id="invoice-search-customer"
          type="search"
          list="invoice-search-customers"
          value={customer}
          onChange={(event) => setCustomer(event.target.value)}
          placeholder="Any contractor"
          autoComplete="off"
          className={boxClassName(search.customer !== "", "w-52")}
        />
        <datalist id="invoice-search-customers">
          {suggestions.customers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="invoice-search-job" className={labelClassName}>
          Job
        </label>
        <input
          id="invoice-search-job"
          type="search"
          list="invoice-search-jobs"
          value={job}
          onChange={(event) => setJob(event.target.value)}
          placeholder="Job name or number"
          autoComplete="off"
          className={boxClassName(search.job !== "", "w-52")}
        />
        <datalist id="invoice-search-jobs">
          {suggestions.jobs.map((entry) => (
            <option
              key={`${entry.jobNumber ?? ""}|${entry.projectName}`}
              value={entry.projectName}
              label={entry.jobNumber ?? undefined}
            />
          ))}
        </datalist>
      </div>

      <div>
        <span className={labelClassName}>Invoice date</span>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="date"
            aria-label="Invoice date from"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            className={boxClassName(search.from !== "", "w-[8.5rem]")}
          />
          to
          <input
            type="date"
            aria-label="Invoice date to"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            className={boxClassName(search.to !== "", "w-[8.5rem]")}
          />
        </div>
      </div>

      <div>
        <span className={labelClassName}>Total $</span>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Lowest total"
            aria-invalid={minBad || undefined}
            value={min}
            onChange={(event) => setMin(event.target.value)}
            placeholder="From"
            autoComplete="off"
            className={`${boxClassName(search.min !== "", "w-24")} tabular-nums ${minBad ? "border-red-400" : ""}`}
          />
          to
          <input
            type="text"
            inputMode="decimal"
            aria-label="Highest total"
            aria-invalid={maxBad || undefined}
            value={max}
            onChange={(event) => setMax(event.target.value)}
            placeholder="To"
            autoComplete="off"
            className={`${boxClassName(search.max !== "", "w-24")} tabular-nums ${maxBad ? "border-red-400" : ""}`}
          />
        </div>
      </div>

      {hasInvoiceListSearch(search) ? (
        <button
          type="button"
          onClick={() =>
            setParams({
              tab: "invoices",
              ...Object.fromEntries(
                INVOICE_LIST_SEARCH_KEYS.map((key) => [key, null]),
              ),
            })
          }
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
