import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseOrderEditor } from "@/components/purchase-orders/purchase-order-editor";
import { listVendorsForPurchaseOrderForm } from "@/app/purchase-orders/actions";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NewPurchaseOrderPage() {
  const [vendors, user] = await Promise.all([
    listVendorsForPurchaseOrderForm(),
    getCurrentUser(),
  ]);

  return (
    // Full width: the live purchase order PDF sits beside the inputs.
    <DashboardShell title="New Purchase Order" width="full">
      <PurchaseOrderEditor
        mode="create"
        vendors={vendors}
        backHref="/purchase-orders"
        backLabel="Back to Purchase Orders"
        defaultEnteredBy={user?.displayName ?? ""}
      />
    </DashboardShell>
  );
}
