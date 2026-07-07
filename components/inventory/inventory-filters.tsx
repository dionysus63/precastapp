"use client";

import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";

const selectClassName =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm";

type InventoryFiltersProps = {
  filters: {
    search: string;
    stock: string;
    castingOrigin: string;
  };
};

export function InventoryFilters({ filters }: InventoryFiltersProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  return (
    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
      <input
        type="search"
        placeholder="Search code, product name, or yard location..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 sm:max-w-xs"
      />
      <select
        value={filters.stock || "All"}
        onChange={(event) => setParams({ stock: event.target.value })}
        className={selectClassName}
      >
        <option value="All">Stock: All</option>
        <option value="low">Stock: Low</option>
        <option value="out">Stock: Out</option>
      </select>
      <select
        value={filters.castingOrigin || "All"}
        onChange={(event) => setParams({ castingOrigin: event.target.value })}
        className={selectClassName}
      >
        <option value="All">Casting origin: All</option>
        <option value="Domestic">Casting origin: Domestic</option>
        <option value="Imported">Casting origin: Imported</option>
      </select>
    </div>
  );
}
