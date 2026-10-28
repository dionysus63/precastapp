"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared pieces for the round and rect opening catalog pages: one card per
 * pipe material holding a compact table of its sizes.
 */

/** Auto-width table: columns size to their content instead of the page. */
export const catalogTableClassName =
  "border-separate border-spacing-0 text-left text-xs";

const catalogHeaderCellBaseClassName =
  "whitespace-nowrap border-r border-slate-300 px-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0";

export const catalogHeaderCellClassName = `${catalogHeaderCellBaseClassName} border-b-2 border-b-slate-300 bg-slate-100 py-1.5`;

/** Top header row naming the Boot / No Boot column groups; add a background. */
export const catalogGroupHeaderCellClassName = `${catalogHeaderCellBaseClassName} border-b border-b-slate-300 py-1`;

/** Gridline borders for a size row's cells (same gridlines as the app's other tables). */
export const catalogCellClassName =
  "border-b border-r border-slate-300 last:border-r-0";

/** Fills its cell; give it a width class sized to the column's values. */
export const catalogCellInputClassName =
  "block rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-xs tabular-nums text-slate-900 placeholder:text-slate-300 hover:border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";

type CatalogFilterBarProps = {
  filter: string;
  onFilterChange: (value: string) => void;
  allCollapsed: boolean;
  onToggleAll: () => void;
  onAddMaterial: () => void;
};

export function CatalogFilterBar({
  filter,
  onFilterChange,
  allCollapsed,
  onToggleAll,
  onAddMaterial,
}: CatalogFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter materials…"
          aria-label="Filter materials"
          className="w-56 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          type="button"
          onClick={onToggleAll}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          {allCollapsed ? "Expand All" : "Collapse All"}
        </button>
      </div>
      <button
        type="button"
        onClick={onAddMaterial}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        + Add Material
      </button>
    </div>
  );
}

type CatalogMaterialCardProps = {
  material: string;
  materialPlaceholder: string;
  sizeCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddSize: () => void;
  /** Extra header controls (the round catalog's Boot / No Boot chips). */
  toggles?: ReactNode;
  /** Shown under the header, e.g. a warning about hidden columns. */
  notice?: string | null;
  children: ReactNode;
};

export function CatalogMaterialCard({
  material,
  materialPlaceholder,
  sizeCount,
  collapsed,
  onToggleCollapsed,
  onRename,
  onRemove,
  onAddSize,
  toggles,
  notice,
  children,
}: CatalogMaterialCardProps) {
  return (
    <section className="w-fit min-w-[min(620px,100%)] max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand material" : "Collapse material"}
          className="w-4 text-xs text-slate-400 hover:text-slate-700"
        >
          {collapsed ? "▸" : "▾"}
        </button>
        <input
          type="text"
          value={material}
          onChange={(e) => onRename(e.target.value)}
          placeholder={materialPlaceholder}
          aria-label="Material / type"
          title="Material / type. Renaming changes every size under it."
          className="w-44 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-300 hover:border-slate-200 focus:border-slate-200 focus:bg-slate-50 focus:outline-none"
        />
        <span className="text-[11px] text-slate-500">
          {sizeCount} {sizeCount === 1 ? "size" : "sizes"}
        </span>
        <span className="flex-1" />
        {toggles}
        <button
          type="button"
          onClick={onRemove}
          className="px-1 text-[11px] font-medium text-rose-600 hover:text-rose-800"
        >
          Remove Material
        </button>
      </div>
      {notice ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
          {notice}
        </p>
      ) : null}
      {collapsed ? null : (
        <>
          <div className="overflow-x-auto">{children}</div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-1.5">
            <button
              type="button"
              onClick={onAddSize}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Add Size
            </button>
            <span className="text-[11px] text-slate-400">
              Sizes sort smallest to largest when you save.
            </span>
          </div>
        </>
      )}
    </section>
  );
}

export function CatalogSaveBar({ saveError }: { saveError: string | null }) {
  return (
    <>
      {saveError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {saveError}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <Link
          href="/structures"
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Save Catalog
        </button>
      </div>
    </>
  );
}
