"use client";

import Link from "next/link";
import { memo, useCallback } from "react";
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
import type { PageInfo } from "@/lib/list-params";
import {
  productKindBadgeVariant,
} from "@/lib/product-kinds";
import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableNumericCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

type ProductsListFilters = {
  search: string;
  type: string;
  status: string;
  submittals: string;
  castingOrigin: string;
};

type SortColumn =
  | "code"
  | "name"
  | "type"
  | "category"
  | "subcategory"
  | "unit"
  | "price"
  | "weight"
  | "yards"
  | "submittals";

type SortDirection = "asc" | "desc";

type ProductsListProps = {
  products: ProductRow[];
  pageInfo: PageInfo;
  filters: ProductsListFilters;
  sort: { column: SortColumn; direction: SortDirection };
};

const sortableHeaderClassName = `${tableHeaderCellClassName} cursor-pointer select-none transition-colors hover:bg-slate-200/60 hover:text-slate-700`;

type SortableHeaderProps = {
  column: SortColumn;
  label: string;
  align?: "right";
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
};

function SortableHeader({
  column,
  label,
  align,
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps) {
  const isActive = sortColumn === column;

  return (
    <th
      scope="col"
      className={`${sortableHeaderClassName}${align === "right" ? " text-right" : ""}`}
      onClick={() => onSort(column)}
      aria-sort={
        isActive
          ? sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          <span className="text-slate-400" aria-hidden="true">
            {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </span>
    </th>
  );
}

// Memoized so typing in the search box doesn't re-render the full row set;
// props only change on navigation (rows, sort state) and onSort is stable.
const ProductsTable = memo(function ProductsTable({
  products,
  total,
  sortColumn,
  sortDirection,
  onSort,
}: {
  products: ProductRow[];
  total: number;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const sortProps = { sortColumn, sortDirection, onSort };
  return (
    <div className={tableFlushWrapperClassName}>
      <table className={tableClassName}>
        <thead>
          <tr>
            <SortableHeader column="code" label="Product Code" {...sortProps} />
            <SortableHeader column="name" label="Product Name" {...sortProps} />
            <SortableHeader column="type" label="Product Type" {...sortProps} />
            <SortableHeader column="category" label="Category" {...sortProps} />
            <SortableHeader
              column="subcategory"
              label="Subcategory"
              {...sortProps}
            />
            <SortableHeader column="unit" label="Unit" {...sortProps} />
            <SortableHeader
              column="price"
              label="Unit Price"
              align="right"
              {...sortProps}
            />
            <SortableHeader
              column="weight"
              label="Weight"
              align="right"
              {...sortProps}
            />
            <SortableHeader
              column="yards"
              label="Yards"
              align="right"
              {...sortProps}
            />
            <SortableHeader
              column="submittals"
              label="Submittals"
              {...sortProps}
            />
            <th className={tableHeaderCellClassName}>Actions</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {products.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className={`${tableCellBordersClassName} px-4 py-8 text-center text-sm text-slate-500`}
              >
                {total === 0
                  ? "No products match your search or filters."
                  : "No products on this page."}
              </td>
            </tr>
          ) : (
            products.map((product) => (
              <tr key={product.id} className={tableRowClassName}>
                <td
                  className={`${tableCellClassName} font-mono text-[11px] font-medium text-slate-900`}
                >
                  {product.productCode}
                </td>
                <td className={`${tableCellClassName} font-medium text-slate-900`}>
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
                <td className={tableCellClassName}>
                  <StatusBadge
                    label={product.productTypeLabel}
                    variant={product.productTypeVariant}
                  />
                </td>
                <td className={tableCellClassName}>
                  <StatusBadge
                    label={product.category}
                    variant={product.categoryVariant}
                  />
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {product.subcategory}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {product.unit}
                </td>
                <td
                  className={`${tableNumericCellClassName} font-medium text-slate-900`}
                >
                  {product.unitPrice}
                </td>
                <td className={`${tableNumericCellClassName} text-slate-600`}>
                  {product.weight}
                </td>
                <td className={`${tableNumericCellClassName} text-slate-600`}>
                  {product.yards}
                </td>
                <td className={tableCellClassName}>
                  {product.submittalCount > 0 ? (
                    <StatusBadge
                      label={String(product.submittalCount)}
                      variant="success"
                    />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className={tableCellClassName}>
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
  pageInfo,
  filters,
  sort,
}: ProductsListProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  const handleSort = useCallback(
    (column: SortColumn) => {
      const nextDirection: SortDirection =
        sort.column === column && sort.direction === "asc" ? "desc" : "asc";
      setParams({ sort: column, dir: nextDirection });
    },
    [sort.column, sort.direction, setParams],
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
        <ProductsTable
          products={products}
          total={pageInfo.total}
          sortColumn={sort.column}
          sortDirection={sort.direction}
          onSort={handleSort}
        />
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
