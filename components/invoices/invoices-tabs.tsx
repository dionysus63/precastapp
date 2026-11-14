"use client";

import { useCallback, useState } from "react";
import { useListQuery } from "@/components/common/use-list-query";
import type {
  InvoiceListRow,
  InvoiceSearchSuggestions,
} from "@/app/invoices/actions";
import { InvoicesListTab } from "@/components/invoices/invoices-list-tab";
import { ScanInTab } from "@/components/invoices/scan-in/scan-in-tab";
import {
  INVOICE_LIST_SEARCH_KEYS,
  type InvoiceListSearch,
} from "@/lib/invoice-list-search";
import type {
  InvoiceFilterCounts,
  InvoiceListFilter,
} from "@/lib/invoice-status";
import type { PageInfo } from "@/lib/list-params";
import type { ScanInView } from "@/lib/ticket-scan/view-types";

type InvoicesTabsProps = {
  invoices: InvoiceListRow[];
  pageInfo: PageInfo;
  /** One count per status chip, inside the search that is on. */
  filterCounts: InvoiceFilterCounts;
  /** Every invoice there is, whatever the chip and the search say. */
  invoiceTotal: number;
  tab: "scan" | "invoices";
  filter: InvoiceListFilter;
  /** The search boxes above the list: contractor, job, dates, totals. */
  search: InvoiceListSearch;
  suggestions: InvoiceSearchSuggestions;
  canManage: boolean;
  /** Can file a scan: has both the invoice and the delivery permission. */
  canFile: boolean;
  /** What the Scan In tab shows; null while the list is open. */
  scanIn: { view: ScanInView; viewing: string | null } | null;
};

/** Leaving for the other tab drops the list's search from the address. */
const clearedSearch: Record<string, null> = Object.fromEntries(
  INVOICE_LIST_SEARCH_KEYS.map((key) => [key, null]),
);

export function InvoicesTabs({
  invoices,
  pageInfo,
  filterCounts,
  invoiceTotal,
  tab,
  filter,
  search,
  suggestions,
  canManage,
  canFile,
  scanIn,
}: InvoicesTabsProps) {
  const { setParams } = useListQuery();
  // Filing a scan makes invoices without loading the page again: Scan In
  // says how many there are now. A fresh count from the server wins.
  const serverCount = invoiceTotal;
  const [scanCount, setScanCount] = useState<{
    since: number;
    count: number;
  } | null>(null);
  const reportInvoiceCount = useCallback(
    (count: number) => setScanCount({ since: serverCount, count }),
    [serverCount],
  );
  const invoiceCount =
    scanCount && scanCount.since === serverCount
      ? scanCount.count
      : serverCount;

  const tabButtonClassName = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium ${
      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          aria-pressed={tab === "scan"}
          onClick={() =>
            // Scan In is where /invoices opens for someone who can file.
            setParams({
              tab: canFile ? null : "scan",
              status: null,
              scan: null,
              ...clearedSearch,
            })
          }
          className={tabButtonClassName(tab === "scan")}
        >
          Scan In
        </button>
        <button
          type="button"
          aria-pressed={tab === "invoices"}
          onClick={() =>
            setParams({
              tab: "invoices",
              status: null,
              scan: null,
              ...clearedSearch,
            })
          }
          className={tabButtonClassName(tab === "invoices")}
        >
          Invoices ({invoiceCount.toLocaleString()})
        </button>
      </div>

      {tab === "scan" && scanIn ? (
        <ScanInTab
          initialView={scanIn.view}
          initialViewing={scanIn.viewing}
          onInvoiceCount={reportInvoiceCount}
        />
      ) : (
        <InvoicesListTab
          invoices={invoices}
          pageInfo={pageInfo}
          filter={filter}
          search={search}
          filterCounts={filterCounts}
          suggestions={suggestions}
          canManage={canManage}
        />
      )}
    </div>
  );
}
