import Link from "next/link";
import type { PriceListOption } from "@/lib/price-list-service";

/**
 * Link tabs that scope a settings/catalog page's price columns to one price
 * list (?priceList=...). Geometry columns on these pages stay shared.
 */
export function PriceListSwitcher({
  priceLists,
  selectedId,
  basePath,
}: {
  priceLists: PriceListOption[];
  selectedId: string | null;
  basePath: string;
}) {
  if (priceLists.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-slate-500">
        Price list:
      </span>
      {priceLists.map((list) => (
        <Link
          key={list.id}
          href={`${basePath}?priceList=${list.id}`}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
            list.id === selectedId
              ? "bg-slate-900 text-white"
              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {list.name}
          {list.isDefault ? " ★" : ""}
        </Link>
      ))}
    </div>
  );
}

export function pickSelectedPriceList(
  priceLists: PriceListOption[],
  requestedId: string | undefined,
): PriceListOption | null {
  return (
    priceLists.find((list) => list.id === requestedId) ??
    priceLists.find((list) => list.isDefault) ??
    priceLists[0] ??
    null
  );
}
