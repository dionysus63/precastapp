import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseOrderEditor } from "@/components/purchase-orders/purchase-order-editor";
import { listVendorsForPurchaseOrderForm } from "@/app/purchase-orders/actions";

export default async function NewPurchaseOrderPage() {
  const vendors = await listVendorsForPurchaseOrderForm();

  return (
    <DashboardShell
      title="New Purchase Order"
      subtitle="Attach a vendor quote PDF and enter line items for accounts payable."
    >
      <Link
        href="/purchase-orders"
        className="mb-4 inline-block text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Purchase Orders
      </Link>

      <PurchaseOrderEditor mode="create" vendors={vendors} />
    </DashboardShell>
  );
}
