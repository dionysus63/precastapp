import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseReceiptForm } from "@/components/inventory/purchase-receipt-form";
import { loadCastingAssembliesWithBom } from "@/lib/casting-service";
import { withDatabaseRetry } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
export default async function ReceiveCastingsPage() {
  const [products, assemblies, suppliers] = await withDatabaseRetry((client) =>
    Promise.all([
      client.product.findMany({
        where: {
          status: "ACTIVE",
          trackInventory: true,
          OR: [
            { castingRole: "COMPONENT" },
            { castingRole: "ASSEMBLY", castingSoldAsUnit: true },
          ],
        },
        orderBy: { productCode: "asc" },
        select: {
          id: true,
          productCode: true,
          name: true,
          unit: true,
          castingPieceRole: true,
          castingRole: true,
          castingSoldAsUnit: true,
          manufacturerCode: true,
          castingSupplierId: true,
        },
      }),
      loadCastingAssembliesWithBom(client),
      client.castingSupplier.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, origin: true },
      }),
    ]),
  );

  return (
    <DashboardShell
      title="Receive Castings"
      subtitle="Record purchased cast iron inventory received from suppliers."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BackButton href="/inventory" label="Back to Inventory" />
        <Link
          href="/inventory/receipts"
          className="text-xs font-medium text-slate-700 underline hover:text-slate-900"
        >
          View receipt history
        </Link>
      </div>

      <PurchaseReceiptForm
        products={products.map((product) => ({
          ...product,
          castingPieceRole: product.castingPieceRole,
        }))}
        assemblies={assemblies.map((assembly) => ({
          id: assembly.id,
          productCode: assembly.productCode,
          name: assembly.name,
          manufacturerCode: assembly.manufacturerCode,
          castingSupplierId: assembly.castingSupplierId,
          components: assembly.castingAssemblyComponents.map((row) => ({
            pieceRole: row.pieceRole,
            quantity: row.quantity,
            component: row.component,
          })),
        }))}
        suppliers={suppliers}
      />
    </DashboardShell>
  );
}
