"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import {
  type ProductRow,
  productCastingOriginFilterOptions,
  productStatusFormOptions,
  productSubmittalsFilterOptions,
  productTypeLabels,
} from "@/components/products/product-utils";
import { formatCastingSupplierOriginLabel } from "@/lib/casting-utils";
import { ExportExcelLink } from "@/components/shared/export-excel-link";
import {
  buildCategoryFilterOptions,
  buildSubcategoryFilterOptions,
  type ProductTaxonomyCategory,
} from "@/lib/product-taxonomy";
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
  submittals: string;
  castingOrigin: string;
};

type ProductsListProps = {
  products: ProductRow[];
  taxonomy: ProductTaxonomyCategory[];
  pageInfo: PageInfo;
  filters: ProductsListFilters;
};

// Memoized so typing in the search box doesn't re-render the full row set;
// rows only change when the server sends a new page.
const ProductsTable = memo(function ProductsTable({
  products,
  total,
}: {
  products: ProductRow[];
  total: number;
}) {
  return (
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
            <th className="px-4 py-2.5 font-semibold">Unit Price</th>
            <th className="px-4 py-2.5 font-semibold">Weight</th>
            <th className="px-4 py-2.5 font-semibold">Yards</th>
            <th className="px-4 py-2.5 font-semibold">Submittals</th>
            <th className="px-4 py-2.5 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className="px-4 py-8 text-center text-sm text-slate-500"
              >
                {total === 0
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
                    {product.castingOrigin ? (
                      <StatusBadge
                        label={formatCastingSupplierOriginLabel(
                          product.castingOrigin as "DOMESTIC" | "IMPORTED",
                        )}
                        variant="neutral"
                      />
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
                  {product.unitPrice}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{product.weight}</td>
                <td className="px-4 py-2.5 text-slate-600">{product.yards}</td>
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
  );
});

export function ProductsList({
  products,
  taxonomy,
  pageInfo,
  filters,
}: ProductsListProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  const selectedType =
    filters.type && filters.type !== "All" ? filters.type : undefined;

  const categoryFilterOptions = useMemo(
    () =>
      buildCategoryFilterOptions(
        taxonomy,
        selectedType as Parameters<typeof buildCategoryFilterOptions>[1],
      ),
    [taxonomy, selectedType],
  );

  const showSubcategoryFilter =
    Boolean(filters.category) && filters.category !== "All";

  const subcategoryFilterOptions = useMemo(
    () =>
      showSubcategoryFilter
        ? buildSubcategoryFilterOptions(taxonomy, filters.category)
        : [{ id: "All", name: "All" }],
    [taxonomy, filters.category, showSubcategoryFilter],
  );

  const productTypeOptions = Object.entries(productTypeLabels);
  const showCastingOriginFilter = filters.type === "CASTING";

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
            onChange={(event) =>
              setParams({
                type: event.target.value,
                category: null,
                subcategory: null,
                castingOrigin: null,
              })
            }
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
              <option key={category.id} value={category.id}>
                Category: {category.name}
              </option>
            ))}
          </select>
          {showSubcategoryFilter ? (
            <select
              value={filters.subcategory || "All"}
              onChange={(event) =>
                setParams({ subcategory: event.target.value })
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
            >
              {subcategoryFilterOptions.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  Subcategory: {subcategory.name}
                </option>
              ))}
            </select>
          ) : null}
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
          {showCastingOriginFilter ? (
            <select
              value={filters.castingOrigin || "All"}
              onChange={(event) =>
                setParams({ castingOrigin: event.target.value })
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
            >
              {productCastingOriginFilterOptions.map((option) => (
                <option key={option} value={option}>
                  Origin: {option}
                </option>
              ))}
            </select>
          ) : null}
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
        <ProductsTable products={products} total={pageInfo.total} />
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
