import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import type { QuoteActivityItem } from "@/components/quotes/quote-utils";
import type { QuoteSummaryCard } from "@/lib/quotes/list-summary";

// Server-rendered sections of the quotes page. These don't depend on client
// filter state, so keeping them out of the "use client" list component means
// they never re-render while the user types in the search box.

export function QuotesActionsRow() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        href="/quotes/new"
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
      >
        New Quote
      </Link>
    </div>
  );
}

export function QuotesSummarySection({
  summaryCards,
}: {
  summaryCards: QuoteSummaryCard[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {summaryCards.map((card) => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </div>
  );
}

export function QuotesActivitySection({
  recentActivity,
}: {
  recentActivity: QuoteActivityItem[];
}) {
  return (
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
        </div>
      </SectionCard>
    </div>
  );
}
