import Link from "next/link";
import type { QuoteStatTile } from "@/lib/quotes/list-summary";

// Server-rendered header of the quotes page. Kept out of the "use client"
// list component so it never re-renders while the user types in the search box.

const tileToneClassName: Record<QuoteStatTile["tone"], string> = {
  default: "text-slate-500",
  warning: "text-amber-600",
  success: "text-emerald-600",
};

export function QuotesSummarySection({ tiles }: { tiles: QuoteStatTile[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap divide-x divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="min-w-[150px] flex-1 px-4 py-2 transition-colors hover:bg-slate-50"
          >
            <p
              className={`text-[10px] font-medium uppercase tracking-wide ${tileToneClassName[tile.tone]}`}
            >
              {tile.label}
            </p>
            <p className="text-base font-semibold text-slate-900">
              {tile.value}
              {tile.detail ? (
                <span className="ml-1.5 text-xs font-normal text-slate-500">
                  · {tile.detail}
                </span>
              ) : null}
            </p>
          </Link>
        ))}
      </div>
      <Link
        href="/quotes/new"
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
      >
        New Quote
      </Link>
    </div>
  );
}
