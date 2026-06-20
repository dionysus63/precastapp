import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AdjustForm } from "@/components/inventory/adjust-form";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function InventoryAdjustPage() {
  const products = await withDatabaseRetry((prisma) =>
    prisma.product.findMany({
      where: { trackInventory: true, status: "ACTIVE" },
      orderBy: { productCode: "asc" },
      select: {
        id: true,
        productCode: true,
        name: true,
        unit: true,
        currentStockQuantity: true,
      },
    }),
  );

  return (
    <DashboardShell
      title="Inventory Adjustment"
      subtitle="Manually add or remove stock with a ledger entry."
    >
      <Link
        href="/inventory"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Inventory
      </Link>
      <div className="mt-4">
        <AdjustForm products={products} />
      </div>
    </DashboardShell>
  );
}
