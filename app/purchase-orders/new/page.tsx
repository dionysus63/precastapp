import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseOrderEditor } from "@/components/purchase-orders/purchase-order-editor";
import { listVendorsForPurchaseOrderForm } from "@/app/purchase-orders/actions";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NewPurchaseOrderPage() {
  const [vendors, user] = await Promise.all([
    listVendorsForPurchaseOrderForm(),
    getCurrentUser(),
  ]);

  // Adding a vendor here is the same act as in Settings, Vendors.
  const canAddVendor = user
    ? await hasPermission(user, AppPermission.SETTINGS_MANAGE)
    : false;

  return (
    // Full width: the live purchase order PDF sits beside the inputs.
    <DashboardShell title="New Purchase Order" width="full">
      <PurchaseOrderEditor
        mode="create"
        vendors={vendors}
        backHref="/purchase-orders"
        backLabel="Back to Purchase Orders"
        defaultEnteredBy={user?.displayName ?? ""}
        canAddVendor={canAddVendor}
      />
    </DashboardShell>
  );
}
