"use client";

import { useListQuery } from "@/components/common/use-list-query";

export type CategoryChip = {
  id: string;
  name: string;
  count: number;
};

type CategoryChipBarProps = {
  categories: CategoryChip[];
  /** Subcategories of the selected category; `{ id: "none" }` = no subcategory. */
  subcategories: CategoryChip[];
  selectedCategoryId: string | null;
  selectedSubcategoryId: string | null;
};

/**
 * URL-driven category → subcategory filter chips for server-paginated product
 * lists. Writes `category` / `subcategory` query params (useListQuery resets
 * the page param on every change).
 */
export function CategoryChipBar({
  categories,
  subcategories,
  selectedCategoryId,
  selectedSubcategoryId,
}: CategoryChipBarProps) {
  const { setParams } = useListQuery();

  const totalCount = categories.reduce((sum, chip) => sum + chip.count, 0);

  function categoryChipClass(active: boolean) {
    return `rounded-full border px-2.5 py-1 text-[11px] font-medium ${
      active
        ? "border-slate-900 bg-slate-900 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`;
  }

  function subcategoryChipClass(active: boolean) {
    return `rounded-md border px-2 py-0.5 text-[11px] font-medium ${
      active
        ? "border-slate-300 bg-slate-100 text-slate-900"
        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
    }`;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setParams({ category: null, subcategory: null })}
          className={categoryChipClass(!selectedCategoryId)}
        >
          All{" "}
          <span className={!selectedCategoryId ? "text-slate-300" : "text-slate-400"}>
            {totalCount}
          </span>
        </button>
        {categories.map((chip) => {
          const active = chip.id === selectedCategoryId;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() =>
                setParams(
                  active
                    ? { category: null, subcategory: null }
                    : { category: chip.id, subcategory: null },
                )
              }
              className={categoryChipClass(active)}
            >
              {chip.name}{" "}
              <span className={active ? "text-slate-300" : "text-slate-400"}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>
      {selectedCategoryId && subcategories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <span className="text-[11px] text-slate-400">Subcategory:</span>
          <button
            type="button"
            onClick={() => setParams({ subcategory: null })}
            className={subcategoryChipClass(!selectedSubcategoryId)}
          >
            All
          </button>
          {subcategories.map((chip) => {
            const active = chip.id === selectedSubcategoryId;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() =>
                  setParams({ subcategory: active ? null : chip.id })
                }
                className={subcategoryChipClass(active)}
              >
                {chip.name}{" "}
                <span className="text-slate-400">{chip.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
