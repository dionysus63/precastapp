import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProductionEntryForm } from "@/components/inventory/production-entry-form";
import { PHYSICAL_PRODUCT_TYPES } from "@/lib/product-types";
import { withDatabaseRetry } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
export default async function InventoryProductionPage() {
  const products = await withDatabaseRetry((prisma) =>
    prisma.product.findMany({
      where: {
        trackInventory: true,
        status: "ACTIVE",
        productType: { in: [...PHYSICAL_PRODUCT_TYPES] },
      },
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
        <BackButton href="/inventory" label="Back to Inventory" />
      </div>
      <ProductionEntryForm products={products} />
    </DashboardShell>
  );
}
