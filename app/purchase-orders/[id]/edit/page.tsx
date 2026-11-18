import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseOrderEditor } from "@/components/purchase-orders/purchase-order-editor";
import { listVendorsForPurchaseOrderForm } from "@/app/purchase-orders/actions";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { canEditPurchaseOrder } from "@/lib/purchase-order-utils";
import { toCalendarDateInput } from "@/lib/date-only";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [purchaseOrder, vendors, user] = await Promise.all([
    withDatabaseRetry((client) =>
      client.purchaseOrder.findUnique({
        where: { id },
        include: {
          lines: { orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }] },
        },
      }),
    ),
    listVendorsForPurchaseOrderForm(),
    getCurrentUser(),
  ]);
  // Adding a vendor here is the same act as in Settings, Vendors.
  const canAddVendor = user
    ? await hasPermission(user, AppPermission.SETTINGS_MANAGE)
    : false;

  if (!purchaseOrder) {
    notFound();
  }

  if (!canEditPurchaseOrder(purchaseOrder.status)) {
    redirect(`/purchase-orders/${id}`);
  }

  return (
    // Full width: the live purchase order PDF sits beside the inputs.
    <DashboardShell title={`Edit ${purchaseOrder.poNumber}`} width="full">
      <PurchaseOrderEditor
        mode="edit"
        purchaseOrderId={id}
        vendors={vendors}
        backHref={`/purchase-orders/${id}`}
        backLabel="Back to PO"
        canAddVendor={canAddVendor}
        initial={{
          vendorId: purchaseOrder.vendorId,
          category: purchaseOrder.category ?? "",
          orderDate: toCalendarDateInput(purchaseOrder.orderDate),
          expectedDate: purchaseOrder.expectedDate
            ? toCalendarDateInput(purchaseOrder.expectedDate)
            : "",
          notes: purchaseOrder.notes ?? "",
          enteredBy: purchaseOrder.enteredBy ?? "",
          updatedAt: purchaseOrder.updatedAt.toISOString(),
          vendorQuoteName: purchaseOrder.vendorQuoteName,
          taxable: purchaseOrder.taxable,
          quoteOnly: purchaseOrder.quoteOnly,
          quoteNumber: purchaseOrder.quoteNumber,
          quoteDate: purchaseOrder.quoteDate
            ? toCalendarDateInput(purchaseOrder.quoteDate)
            : "",
          quoteTotal: purchaseOrder.total.toNumber(),
          lines: purchaseOrder.lines.map((line) => ({
            productId: line.productId,
            itemCode: line.itemCode,
            description: line.description,
            quantityOrdered: line.quantityOrdered.toNumber(),
            unit: line.unit,
            unitPrice: line.unitPrice.toNumber(),
          })),
        }}
      />
    </DashboardShell>
  );
}
