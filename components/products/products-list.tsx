"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  type ProductRow,
  productInventoryFilterOptions,
  productStatusFilterOptions,
  productSubmittalsFilterOptions,
  productTypeFilterOptions,
} from "@/components/products/product-utils";
import { ExportExcelLink } from "@/components/shared/export-excel-link";
import {
  buildCategoryFilterOptions,
  buildSubcategoryFilterOptions,
  mergeCatalogWithInUseValues,
  type ProductCatalogCategory,
} from "@/lib/product-catalog-settings";

type ProductsListProps = {
  products: ProductRow[];
  catalog: ProductCatalogCategory[];
};

export function ProductsList({ products, catalog }: ProductsListProps) {
  const [search, setSearch] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [subcategoryFilter, setSubcategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [inventoryFilter, setInventoryFilter] = useState("All");
  const [submittalsFilter, setSubmittalsFilter] = useState("All");

  const mergedCatalog = useMemo(
    () =>
      mergeCatalogWithInUseValues(
        catalog,
        products.map((product) => ({
          category: product.category,
          subcategory: product.subcategory,
        })),
      ),
    [catalog, products],
  );

  const categoryFilterOptions = useMemo(
    () => buildCategoryFilterOptions(mergedCatalog),
    [mergedCatalog],
  );

  const subcategoryFilterOptions = useMemo(
    () => buildSubcategoryFilterOptions(mergedCatalog, categoryFilter),
    [mergedCatalog, categoryFilter],
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        search.trim() === "" ||
        product.productCode.toLowerCase().includes(search.toLowerCase()) ||
        product.productName.toLowerCase().includes(search.toLowerCase()) ||
        product.category.toLowerCase().includes(search.toLowerCase()) ||
        product.subcategory.toLowerCase().includes(search.toLowerCase()) ||
        product.productTypeLabel.toLowerCase().includes(search.toLowerCase());

      const matchesProductType =
        productTypeFilter === "All" ||
        product.productTypeLabel === productTypeFilter;

      const matchesCategory =
        categoryFilter === "All" || product.category === categoryFilter;

      const matchesSubcategory =
        subcategoryFilter === "All" || product.subcategory === subcategoryFilter;

      const matchesStatus =
        statusFilter === "All" || product.status === statusFilter;

      const matchesInventory =
        inventoryFilter === "All" ||
        (inventoryFilter === "Yes" && product.trackInventory) ||
        (inventoryFilter === "No" && !product.trackInventory);

      const matchesSubmittals =
        submittalsFilter === "All" ||
        (submittalsFilter === "Has submittals" && product.submittalCount > 0) ||
        (submittalsFilter === "Missing submittals" && product.submittalCount === 0);

      return (
        matchesSearch &&
        matchesProductType &&
        matchesCategory &&
        matchesSubcategory &&
        matchesStatus &&
        matchesInventory &&
        matchesSubmittals
      );
    });
  }, [
    products,
    search,
    productTypeFilter,
    categoryFilter,
    subcategoryFilter,
    statusFilter,
    inventoryFilter,
    submittalsFilter,
  ]);

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
            value={productTypeFilter}
            onChange={(event) => setProductTypeFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {productTypeFilterOptions.map((productType) => (
              <option key={productType} value={productType}>
                Product Type: {productType}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setSubcategoryFilter("All");
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {categoryFilterOptions.map((category) => (
              <option key={category} value={category}>
                Category: {category}
              </option>
            ))}
          </select>
          <select
            value={subcategoryFilter}
            onChange={(event) => setSubcategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {subcategoryFilterOptions.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                Subcategory: {subcategory}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {productStatusFilterOptions.map((status) => (
              <option key={status} value={status}>
                Status: {status}
              </option>
            ))}
          </select>
          <select
            value={inventoryFilter}
            onChange={(event) => setInventoryFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {productInventoryFilterOptions.map((option) => (
              <option key={option} value={option}>
                Track Inventory: {option}
              </option>
            ))}
          </select>
          <select
            value={submittalsFilter}
            onChange={(event) => setSubmittalsFilter(event.target.value)}
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
        description={`${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"} shown`}
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
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    {products.length === 0
                      ? "No products yet. Add your first product to get started."
                      : "No products match your search or filters."}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-[11px] font-medium text-slate-900">
                      {product.productCode}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-1.5">
                        {product.productName}
                        {product.isCasting ? (
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
      </SectionCard>
    </div>
  );
}
