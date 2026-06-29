"use client";

import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import {
  type QuoteActivityItem,
  type QuoteRow,
  quoteDueDateFilterOptions,
  quoteStatusFormOptions,
  quoteTypeLabels,
  quoteYearFilterOptions,
} from "@/components/quotes/quote-utils";
import type { QuoteSummaryCard } from "@/lib/quotes/list-summary";
import type { PageInfo } from "@/lib/list-params";

type QuotesPageContentFilters = {
  search: string;
  status: string;
  estimator: string;
  year: string;
  type: string;
  due: string;
};

type QuotesPageContentProps = {
  quotes: QuoteRow[];
  pageInfo: PageInfo;
  filters: QuotesPageContentFilters;
  summaryCards: QuoteSummaryCard[];
  recentActivity: QuoteActivityItem[];
  estimatorFilterOptions: string[];
};

export function QuotesPageContent({
  quotes,
  pageInfo,
  filters,
  summaryCards,
  recentActivity,
  estimatorFilterOptions,
}: QuotesPageContentProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  const quoteTypeOptions = Object.entries(quoteTypeLabels);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-400"
        >
          Export
        </button>
        <Link
          href="/quotes/new"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          New Quote
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
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
          value={filters.status || "All"}
          onChange={(event) => setParams({ status: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          <option value="All">Status: All</option>
          {quoteStatusFormOptions.map((option) => (
            <option key={option.value} value={option.value}>
              Status: {option.label}
            </option>
          ))}
        </select>
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Quote Number</th>
                <th className="px-4 py-2.5 font-semibold">Revision</th>
                <th className="px-4 py-2.5 font-semibold">Job Number</th>
                <th className="px-4 py-2.5 font-semibold">Project Name</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Quote Type</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Bid Due Date</th>
                <th className="px-4 py-2.5 font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Estimator</th>
                <th className="px-4 py-2.5 font-semibold">Last Updated</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    {pageInfo.total === 0 ? (
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
                  <tr key={quote.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-[11px] font-medium text-slate-900">
                      {quote.quoteNumber}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {quote.revision}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">
                      {quote.jobNumber}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <div>{quote.projectName}</div>
                      {quote.scopeLabel ? (
                        <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {quote.scopeLabel}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {quote.customer}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={quote.quoteTypeLabel}
                        variant="neutral"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={quote.statusLabel}
                        variant={quote.statusVariant}
                      />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {quote.bidDueDate}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {quote.total}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {quote.estimator}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {quote.lastUpdated}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          disabled
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                        >
                          Revise
                        </button>
                        <button
                          type="button"
                          disabled
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          disabled
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                        >
                          More
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="quote"
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Recent Quote Activity"
          description="Latest quote updates across your pipeline."
        >
          <ul className="space-y-3">
            {recentActivity.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
              >
                <p className="text-sm text-slate-800">{item.message}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.timestamp}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Quick Actions" description="Common quote workflows.">
          <div className="flex flex-col gap-2">
            <Link
              href="/quotes/new"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
            >
              New Quote
            </Link>
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-400"
            >
              Quote from Existing Job
            </button>
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-400"
            >
              Duplicate Quote
            </button>
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-400"
            >
              View Expiring Quotes
            </button>
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-400"
            >
              View Won Quotes
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
