import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseOrderEditor } from "@/components/purchase-orders/purchase-order-editor";
import { listVendorsForPurchaseOrderForm } from "@/app/purchase-orders/actions";
import { canEditPurchaseOrder } from "@/lib/purchase-order-utils";
import { withDatabaseRetry } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [purchaseOrder, vendors] = await Promise.all([
    withDatabaseRetry((client) =>
      client.purchaseOrder.findUnique({
        where: { id },
        include: {
          lines: { orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }] },
        },
      }),
    ),
    listVendorsForPurchaseOrderForm(),
  ]);

  if (!purchaseOrder) {
    notFound();
  }

  if (!canEditPurchaseOrder(purchaseOrder.status)) {
    redirect(`/purchase-orders/${id}`);
  }

  return (
    <DashboardShell
      title={`Edit ${purchaseOrder.poNumber}`}
      subtitle="Update purchase order details and line items."
    >
      <BackButton href={`/purchase-orders/${id}`} label="Back to PO" />

      <PurchaseOrderEditor
        mode="edit"
        purchaseOrderId={id}
        vendors={vendors}
        initial={{
          vendorId: purchaseOrder.vendorId,
          category: purchaseOrder.category ?? "",
          orderDate: purchaseOrder.orderDate.toISOString().slice(0, 10),
          expectedDate: purchaseOrder.expectedDate
            ? purchaseOrder.expectedDate.toISOString().slice(0, 10)
            : "",
          notes: purchaseOrder.notes ?? "",
          enteredBy: purchaseOrder.enteredBy ?? "",
          updatedAt: purchaseOrder.updatedAt.toISOString(),
          vendorQuoteName: purchaseOrder.vendorQuoteName,
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
