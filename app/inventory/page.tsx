import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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
import { loadEffectiveSubmittalCountsByProductId } from "@/lib/submittal-package";
import { withDatabaseRetry } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

type InventoryPageProps = {
  searchParams: Promise<RawSearchParams>;
};

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const params = await searchParams;
  const requestedPage = parsePageParam(params.page);
  const castingOriginParam = parseStringParam(params.castingOrigin);

  const where: Prisma.ProductWhereInput = {
    trackInventory: true,
    status: "ACTIVE",
    ...(castingOriginParam === "Domestic"
      ? { castingSupplier: { origin: "DOMESTIC" } }
      : castingOriginParam === "Imported"
        ? { castingSupplier: { origin: "IMPORTED" } }
        : {}),
  };

  const total = await withDatabaseRetry((client) =>
    client.product.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

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
        castingRole: true,
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

  function filterHref(next: Record<string, string | null>) {
    const query = new URLSearchParams();
    const merged = {
      castingOrigin: castingOriginParam ?? "",
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) {
        query.set(key, value);
      }
    }
    const qs = query.toString();
    return qs ? `/inventory?${qs}` : "/inventory";
  }

  return (
    <DashboardShell
      title="Inventory"
      subtitle="Stock levels for products tracked in the yard."
    >
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={filterHref({ castingOrigin: null })}
            className={`rounded-lg border px-3 py-2 ${
              !castingOriginParam
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            All origins
          </Link>
          <Link
            href={filterHref({ castingOrigin: "Domestic" })}
            className={`rounded-lg border px-3 py-2 ${
              castingOriginParam === "Domestic"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Domestic
          </Link>
          <Link
            href={filterHref({ castingOrigin: "Imported" })}
            className={`rounded-lg border px-3 py-2 ${
              castingOriginParam === "Imported"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Imported
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventory/receipts"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Receipt History
          </Link>
          <Link
            href="/inventory/receive"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Receive Castings
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
        </div>
      </div>

      <SectionCard title="Current Stock" noPadding>
        {products.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No inventory-tracked products match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Code</th>
                  <th className="px-4 py-2 font-semibold">Product</th>
                  <th className="px-4 py-2 font-semibold">On Hand</th>
                  <th className="px-4 py-2 font-semibold">Reorder</th>
                  <th className="px-4 py-2 font-semibold">Yard</th>
                  <th className="px-4 py-2 font-semibold">Submittals</th>
                  <th className="px-4 py-2 font-semibold">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const low =
                    product.reorderLevel > 0 &&
                    product.currentStockQuantity <= product.reorderLevel;
                  return (
                    <tr key={product.id} className="text-slate-800 hover:bg-slate-50/60">
                      <td className="px-4 py-2 font-medium">
                        <Link
                          href={`/inventory/${product.id}`}
                          className="text-slate-900 hover:text-slate-700"
                        >
                          {product.productCode}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
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
                        className={`px-4 py-2 ${low ? "font-semibold text-amber-700" : ""}`}
                      >
                        {product.currentStockQuantity} {product.unit}
                      </td>
                      <td className="px-4 py-2">{product.reorderLevel}</td>
                      <td className="px-4 py-2">{product.yardLocation ?? "—"}</td>
                      <td className="px-4 py-2">
                        <InventorySubmittalsCell
                          productId={product.id}
                          submittalCount={
                            effectiveSubmittalCounts.get(product.id) ??
                            product._count.documents
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
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
