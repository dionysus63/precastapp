import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProductionEntryForm } from "@/components/inventory/production-entry-form";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function InventoryProductionPage() {
  const products = await withDatabaseRetry((prisma) =>
    prisma.product.findMany({
      where: { trackInventory: true, status: "ACTIVE", productType: "STOCK" },
      orderBy: { productCode: "asc" },
      select: { id: true, productCode: true, name: true, unit: true },
    }),
  );

  return (
    <DashboardShell
      title="Daily Production Entry"
      subtitle="Record stock products made today — quantities are added to inventory."
    >
      <div className="mb-4">
        <Link href="/inventory" className="text-xs text-slate-600 hover:text-slate-900">
          ← Back to Inventory
        </Link>
      </div>
      <ProductionEntryForm products={products} />
    </DashboardShell>
  );
}
