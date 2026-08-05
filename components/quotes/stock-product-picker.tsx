"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { searchProductsForQuoteForm } from "@/app/quotes/actions";
import {
  formatQuoteCurrency,
  quoteInputClassName,
  type QuoteFormProductOption,
} from "@/components/quotes/quote-utils";
import { formatCastingSupplierOriginLabel } from "@/lib/casting-utils";
import {
  buildCategoryFilterOptions,
  buildSubcategoryFilterOptions,
  type ProductTaxonomyCategory,
} from "@/lib/product-taxonomy";

export type StagedStockProduct = {
  product: QuoteFormProductOption;
  qty: number;
};

type StockProductPickerProps = {
  taxonomy: ProductTaxonomyCategory[];
  priceListId: string | null;
  onAdd: (items: StagedStockProduct[]) => void;
  onCancel: () => void;
};

function chipClassName(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    active
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
  }`;
}

export function StockProductPicker({
  taxonomy,
  priceListId,
  onAdd,
  onCancel,
}: StockProductPickerProps) {
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<QuoteFormProductOption[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Staged picks survive category/subcategory switches so a whole quote's
  // worth of products can be gathered before one Add.
  const [staged, setStaged] = useState<Map<string, StagedStockProduct>>(
    () => new Map(),
  );

  const categoryOptions = useMemo(
    () =>
      buildCategoryFilterOptions(taxonomy).filter(
        (option) => option.id !== "All",
      ),
    [taxonomy],
  );

  const subcategoryOptions = useMemo(
    () =>
      categoryId
        ? buildSubcategoryFilterOptions(taxonomy, categoryId)
        : [{ id: "All", name: "All" }],
    [categoryId, taxonomy],
  );

  useEffect(() => {
    if (!categoryId) {
      return;
    }

    const handle = setTimeout(() => {
      startTransition(async () => {
        const results = await searchProductsForQuoteForm(
          searchQuery,
          "PHYSICAL",
          priceListId,
          null,
          categoryId,
          subcategoryId === "All" ? null : subcategoryId,
        );
        setProducts(results);
        setHasLoaded(true);
      });
    }, 300);

    return () => clearTimeout(handle);
  }, [categoryId, subcategoryId, searchQuery, priceListId]);

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setSubcategoryId("All");
    setSearchQuery("");
    if (!nextCategoryId) {
      setProducts([]);
      setHasLoaded(false);
    }
  }

  function setQty(product: QuoteFormProductOption, qty: number) {
    setStaged((current) => {
      const next = new Map(current);
      if (qty <= 0) {
        next.delete(product.id);
      } else {
        next.set(product.id, { product, qty });
      }
      return next;
    });
  }

  function stagedQty(productId: string): number {
    return staged.get(productId)?.qty ?? 0;
  }

  const stagedItems = [...staged.values()];
  const stagedPieces = stagedItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Filters stay pinned; only the structure list below scrolls. */}
      <div className="space-y-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-slate-700">Category</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {categoryOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleCategoryChange(option.id)}
                className={chipClassName(categoryId === option.id)}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>

        {categoryId && subcategoryOptions.length > 1 ? (
          <div>
            <p className="text-xs font-medium text-slate-700">Subcategory</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {subcategoryOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSubcategoryId(option.id)}
                  className={chipClassName(subcategoryId === option.id)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {categoryId ? (
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter by code or name…"
            className={quoteInputClassName}
          />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        <div className="rounded-lg border border-slate-200 bg-white">
          {!categoryId ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500">
              Pick a category above to browse structures.
            </p>
          ) : isPending || !hasLoaded ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">
              Loading…
            </p>
          ) : products.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500">
              No active products in this category
              {subcategoryId !== "All" ? " and subcategory" : ""}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {products.map((product) => {
                const qty = stagedQty(product.id);
                const isStaged = qty > 0;
                return (
                  <li
                    key={product.id}
                    className={isStaged ? "bg-sky-50/70" : undefined}
                  >
                    <div className="flex items-center gap-3 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setQty(product, isStaged ? 0 : 1)}
                        className="min-w-0 flex-1 text-left"
                        aria-pressed={isStaged}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-mono text-[11px] font-semibold text-slate-900">
                            {product.code}
                          </span>
                          <span className="whitespace-nowrap text-xs font-semibold text-slate-900">
                            {formatQuoteCurrency(product.unitPrice)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-slate-600">
                          {product.description}
                          {product.galleyFamilyCode ? (
                            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                              Split on award
                            </span>
                          ) : null}
                          {product.castingOrigin ? (
                            <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200">
                              {formatCastingSupplierOriginLabel(
                                product.castingOrigin,
                              )}
                            </span>
                          ) : null}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQty(product, qty - 1)}
                          disabled={qty <= 0}
                          aria-label={`Decrease quantity of ${product.code}`}
                          className="h-6 w-6 rounded-md border border-slate-200 text-sm leading-none text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={qty === 0 ? "" : qty}
                          placeholder="0"
                          onChange={(event) => {
                            const next = Number.parseInt(
                              event.target.value,
                              10,
                            );
                            setQty(product, Number.isFinite(next) ? next : 0);
                          }}
                          aria-label={`Quantity of ${product.code}`}
                          className="h-6 w-12 rounded-md border border-slate-200 px-1 text-center text-xs text-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQty(product, qty + 1)}
                          aria-label={`Increase quantity of ${product.code}`}
                          className="h-6 w-6 rounded-md border border-slate-200 text-sm leading-none text-slate-600 hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {categoryId && hasLoaded && products.length >= 150 ? (
          <p className="text-[11px] text-slate-500">
            Showing the first 150 — use the search box to narrow further.
          </p>
        ) : null}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        {stagedItems.length > 0 ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {stagedItems.map(({ product, qty }) => (
              <span
                key={product.id}
                className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800"
              >
                {qty}× {product.code}
                <button
                  type="button"
                  onClick={() => setQty(product, 0)}
                  aria-label={`Remove ${product.code}`}
                  className="text-sky-500 hover:text-sky-800"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setStaged(new Map())}
              className="text-[11px] font-medium text-slate-400 underline hover:text-slate-600"
            >
              Clear all
            </button>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {stagedItems.length === 0
              ? "Click a structure or set a quantity to stage it."
              : `${stagedItems.length} product${stagedItems.length === 1 ? "" : "s"} · ${stagedPieces} piece${stagedPieces === 1 ? "" : "s"} staged`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onAdd(stagedItems)}
              disabled={stagedItems.length === 0}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add {stagedItems.length > 0 ? `${stagedPieces} ` : ""}to Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
