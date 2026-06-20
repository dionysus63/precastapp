import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { withDatabaseRetry } from "@/lib/prisma";

type ProductInventoryPageProps = {
  params: Promise<{ productId: string }>;
};

export default async function ProductInventoryPage({
  params,
}: ProductInventoryPageProps) {
  const { productId } = await params;

  const product = await withDatabaseRetry((prisma) =>
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
  );

  if (!product || !product.trackInventory) {
    notFound();
  }

  const transactions = await withDatabaseRetry((prisma) =>
    prisma.inventoryTransaction.findMany({
      where: { productId },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  );

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
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Change</th>
                  <th className="px-4 py-2 font-semibold">Notes</th>
                  <th className="px-4 py-2 font-semibold">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(txn.transactionDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
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
                    <td className="px-4 py-2 text-slate-600">{txn.notes ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{txn.createdBy ?? "—"}</td>
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
