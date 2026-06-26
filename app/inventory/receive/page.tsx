import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseReceiptForm } from "@/components/inventory/purchase-receipt-form";
import { loadCastingAssembliesWithBom } from "@/lib/casting-service";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function ReceiveCastingsPage() {
  const [products, assemblies, suppliers] = await withDatabaseRetry((client) =>
    Promise.all([
      client.product.findMany({
        where: {
          castingRole: "COMPONENT",
          trackInventory: true,
          status: "ACTIVE",
        },
        orderBy: { productCode: "asc" },
        select: {
          id: true,
          productCode: true,
          name: true,
          unit: true,
          castingPieceRole: true,
        },
      }),
      loadCastingAssembliesWithBom(client),
      client.castingSupplier.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      }),
    ]),
  );

  return (
    <DashboardShell
      title="Receive Castings"
      subtitle="Record purchased cast iron components received from suppliers."
    >
      <Link
        href="/inventory"
        className="mb-4 inline-block text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Inventory
      </Link>

      <PurchaseReceiptForm
        products={products.map((product) => ({
          ...product,
          castingPieceRole: product.castingPieceRole,
        }))}
        assemblies={assemblies.map((assembly) => ({
          id: assembly.id,
          productCode: assembly.productCode,
          name: assembly.name,
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
