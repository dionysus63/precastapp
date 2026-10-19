"use client";

import Link from "next/link";
import { memo } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import {
  type QuoteRow,
  quoteDueDateFilterOptions,
  quoteStatusLabels,
  quoteTypeLabels,
  quoteYearFilterOptions,
} from "@/components/quotes/quote-utils";
import type { PageInfo } from "@/lib/list-params";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellWrapClassName,
  tableRowClassName,
} from "@/lib/table-styles";

type QuotesPageContentFilters = {
  search: string;
  status: string;
  estimator: string;
  year: string;
  type: string;
  due: string;
};

type QuoteTabCounts = {
  open: number;
  won: number;
  closed: number;
  all: number;
};

type QuotesPageContentProps = {
  quotes: QuoteRow[];
  pageInfo: PageInfo;
  filters: QuotesPageContentFilters;
  tabCounts: QuoteTabCounts;
  estimatorFilterOptions: string[];
};

const bidDueCellClassName: Record<
  NonNullable<QuoteRow["bidDueUrgency"]> | "none",
  string
> = {
  overdue: "font-semibold text-red-600",
  soon: "font-medium text-amber-600",
  none: "text-slate-600",
};

// Memoized so typing in the search box doesn't re-render the full row set;
// rows only change when the server sends a new page.
const QuotesTable = memo(function QuotesTable({
  quotes,
  total,
}: {
  quotes: QuoteRow[];
  total: number;
}) {
  return (
    <div className={tableFlushWrapperClassName}>
      <table className={tableClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellWrapClassName}>Quote Number</th>
            <th className={tableHeaderCellWrapClassName}>Job Number</th>
            <th className={tableHeaderCellWrapClassName}>Project Name</th>
            <th className={tableHeaderCellWrapClassName}>Customer</th>
            <th className={tableHeaderCellWrapClassName}>Quote Type</th>
            <th className={tableHeaderCellWrapClassName}>Status</th>
            <th className={tableHeaderCellWrapClassName}>Bid Due Date</th>
            <th className={tableHeaderCellWrapClassName}>Total</th>
            <th className={tableHeaderCellWrapClassName}>Estimator</th>
            <th className={tableHeaderCellWrapClassName}>Last Updated</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {quotes.length === 0 ? (
            <tr>
              <td
                colSpan={10}
                className={`${tableCellBordersClassName} px-4 py-8 text-center text-sm text-slate-500`}
              >
                {total === 0 ? (
                  <span>
                    No quotes match your search or filters.{" "}
                    <Link
                      href="/quotes/new"
                      className="font-medium text-slate-900 underline"
                    >
                      Create a quote.
                    </Link>
                  </span>
                ) : (
                  "No quotes on this page."
                )}
              </td>
            </tr>
          ) : (
            quotes.map((quote) => (
              <tr key={quote.id} className={tableRowClassName}>
                <td className={`${tableCellClassName} whitespace-nowrap font-mono text-[11px] font-medium`}>
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="text-slate-900 hover:underline"
                  >
                    {quote.quoteNumber}
                  </Link>
                  {quote.revision !== "R0" ? (
                    <span className="ml-1.5 text-slate-400">
                      {quote.revision}
                    </span>
                  ) : null}
                </td>
                <td className={`${tableCellClassName} font-mono text-[11px]`}>
                  {quote.jobId && quote.jobNumber !== "—" ? (
                    <Link
                      href={`/jobs/${quote.jobId}?tab=quotes`}
                      className="text-slate-700 hover:underline"
                    >
                      {quote.jobNumber}
                    </Link>
                  ) : (
                    <span className="text-slate-700">{quote.jobNumber}</span>
                  )}
                </td>
                <td className={`${tableCellClassName} font-medium text-slate-900`}>
                  <div>{quote.projectName}</div>
                  {quote.scopeLabel ? (
                    <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {quote.scopeLabel}
                    </span>
                  ) : null}
                </td>
                <td className={`${tableCellClassName} text-slate-700`}>
                  {quote.customer}
                </td>
                <td className={tableCellClassName}>
                  <StatusBadge
                    label={quote.quoteTypeLabel}
                    variant="neutral"
                  />
                </td>
                <td className={tableCellClassName}>
                  <StatusBadge
                    label={quote.statusLabel}
                    variant={quote.statusVariant}
                  />
                </td>
                <td
                  className={`${tableCellClassName} whitespace-nowrap ${bidDueCellClassName[quote.bidDueUrgency ?? "none"]}`}
                >
                  {quote.bidDueDate}
                </td>
                <td className={`${tableCellClassName} font-medium text-slate-900`}>
                  {quote.total}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {quote.estimator}
                </td>
                <td className={`${tableCellClassName} whitespace-nowrap text-slate-600`}>
                  {quote.lastUpdated}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

// Renders a fragment: the surrounding layout (stat strip) is server-rendered
// by app/quotes/page.tsx as a sibling inside the shared `space-y-4` wrapper.
export function QuotesPageContent({
  quotes,
  pageInfo,
  filters,
  tabCounts,
  estimatorFilterOptions,
}: QuotesPageContentProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  const quoteTypeOptions = Object.entries(quoteTypeLabels);

  const statusTabs = [
    {
      label: "Open",
      param: "",
      count: tabCounts.open,
      isActive: filters.status === "" || filters.status === "OPEN",
    },
    {
      label: "Won",
      param: "WON",
      count: tabCounts.won,
      isActive: filters.status === "WON",
    },
    {
      label: "Closed",
      param: "CLOSED",
      count: tabCounts.closed,
      isActive: filters.status === "CLOSED",
    },
    {
      label: "All",
      param: "ALL",
      count: tabCounts.all,
      isActive: filters.status === "ALL" || filters.status === "All",
    },
  ];
  // A single-status link (e.g. the dashboard's ?status=DRAFT) isn't a tab —
  // surface it as a removable filter chip instead.
  const singleStatusLabel =
    filters.status && !statusTabs.some((tab) => tab.isActive)
      ? quoteStatusLabels[filters.status as keyof typeof quoteStatusLabels] ??
        filters.status
      : null;

  return (
    <>
      <div className="border-b border-slate-200">
        <div className="-mb-px flex flex-wrap items-center gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setParams({ status: tab.param })}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab.isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 ${tab.isActive ? "text-slate-500" : "text-slate-400"}`}
              >
                {tab.count.toLocaleString()}
              </span>
            </button>
          ))}
          {singleStatusLabel ? (
            <button
              type="button"
              onClick={() => setParams({ status: "" })}
              title="Clear status filter"
              className="mb-1 ml-2 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Status: {singleStatusLabel}
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap">
        <input
          type="search"
          placeholder="Search quote number, job number, customer, or project..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 xl:max-w-sm"
        />
        <select
          value={filters.estimator || "All"}
          onChange={(event) => setParams({ estimator: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {estimatorFilterOptions.map((estimator) => (
            <option key={estimator} value={estimator}>
              Estimator: {estimator}
            </option>
          ))}
        </select>
        <select
          value={filters.year || "All"}
          onChange={(event) => setParams({ year: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {quoteYearFilterOptions.map((year) => (
            <option key={year} value={year}>
              Year: {year}
            </option>
          ))}
        </select>
        <select
          value={filters.type || "All"}
          onChange={(event) => setParams({ type: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          <option value="All">Quote Type: All</option>
          {quoteTypeOptions.map(([value, label]) => (
            <option key={value} value={value}>
              Quote Type: {label}
            </option>
          ))}
        </select>
        <select
          value={filters.due || "All"}
          onChange={(event) => setParams({ due: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {quoteDueDateFilterOptions.map((dueDate) => (
            <option key={dueDate} value={dueDate}>
              Due Date: {dueDate}
            </option>
          ))}
        </select>
      </div>

      <SectionCard
        title="Quote List"
        description={`${pageInfo.total.toLocaleString()} quote${pageInfo.total === 1 ? "" : "s"} match`}
        noPadding
      >
        <QuotesTable quotes={quotes} total={pageInfo.total} />
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="quote"
        />
      </SectionCard>
    </>
  );
}
