import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { withDatabaseRetry } from "@/lib/prisma";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
type ProductInventoryPageProps = {
  params: Promise<{ productId: string }>;
};

export default async function ProductInventoryPage({
  params,
}: ProductInventoryPageProps) {
  const { productId } = await params;

  // Independent queries (transactions only need productId) — run in parallel.
  const [product, transactions] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          productCode: true,
          name: true,
          unit: true,
          currentStockQuantity: true,
          reorderLevel: true,
          yardLocation: true,
          trackInventory: true,
        },
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.inventoryTransaction.findMany({
        where: { productId },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
    ),
  ]);

  if (!product || !product.trackInventory) {
    notFound();
  }

  const low =
    product.reorderLevel > 0 &&
    product.currentStockQuantity <= product.reorderLevel;

  return (
    <DashboardShell
      title={`${product.productCode} — Inventory`}
      subtitle={product.name}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/inventory"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Inventory
        </Link>
        <Link
          href={`/inventory/adjust?productId=${product.id}`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          Adjust stock
        </Link>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <SectionCard title="On hand">
          <p
            className={`text-2xl font-semibold ${low ? "text-amber-700" : "text-slate-900"}`}
          >
            {product.currentStockQuantity} {product.unit}
          </p>
          {low ? (
            <StatusBadge label="Below reorder level" variant="warning" />
          ) : null}
        </SectionCard>
        <SectionCard title="Reorder level">
          <p className="text-2xl font-semibold text-slate-900">
            {product.reorderLevel} {product.unit}
          </p>
        </SectionCard>
        <SectionCard title="Yard location">
          <p className="text-sm text-slate-700">{product.yardLocation ?? "—"}</p>
        </SectionCard>
      </div>

      <SectionCard title="Transaction history" noPadding>
        {transactions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No transactions yet.</p>
        ) : (
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Date</th>
                  <th className={tableHeaderCellClassName}>Type</th>
                  <th className={tableHeaderCellClassName}>Change</th>
                  <th className={tableHeaderCellClassName}>Notes</th>
                  <th className={tableHeaderCellClassName}>By</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className={`${tableCellClassName} whitespace-nowrap`}>
                      {new Date(txn.transactionDate).toLocaleDateString()}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge
                        label={txn.transactionType.replace(/_/g, " ")}
                        variant={
                          txn.transactionType === "PRODUCTION"
                            ? "success"
                            : txn.transactionType === "DELIVERY"
                              ? "warning"
                              : "neutral"
                        }
                      />
                    </td>
                    <td
                      className={`px-4 py-2 font-medium ${Number(txn.quantityChange) >= 0 ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {Number(txn.quantityChange) >= 0 ? "+" : ""}
                      {Number(txn.quantityChange)} {product.unit}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{txn.notes ?? "—"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{txn.createdBy ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </DashboardShell>
  );
}
