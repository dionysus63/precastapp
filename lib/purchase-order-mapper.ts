import type { PurchaseOrder, PurchaseOrderLine, Vendor } from "@/app/generated/prisma/client";
import { formatCalendarDateShort } from "@/lib/date-only";
import {
  purchaseOrderJobLabel,
  purchaseOrderStatusLabels,
} from "@/lib/purchase-order-utils";
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
  attention?: PurchaseOrder["attention"];
  vendorQuotePath?: PurchaseOrder["vendorQuotePath"];
  vendorQuoteName?: PurchaseOrder["vendorQuoteName"];
  taxable?: PurchaseOrder["taxable"];
  quoteOnly?: PurchaseOrder["quoteOnly"];
  quoteNumber?: PurchaseOrder["quoteNumber"];
  quoteDate?: PurchaseOrder["quoteDate"];
  updatedAt?: PurchaseOrder["updatedAt"];
  linesFull?: PurchaseOrderLine[];
  internalNotes?: PurchaseOrder["internalNotes"];
  jobName?: PurchaseOrder["jobName"];
  /** The job on file the order is linked to, when it was loaded. */
  job?: { id: string; jobNumber: string; projectName: string } | null;
  /** The contractors the order is for, when they were loaded, in order. */
  contractors?: Array<{ customer: { id: string; name: string } }>;
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
    orderDateLabel: formatCalendarDateShort(po.orderDate),
    category: po.category,
    categoryLabel: po.category
      ? formatReceivingCategoryLabel(po.category)
      : "One-off",
    status: po.status,
    statusLabel: purchaseOrderStatusLabels[po.status],
    statusVariant: purchaseOrderStatusVariant(po.status),
    total: po.total.toNumber(),
    /** Who created it: the "Entered by" name on the order. */
    enteredBy: po.enteredBy?.trim() || null,
    /** The contractors (customers) the purchase is for. */
    contractors: (po.contractors ?? []).map((entry) => entry.customer),
    /** The job on file the purchase is for, or null (see jobLabel). */
    jobId: po.job?.id ?? null,
    /** The job as shown: the job on file as it is named now, or the typed name. */
    jobLabel: po.job ? purchaseOrderJobLabel(po.job) : po.jobName?.trim() || null,
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
      ? formatCalendarDateShort(po.expectedDate)
      : null,
    notes: po.notes ?? null,
    internalNotes: po.internalNotes?.trim() || null,
    enteredBy: po.enteredBy ?? null,
    attention: po.attention ?? null,
    vendorQuoteName: po.vendorQuoteName ?? null,
    hasVendorQuote: Boolean(po.vendorQuotePath),
    taxable: po.taxable ?? false,
    quoteOnly: po.quoteOnly ?? false,
    quoteNumber: po.quoteNumber ?? null,
    quoteDateLabel: po.quoteDate ? formatCalendarDateShort(po.quoteDate) : null,
    updatedAt: po.updatedAt?.toISOString() ?? new Date().toISOString(),
    lines,
    receipts: po.receipts ?? [],
  };
}
