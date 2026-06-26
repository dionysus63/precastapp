"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import {
  type ProductRow,
  productInventoryFilterOptions,
  productStatusFormOptions,
  productSubmittalsFilterOptions,
  productTypeLabels,
} from "@/components/products/product-utils";
import { ExportExcelLink } from "@/components/shared/export-excel-link";
import {
  buildCategoryFilterOptions,
  buildSubcategoryFilterOptions,
  mergeCatalogWithInUseValues,
  type ProductCatalogCategory,
  type ProductCatalogInUsePair,
} from "@/lib/product-catalog-settings";
import type { PageInfo } from "@/lib/list-params";
import {
  productKindBadgeVariant,
} from "@/lib/product-kinds";

type ProductsListFilters = {
  search: string;
  type: string;
  category: string;
  subcategory: string;
  status: string;
  inventory: string;
  submittals: string;
};

type ProductsListProps = {
  products: ProductRow[];
  catalog: ProductCatalogCategory[];
  inUsePairs: ProductCatalogInUsePair[];
  pageInfo: PageInfo;
  filters: ProductsListFilters;
};

export function ProductsList({
  products,
  catalog,
  inUsePairs,
  pageInfo,
  filters,
}: ProductsListProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  const mergedCatalog = useMemo(
    () => mergeCatalogWithInUseValues(catalog, inUsePairs),
    [catalog, inUsePairs],
  );

  const categoryFilterOptions = useMemo(
    () => buildCategoryFilterOptions(mergedCatalog),
    [mergedCatalog],
  );

  const subcategoryFilterOptions = useMemo(
    () =>
      buildSubcategoryFilterOptions(mergedCatalog, filters.category || "All"),
    [mergedCatalog, filters.category],
  );

  const productTypeOptions = Object.entries(productTypeLabels);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap">
          <input
            type="search"
            placeholder="Search product code, name, category, or type..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 lg:max-w-xs"
          />
          <select
            value={filters.type || "All"}
            onChange={(event) => setParams({ type: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            <option value="All">Product Type: All</option>
            {productTypeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                Product Type: {label}
              </option>
            ))}
          </select>
          <select
            value={filters.category || "All"}
            onChange={(event) =>
              setParams({ category: event.target.value, subcategory: null })
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {categoryFilterOptions.map((category) => (
              <option key={category} value={category}>
                Category: {category}
              </option>
            ))}
          </select>
          <select
            value={filters.subcategory || "All"}
            onChange={(event) => setParams({ subcategory: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {subcategoryFilterOptions.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                Subcategory: {subcategory}
              </option>
            ))}
          </select>
          <select
            value={filters.status || "All"}
            onChange={(event) => setParams({ status: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            <option value="All">Status: All</option>
            {productStatusFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Status: {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.inventory || "All"}
            onChange={(event) => setParams({ inventory: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {productInventoryFilterOptions.map((option) => (
              <option key={option} value={option}>
                Track Inventory: {option}
              </option>
            ))}
          </select>
          <select
            value={filters.submittals || "All"}
            onChange={(event) => setParams({ submittals: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {productSubmittalsFilterOptions.map((option) => (
              <option key={option} value={option}>
                Submittals: {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <ExportExcelLink href="/api/export/products" />
          <Link
            href="/products/bulk"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Bulk Add / Paste from Excel
          </Link>
          <Link
            href="/products/new"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Add Product
          </Link>
        </div>
      </div>

      <SectionCard
        title="Product Catalog"
        description={`${pageInfo.total.toLocaleString()} product${pageInfo.total === 1 ? "" : "s"} match`}
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Product Code</th>
                <th className="px-4 py-2.5 font-semibold">Product Name</th>
                <th className="px-4 py-2.5 font-semibold">Product Type</th>
                <th className="px-4 py-2.5 font-semibold">Category</th>
                <th className="px-4 py-2.5 font-semibold">Subcategory</th>
                <th className="px-4 py-2.5 font-semibold">Unit</th>
                <th className="px-4 py-2.5 font-semibold">Default Price</th>
                <th className="px-4 py-2.5 font-semibold">Weight</th>
                <th className="px-4 py-2.5 font-semibold">Yards</th>
                <th className="px-4 py-2.5 font-semibold">Track Inventory</th>
                <th className="px-4 py-2.5 font-semibold">Submittals</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    {pageInfo.total === 0
                      ? "No products match your search or filters."
                      : "No products on this page."}
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-[11px] font-medium text-slate-900">
                      {product.productCode}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-1.5">
                        {product.productName}
                        {product.productKindLabel ? (
                          <StatusBadge
                            label={product.productKindLabel}
                            variant={productKindBadgeVariant(
                              product.productKind ?? "STANDARD",
                            )}
                          />
                        ) : product.isCasting ? (
                          <StatusBadge label="Casting" variant="info" />
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={product.productTypeLabel}
                        variant={product.productTypeVariant}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={product.category}
                        variant={product.categoryVariant}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {product.subcategory}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{product.unit}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {product.defaultPrice}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{product.weight}</td>
                    <td className="px-4 py-2.5 text-slate-600">{product.yards}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={product.trackInventory ? "Yes" : "No"}
                        variant={product.trackInventory ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {product.submittalCount > 0 ? (
                        <StatusBadge
                          label={String(product.submittalCount)}
                          variant="success"
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/products/${product.id}`}
                        className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="product"
        />
      </SectionCard>
    </div>
  );
}
