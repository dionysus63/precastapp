import Link from "next/link";
import { CategoryChipBar } from "@/components/common/category-chip-bar";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { InventorySubmittalsCell } from "@/components/inventory/inventory-submittals-cell";
import { PaginationControls } from "@/components/common/pagination-controls";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatCastingSupplierOriginLabel } from "@/lib/casting-utils";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import { PRODUCT_SUBMITTAL_DOCUMENT_TYPES } from "@/lib/product-submittals-service";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { loadEffectiveSubmittalCountsByProductId } from "@/lib/submittal-package";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableNumericCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

type InventoryPageProps = {
  searchParams: Promise<RawSearchParams>;
};

const baseWhere: Prisma.ProductWhereInput = {
  trackInventory: true,
  status: "ACTIVE",
};

const lowStockWhere: Prisma.ProductWhereInput = {
  reorderLevel: { gt: 0 },
  currentStockQuantity: { lte: prisma.product.fields.reorderLevel },
};

const outOfStockWhere: Prisma.ProductWhereInput = {
  currentStockQuantity: { lte: 0 },
};

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const params = await searchParams;
  const requestedPage = parsePageParam(params.page);
  const search = parseStringParam(params.q);
  const stockParam = parseStringParam(params.stock);
  const castingOriginParam = parseStringParam(params.castingOrigin);
  const categoryParam = parseStringParam(params.category);
  const subcategoryParam = parseStringParam(params.subcategory);

  const categorySelected =
    categoryParam && categoryParam !== "All" ? categoryParam : null;
  const subcategorySelected =
    subcategoryParam && subcategoryParam !== "All" ? subcategoryParam : null;

  // Everything except the category/subcategory conditions — chip counts are
  // computed against this so each chip shows what selecting it would yield.
  const whereWithoutTaxonomy: Prisma.ProductWhereInput = {
    ...baseWhere,
    ...(search
      ? {
          OR: [
            { productCode: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { yardLocation: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(stockParam === "low"
      ? lowStockWhere
      : stockParam === "out"
        ? outOfStockWhere
        : {}),
    ...(castingOriginParam === "Domestic"
      ? { castingSupplier: { origin: "DOMESTIC" } }
      : castingOriginParam === "Imported"
        ? { castingSupplier: { origin: "IMPORTED" } }
        : {}),
  };

  const where: Prisma.ProductWhereInput = {
    ...whereWithoutTaxonomy,
    ...(categorySelected ? { categoryId: categorySelected } : {}),
    ...(subcategorySelected
      ? { subcategoryId: subcategorySelected === "none" ? null : subcategorySelected }
      : {}),
  };

  const [total, trackedCount, lowCount, outCount, categoryGroups, subcategoryGroups, taxonomy] =
    await withDatabaseRetry((client) =>
      Promise.all([
        client.product.count({ where }),
        client.product.count({ where: baseWhere }),
        client.product.count({ where: { ...baseWhere, ...lowStockWhere } }),
        client.product.count({ where: { ...baseWhere, ...outOfStockWhere } }),
        client.product.groupBy({
          by: ["categoryId"],
          where: whereWithoutTaxonomy,
          _count: { _all: true },
        }),
        categorySelected
          ? client.product.groupBy({
              by: ["subcategoryId"],
              where: { ...whereWithoutTaxonomy, categoryId: categorySelected },
              _count: { _all: true },
            })
          : Promise.resolve(
              [] as { subcategoryId: string | null; _count: { _all: number } }[],
            ),
        listProductTaxonomy(),
      ]),
    );
  const pageInfo = buildPageInfo(total, requestedPage);

  const categoryCountById = new Map(
    categoryGroups.map((group) => [group.categoryId, group._count._all]),
  );
  const categoryChips = taxonomy
    .filter(
      (category) =>
        (categoryCountById.get(category.id) ?? 0) > 0 ||
        category.id === categorySelected,
    )
    .map((category) => ({
      id: category.id,
      name: category.name,
      count: categoryCountById.get(category.id) ?? 0,
    }));

  const selectedCategory = taxonomy.find(
    (category) => category.id === categorySelected,
  );
  const subcategoryCountById = new Map(
    subcategoryGroups.map((group) => [
      group.subcategoryId ?? "none",
      group._count._all,
    ]),
  );
  const subcategoryChips = selectedCategory
    ? [
        ...selectedCategory.subcategories
          .filter(
            (subcategory) =>
              (subcategoryCountById.get(subcategory.id) ?? 0) > 0 ||
              subcategory.id === subcategorySelected,
          )
          .map((subcategory) => ({
            id: subcategory.id,
            name: subcategory.name,
            count: subcategoryCountById.get(subcategory.id) ?? 0,
          })),
        ...((subcategoryCountById.get("none") ?? 0) > 0 &&
        selectedCategory.subcategories.length > 0
          ? [
              {
                id: "none",
                name: "Other",
                count: subcategoryCountById.get("none") ?? 0,
              },
            ]
          : []),
      ]
    : [];

  const products = await withDatabaseRetry((client) =>
    client.product.findMany({
      where,
      orderBy: { productCode: "asc" },
      skip: pageInfo.skip,
      take: pageInfo.take,
      select: {
        id: true,
        productCode: true,
        name: true,
        currentStockQuantity: true,
        reorderLevel: true,
        yardLocation: true,
        unit: true,
        castingSoldAsUnit: true,
        castingSupplier: { select: { origin: true } },
        _count: {
          select: {
            documents: {
              where: {
                documentType: { in: PRODUCT_SUBMITTAL_DOCUMENT_TYPES },
              },
            },
          },
        },
      },
    }),
  );

  const effectiveSubmittalCounts = await withDatabaseRetry((client) =>
    loadEffectiveSubmittalCountsByProductId(
      client,
      products.map((product) => product.id),
    ),
  );

  const hasActiveFilters = Boolean(
    search || stockParam || castingOriginParam || categorySelected,
  );

  const summaryCards = [
    {
      label: "Tracked Products",
      value: trackedCount,
      href: "/inventory",
      active: !stockParam,
      valueClassName: "text-slate-900",
    },
    {
      label: "Low Stock",
      value: lowCount,
      href: "/inventory?stock=low",
      active: stockParam === "low",
      valueClassName: lowCount > 0 ? "text-amber-700" : "text-slate-900",
    },
    {
      label: "Out of Stock",
      value: outCount,
      href: "/inventory?stock=out",
      active: stockParam === "out",
      valueClassName: outCount > 0 ? "text-red-700" : "text-slate-900",
    },
  ];

  return (
    <DashboardShell
      title="Inventory"
      subtitle="Stock levels for products tracked in the yard."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded-xl border bg-white px-4 py-3 shadow-sm transition hover:bg-slate-50 ${
              card.active ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </div>
            <div className={`mt-1 text-xl font-semibold ${card.valueClassName}`}>
              {card.value}
            </div>
          </Link>
        ))}
      </div>

      <div className="mb-4">
        <CategoryChipBar
          categories={categoryChips}
          subcategories={subcategoryChips}
          selectedCategoryId={categorySelected}
          selectedSubcategoryId={subcategorySelected}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <InventoryFilters
          filters={{
            search: search ?? "",
            stock: stockParam ?? "",
            castingOrigin: castingOriginParam ?? "",
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventory/receipts"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Receipt History
          </Link>
          <Link
            href="/inventory/adjust"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Adjust Stock
          </Link>
          <Link
            href="/inventory/production"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Daily Production Entry
          </Link>
          <Link
            href="/inventory/receive"
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Receive Castings
          </Link>
        </div>
      </div>

      <SectionCard title="Current Stock" noPadding>
        {products.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            <p>No inventory-tracked products match these filters.</p>
            {hasActiveFilters ? (
              <Link
                href="/inventory"
                className="mt-2 inline-block text-xs font-medium text-slate-700 underline hover:text-slate-900"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        ) : (
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Code</th>
                  <th className={tableHeaderCellClassName}>Product</th>
                  <th className={`${tableHeaderCellClassName} text-right`}>
                    On Hand
                  </th>
                  <th className={`${tableHeaderCellClassName} text-right`}>
                    Reorder
                  </th>
                  <th className={tableHeaderCellClassName}>Yard</th>
                  <th className={tableHeaderCellClassName}>Submittals</th>
                  <th className={tableHeaderCellClassName}>History</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {products.map((product) => {
                  const out = product.currentStockQuantity <= 0;
                  const low =
                    !out &&
                    product.reorderLevel > 0 &&
                    product.currentStockQuantity <= product.reorderLevel;
                  return (
                    <tr
                      key={product.id}
                      className={`${tableRowClassName} text-slate-800 ${
                        out ? "bg-red-50/40" : low ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <td className={`${tableCellClassName} font-medium`}>
                        <Link
                          href={`/inventory/${product.id}`}
                          className="text-slate-900 hover:text-slate-700"
                        >
                          {product.productCode}
                        </Link>
                      </td>
                      <td className={tableCellClassName}>
                        <div>{product.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {product.castingSupplier?.origin ? (
                            <StatusBadge
                              label={formatCastingSupplierOriginLabel(
                                product.castingSupplier.origin,
                              )}
                              variant="neutral"
                            />
                          ) : null}
                          {product.castingSoldAsUnit ? (
                            <StatusBadge label="One-piece" variant="info" />
                          ) : null}
                        </div>
                      </td>
                      <td
                        className={`${tableNumericCellClassName} whitespace-nowrap ${
                          out
                            ? "font-semibold text-red-700"
                            : low
                              ? "font-semibold text-amber-700"
                              : ""
                        }`}
                      >
                        {product.currentStockQuantity} {product.unit}
                        {out ? (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                            Out
                          </span>
                        ) : low ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                            Low
                          </span>
                        ) : null}
                      </td>
                      <td className={tableNumericCellClassName}>
                        {product.reorderLevel > 0 ? product.reorderLevel : "—"}
                      </td>
                      <td className={tableCellClassName}>
                        {product.yardLocation ?? "—"}
                      </td>
                      <td className={tableCellClassName}>
                        <InventorySubmittalsCell
                          productId={product.id}
                          submittalCount={
                            effectiveSubmittalCounts.get(product.id) ??
                            product._count.documents
                          }
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <Link
                          href={`/inventory/${product.id}`}
                          className="text-slate-700 underline hover:text-slate-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationControls
              page={pageInfo.page}
              totalPages={pageInfo.totalPages}
              fromIndex={pageInfo.fromIndex}
              toIndex={pageInfo.toIndex}
              total={pageInfo.total}
              noun="product"
            />
          </div>
        )}
      </SectionCard>
    </DashboardShell>
  );
}
