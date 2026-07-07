import type { PurchaseOrder, PurchaseOrderLine, Vendor } from "@/app/generated/prisma/client";
import { purchaseOrderStatusLabels } from "@/lib/purchase-order-utils";
import { formatReceivingCategoryLabel } from "@/lib/receiving-utils";
import { purchaseOrderStatusVariant } from "@/lib/status-variants";

type PoWithVendor = {
  id: string;
  poNumber: string;
  orderDate: Date;
  category: PurchaseOrder["category"];
  status: PurchaseOrder["status"];
  total: PurchaseOrder["total"];
  vendor: Pick<Vendor, "name">;
  lines?: Array<{
    quantityOrdered: PurchaseOrderLine["quantityOrdered"] | number;
    quantityReceived: PurchaseOrderLine["quantityReceived"] | number;
  }>;
  receipts?: Array<{
    id: string;
    receiptDate: Date;
    enteredBy: string | null;
  }>;
  expectedDate?: PurchaseOrder["expectedDate"];
  notes?: PurchaseOrder["notes"];
  enteredBy?: PurchaseOrder["enteredBy"];
  vendorQuotePath?: PurchaseOrder["vendorQuotePath"];
  vendorQuoteName?: PurchaseOrder["vendorQuoteName"];
  updatedAt?: PurchaseOrder["updatedAt"];
  linesFull?: PurchaseOrderLine[];
};

export function mapPurchaseOrderListRow(po: PoWithVendor) {
  const lines = po.lines ?? po.linesFull ?? [];
  const orderedTotal = lines.reduce((sum, line) => {
    const qty =
      typeof line.quantityOrdered === "number"
        ? line.quantityOrdered
        : line.quantityOrdered.toNumber();
    return sum + qty;
  }, 0);
  const receivedTotal = lines.reduce((sum, line) => {
    const qty =
      typeof line.quantityReceived === "number"
        ? line.quantityReceived
        : line.quantityReceived.toNumber();
    return sum + qty;
  }, 0);

  return {
    id: po.id,
    poNumber: po.poNumber,
    vendorName: po.vendor.name,
    orderDate: po.orderDate,
    orderDateLabel: po.orderDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    category: po.category,
    categoryLabel: po.category
      ? formatReceivingCategoryLabel(po.category)
      : "One-off",
    status: po.status,
    statusLabel: purchaseOrderStatusLabels[po.status],
    statusVariant: purchaseOrderStatusVariant(po.status),
    total: po.total.toNumber(),
    receivedProgress:
      orderedTotal > 0 ? `${receivedTotal} / ${orderedTotal}` : "—",
  };
}

export function mapPurchaseOrderDetail(po: PoWithVendor) {
  const listRow = mapPurchaseOrderListRow(po);
  const lines = (po.linesFull ?? []).map((line) => ({
    id: line.id,
    lineNumber: line.lineNumber,
    productId: line.productId,
    itemCode: line.itemCode,
    description: line.description,
    quantityOrdered: line.quantityOrdered.toNumber(),
    quantityReceived: line.quantityReceived.toNumber(),
    unit: line.unit,
    unitPrice: line.unitPrice.toNumber(),
    total: line.total.toNumber(),
    overReceived:
      line.quantityReceived.toNumber() > line.quantityOrdered.toNumber(),
  }));

  return {
    ...listRow,
    expectedDate: po.expectedDate,
    expectedDateLabel: po.expectedDate
      ? po.expectedDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    notes: po.notes ?? null,
    enteredBy: po.enteredBy ?? null,
    vendorQuoteName: po.vendorQuoteName ?? null,
    hasVendorQuote: Boolean(po.vendorQuotePath),
    updatedAt: po.updatedAt?.toISOString() ?? new Date().toISOString(),
    lines,
    receipts: po.receipts ?? [],
  };
}
