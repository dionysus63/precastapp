import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseOrderEditor } from "@/components/purchase-orders/purchase-order-editor";
import { listVendorsForPurchaseOrderForm } from "@/app/purchase-orders/actions";

import { BackButton } from "@/components/dashboard/back-button";
export default async function NewPurchaseOrderPage() {
  const vendors = await listVendorsForPurchaseOrderForm();

  return (
    <DashboardShell
      title="New Purchase Order"
    >
      <BackButton href="/purchase-orders" label="Back to Purchase Orders" />

      <PurchaseOrderEditor mode="create" vendors={vendors} />
    </DashboardShell>
  );
}
