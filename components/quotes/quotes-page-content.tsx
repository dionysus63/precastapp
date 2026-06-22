"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import {
  type QuoteRow,
  quoteDueDateFilterOptions,
  quoteEstimatorFilterOptions,
  quoteStatusFilterOptions,
  quoteSummaryCards,
  quoteTypeFilterOptions,
  quoteYearFilterOptions,
  recentQuoteActivity,
} from "@/components/quotes/quote-utils";

type QuotesPageContentProps = {
  quotes?: QuoteRow[];
};

function EmptyQuotesMessage({
  hasQuotes,
  filteredCount,
}: {
  hasQuotes: boolean;
  filteredCount: number;
}) {
  if (!hasQuotes) {
    return (
      <span>
        No quotes yet.{" "}
        <Link href="/quotes/new" className="font-medium text-slate-900 underline">
          Create your first quote.
        </Link>
      </span>
    );
  }

  if (filteredCount === 0) {
    return <>No quotes match your search or filters.</>;
  }

  return null;
}

function parseQuoteDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function matchesDueDateFilter(bidDueDate: string, dueDateFilter: string) {
  if (dueDateFilter === "All") {
    return true;
  }

  const due = parseQuoteDate(bidDueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const monthEnd = new Date(today);
  monthEnd.setDate(today.getDate() + 30);

  if (dueDateFilter === "Due This Week") {
    return due >= today && due <= weekEnd;
  }

  if (dueDateFilter === "Overdue") {
    return due < today;
  }

  if (dueDateFilter === "Next 30 Days") {
    return due >= today && due <= monthEnd;
  }

  return true;
}

export function QuotesPageContent({
  quotes = [],
}: QuotesPageContentProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [estimatorFilter, setEstimatorFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [quoteTypeFilter, setQuoteTypeFilter] = useState("All");
  const [dueDateFilter, setDueDateFilter] = useState("All");

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => {
      const matchesSearch =
        search.trim() === "" ||
        quote.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
        quote.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        quote.customer.toLowerCase().includes(search.toLowerCase()) ||
        quote.projectName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || quote.statusLabel === statusFilter;

      const matchesEstimator =
        estimatorFilter === "All" || quote.estimator === estimatorFilter;

      const matchesYear =
        yearFilter === "All" || String(quote.year) === yearFilter;

      const matchesQuoteType =
        quoteTypeFilter === "All" || quote.quoteTypeLabel === quoteTypeFilter;

      const matchesDueDate = matchesDueDateFilter(
        quote.bidDueDate,
        dueDateFilter,
      );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesEstimator &&
        matchesYear &&
        matchesQuoteType &&
        matchesDueDate
      );
    });
  }, [
    quotes,
    search,
    statusFilter,
    estimatorFilter,
    yearFilter,
    quoteTypeFilter,
    dueDateFilter,
  ]);

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
        {quoteSummaryCards.map((card) => (
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
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {quoteStatusFilterOptions.map((status) => (
            <option key={status} value={status}>
              Status: {status}
            </option>
          ))}
        </select>
        <select
          value={estimatorFilter}
          onChange={(event) => setEstimatorFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {quoteEstimatorFilterOptions.map((estimator) => (
            <option key={estimator} value={estimator}>
              Estimator: {estimator}
            </option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(event) => setYearFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {quoteYearFilterOptions.map((year) => (
            <option key={year} value={year}>
              Year: {year}
            </option>
          ))}
        </select>
        <select
          value={quoteTypeFilter}
          onChange={(event) => setQuoteTypeFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          {quoteTypeFilterOptions.map((quoteType) => (
            <option key={quoteType} value={quoteType}>
              Quote Type: {quoteType}
            </option>
          ))}
        </select>
        <select
          value={dueDateFilter}
          onChange={(event) => setDueDateFilter(event.target.value)}
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
        description={`${filteredQuotes.length} quote${filteredQuotes.length === 1 ? "" : "s"} shown`}
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
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    <EmptyQuotesMessage
                      hasQuotes={quotes.length > 0}
                      filteredCount={filteredQuotes.length}
                    />
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((quote) => (
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
                      {quote.projectName}
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
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Recent Quote Activity"
          description="Latest quote updates across your pipeline."
        >
          <ul className="space-y-3">
            {recentQuoteActivity.map((item) => (
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

        <SectionCard
          title="Quick Actions"
          description="Common quote workflows."
        >
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
