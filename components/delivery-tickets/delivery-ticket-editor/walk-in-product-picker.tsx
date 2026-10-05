"use client";

import { SectionCard } from "@/components/dashboard/section-card";
import { formatUsd } from "@/lib/format";
import { productPriceFor } from "./editor-utils";
import type { ProductOption } from "./types";
import type { WalkInProductFilter } from "./use-walk-in-product-filter";

type WalkInProductPickerProps = {
  products: ProductOption[];
  filter: WalkInProductFilter;
  walkInQtyByProductId: Map<string, number>;
  onAddProduct: (productId: string) => void;
};

/** Walk-in "Products" card: search, category / group chips and the tap-to-
 * add product list (pickup prices, delivered price struck through). */
export function WalkInProductPicker({
  products,
  filter,
  walkInQtyByProductId,
  onAddProduct,
}: WalkInProductPickerProps) {
  const {
    walkInSearch,
    setWalkInSearch,
    walkInPickerMode,
    walkInGroupId,
    walkInSubgroupId,
    setWalkInSubgroupId,
    walkInCategoryId,
    walkInSubcategoryId,
    setWalkInSubcategoryId,
    walkInCategories,
    walkInSubcategories,
    topLevelGroups,
    subgroupsByParent,
    productCountByGroupId,
    countForGroup,
    walkInFiltered,
    walkInResults,
    selectWalkInCategory,
    selectWalkInPickerMode,
    selectWalkInGroup,
  } = filter;

  return (
    <SectionCard
      title="Products"
      description="Tap a product to add it (tap again for another). Prices shown are pickup prices — a crossed-out number is the delivered price."
    >
      {products.length === 0 ? (
        <p className="text-xs text-slate-500">
          No active products are available to add.
        </p>
      ) : (
        <div className="space-y-3">
          <input
            type="search"
            value={walkInSearch}
            onChange={(event) => setWalkInSearch(event.target.value)}
            placeholder={
              walkInCategoryId === "all"
                ? "Search all products by code or name…"
                : "Search within this category…"
            }
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400"
          />
          {topLevelGroups.length > 0 ? (
            <div
              role="group"
              aria-label="Filter products by"
              className="inline-flex overflow-hidden rounded-md border border-slate-200 text-[11px] font-medium"
            >
              <button
                type="button"
                aria-pressed={walkInPickerMode === "categories"}
                onClick={() => selectWalkInPickerMode("categories")}
                className={
                  walkInPickerMode === "categories"
                    ? "bg-slate-900 px-2.5 py-1 text-white"
                    : "px-2.5 py-1 text-slate-600 hover:bg-slate-50"
                }
              >
                Categories
              </button>
              <button
                type="button"
                aria-pressed={walkInPickerMode === "groups"}
                onClick={() => selectWalkInPickerMode("groups")}
                className={
                  walkInPickerMode === "groups"
                    ? "bg-slate-900 px-2.5 py-1 text-white"
                    : "border-l border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
                }
              >
                Groups
              </button>
            </div>
          ) : null}
          {walkInPickerMode === "groups" ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => selectWalkInGroup(null)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    walkInGroupId == null
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  All{" "}
                  <span
                    className={
                      walkInGroupId == null
                        ? "text-slate-300"
                        : "text-slate-400"
                    }
                  >
                    {products.length}
                  </span>
                </button>
                {topLevelGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => selectWalkInGroup(group.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      walkInGroupId === group.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {group.name}{" "}
                    <span
                      className={
                        walkInGroupId === group.id
                          ? "text-slate-300"
                          : "text-slate-400"
                      }
                    >
                      {countForGroup(group.id)}
                    </span>
                  </button>
                ))}
              </div>
              {walkInGroupId &&
              (subgroupsByParent.get(walkInGroupId) ?? []).length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">
                    Sub-group:
                  </span>
                  <button
                    type="button"
                    onClick={() => setWalkInSubgroupId(null)}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      walkInSubgroupId == null
                        ? "border-slate-300 bg-slate-100 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    All
                  </button>
                  {(subgroupsByParent.get(walkInGroupId) ?? []).map(
                    (subgroup) => (
                      <button
                        key={subgroup.id}
                        type="button"
                        onClick={() => setWalkInSubgroupId(subgroup.id)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                          walkInSubgroupId === subgroup.id
                            ? "border-slate-300 bg-slate-100 text-slate-900"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {subgroup.name}{" "}
                        <span className="text-slate-400">
                          {productCountByGroupId.get(subgroup.id) ?? 0}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </>
          ) : null}
          {walkInPickerMode === "categories" ? (
          <>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => selectWalkInCategory("all")}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                walkInCategoryId === "all"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              All{" "}
              <span
                className={
                  walkInCategoryId === "all"
                    ? "text-slate-300"
                    : "text-slate-400"
                }
              >
                {products.length}
              </span>
            </button>
            {walkInCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => selectWalkInCategory(category.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  walkInCategoryId === category.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {category.name}{" "}
                <span
                  className={
                    walkInCategoryId === category.id
                      ? "text-slate-300"
                      : "text-slate-400"
                  }
                >
                  {category.count}
                </span>
              </button>
            ))}
          </div>
          {walkInSubcategories.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">
                Subcategory:
              </span>
              <button
                type="button"
                onClick={() => setWalkInSubcategoryId(null)}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                  walkInSubcategoryId == null
                    ? "border-slate-300 bg-slate-100 text-slate-900"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                All
              </button>
              {walkInSubcategories.map((subcategory) => (
                <button
                  key={subcategory.id}
                  type="button"
                  onClick={() => setWalkInSubcategoryId(subcategory.id)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                    walkInSubcategoryId === subcategory.id
                      ? "border-slate-300 bg-slate-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {subcategory.name}{" "}
                  <span className="text-slate-400">{subcategory.count}</span>
                </button>
              ))}
            </div>
          ) : null}
          </>
          ) : null}
          {walkInResults.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-1.5">
                {walkInResults.map((product) => {
                  const onTicket =
                    walkInQtyByProductId.get(product.id) ?? 0;
                  const pickupEach = productPriceFor(product, true);
                  const showsDeliveredStrike =
                    product.pickupPrice != null &&
                    product.unitPrice != null &&
                    product.pickupPrice !== product.unitPrice;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onAddProduct(product.id)}
                      title={product.name}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                        onTicket > 0
                          ? "border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-slate-900">
                          {product.productCode}
                        </span>
                        <span className="ml-1.5 text-slate-600">
                          {product.name}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap">
                        {pickupEach != null ? (
                          <>
                            <span className="font-semibold text-slate-900">
                              {formatUsd(pickupEach)}
                            </span>
                            {showsDeliveredStrike ? (
                              <span className="ml-1 text-[10px] text-slate-400 line-through">
                                {formatUsd(product.unitPrice!)}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="font-medium text-amber-700">
                            No list price
                          </span>
                        )}
                      </span>
                      {product.currentStock != null ? (
                        <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">
                          {product.currentStock} in stock
                        </span>
                      ) : null}
                      {onTicket > 0 ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          {onTicket} on ticket
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          Add
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {walkInFiltered.length > walkInResults.length ? (
                <p className="text-[11px] text-slate-400">
                  Showing {walkInResults.length} of {walkInFiltered.length} —
                  refine with search or a subcategory.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-slate-500">
              No products match this filter.
            </p>
          )}
        </div>
      )}

    </SectionCard>
  );
}
