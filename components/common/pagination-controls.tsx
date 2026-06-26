"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  fromIndex: number;
  toIndex: number;
  total: number;
  /** Noun for the rows, e.g. "job" / "quote". */
  noun?: string;
};

export function PaginationControls({
  page,
  totalPages,
  fromIndex,
  toIndex,
  total,
  noun = "item",
}: PaginationControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefForPage = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const label =
    total === 0
      ? `No ${noun}s`
      : `Showing ${fromIndex.toLocaleString()}–${toIndex.toLocaleString()} of ${total.toLocaleString()} ${noun}${total === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={hrefForPage(page - 1)}
            className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-slate-100 px-2.5 py-1 font-medium text-slate-300">
            Previous
          </span>
        )}
        <span className="px-1 text-slate-500">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={hrefForPage(page + 1)}
            className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-slate-100 px-2.5 py-1 font-medium text-slate-300">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
