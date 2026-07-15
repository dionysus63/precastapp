import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseOrderDetailContent } from "@/components/purchase-orders/purchase-order-detail-content";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { mapPurchaseOrderDetail } from "@/lib/purchase-order-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canManage = user
    ? await hasPermission(user, AppPermission.INVENTORY_MANAGE)
    : false;

  const purchaseOrder = await withDatabaseRetry((client) =>
    client.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: { select: { name: true } },
        lines: { orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }] },
        receipts: {
          orderBy: [{ receiptDate: "desc" }],
          select: {
            id: true,
            receiptDate: true,
            enteredBy: true,
          },
        },
      },
    }),
  );

  if (!purchaseOrder) {
    notFound();
  }

  const view = mapPurchaseOrderDetail({
    ...purchaseOrder,
    linesFull: purchaseOrder.lines,
    lines: purchaseOrder.lines,
  });

  return (
    <DashboardShell
      title={view.poNumber}
      subtitle={`${view.vendorName} · ${view.categoryLabel}`}
    >
      <BackButton href="/purchase-orders" label="Back to Purchase Orders" />

      <PurchaseOrderDetailContent purchaseOrder={view} canManage={canManage} />
    </DashboardShell>
  );
}
