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

type StockProductPickerProps = {
  taxonomy: ProductTaxonomyCategory[];
  priceListId: string | null;
  selectedProduct: QuoteFormProductOption | null;
  onSelect: (product: QuoteFormProductOption | null) => void;
};

function formatProductLabel(product: QuoteFormProductOption): string {
  const tags: string[] = [];
  if (product.castingOrigin) {
    tags.push(formatCastingSupplierOriginLabel(product.castingOrigin));
  }
  const tagSuffix = tags.length > 0 ? ` · ${tags.join(" · ")}` : "";
  return `${product.code} — ${product.description} — ${formatQuoteCurrency(product.unitPrice)}${tagSuffix}`;
}

export function StockProductPicker({
  taxonomy,
  priceListId,
  selectedProduct,
  onSelect,
}: StockProductPickerProps) {
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("All");
  const [castingOriginFilter, setCastingOriginFilter] = useState<
    "" | "DOMESTIC" | "IMPORTED"
  >("");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<QuoteFormProductOption[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

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
      setProducts([]);
      setHasLoaded(false);
      return;
    }

    const handle = setTimeout(() => {
      startTransition(async () => {
        const results = await searchProductsForQuoteForm(
          searchQuery,
          "PHYSICAL",
          priceListId,
          castingOriginFilter || null,
          categoryId,
          subcategoryId === "All" ? null : subcategoryId,
        );
        setProducts(results);
        setHasLoaded(true);
      });
    }, 300);

    return () => clearTimeout(handle);
  }, [
    categoryId,
    subcategoryId,
    searchQuery,
    priceListId,
    castingOriginFilter,
  ]);

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setSubcategoryId("All");
    onSelect(null);
    setSearchQuery("");
  }

  function handleSubcategoryChange(nextSubcategoryId: string) {
    setSubcategoryId(nextSubcategoryId);
    onSelect(null);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Category *
          </label>
          <select
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className={quoteInputClassName}
          >
            <option value="">Select category…</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Subcategory
          </label>
          <select
            value={subcategoryId}
            onChange={(event) => handleSubcategoryChange(event.target.value)}
            disabled={!categoryId}
            className={quoteInputClassName}
          >
            {subcategoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Casting origin
          </label>
          <select
            value={castingOriginFilter}
            onChange={(event) => {
              setCastingOriginFilter(
                event.target.value as "" | "DOMESTIC" | "IMPORTED",
              );
              onSelect(null);
            }}
            className={quoteInputClassName}
          >
            <option value="">All origins</option>
            <option value="DOMESTIC">Domestic</option>
            <option value="IMPORTED">Imported</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Search within results
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              onSelect(null);
            }}
            disabled={!categoryId}
            placeholder="Filter by code or name"
            className={quoteInputClassName}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-700">Products</p>
        <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {!categoryId ? (
            <p className="px-3 py-4 text-xs text-slate-500">
              Select a category to browse products.
            </p>
          ) : isPending || !hasLoaded ? (
            <p className="px-3 py-4 text-xs text-slate-400">Loading…</p>
          ) : products.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-500">
              No active products in this category
              {subcategoryId !== "All" ? " and subcategory" : ""}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {products.map((product) => {
                const isSelected = selectedProduct?.id === product.id;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(product)}
                      className={`block w-full px-3 py-2.5 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-slate-900 text-white"
                          : "text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {formatProductLabel(product)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {categoryId && hasLoaded && products.length > 0 ? (
          <p className="mt-1 text-[11px] text-slate-500">
            {products.length} product{products.length === 1 ? "" : "s"} shown
            {products.length >= 150 ? " (first 150)" : ""}. Click one to
            select.
          </p>
        ) : null}
      </div>
    </div>
  );
}
