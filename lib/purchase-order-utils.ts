import type {
  PurchaseOrderStatus,
  ReceivingCategory,
} from "@/app/generated/prisma/client";
import { formatReceivingCategoryLabel } from "@/lib/receiving-utils";

export type { PurchaseOrderStatus, ReceivingCategory };

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const purchaseOrderStatusFormOptions: {
  value: PurchaseOrderStatus;
  label: string;
}[] = Object.entries(purchaseOrderStatusLabels).map(([value, label]) => ({
  value: value as PurchaseOrderStatus,
  label,
}));

export const OPEN_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "ISSUED",
  "PARTIALLY_RECEIVED",
];

export const purchaseOrderCategoryFormOptions: Array<{
  value: string;
  label: string;
}> = [
  { value: "", label: "One-off (AP only)" },
  { value: "RCP", label: formatReceivingCategoryLabel("RCP") },
  { value: "ADS_PIPE", label: formatReceivingCategoryLabel("ADS_PIPE") },
  {
    value: "DOMESTIC_CASTINGS",
    label: formatReceivingCategoryLabel("DOMESTIC_CASTINGS"),
  },
  {
    value: "IMPORTED_CASTINGS",
    label: formatReceivingCategoryLabel("IMPORTED_CASTINGS"),
  },
];

export function parsePurchaseOrderStatus(
  value: string,
): PurchaseOrderStatus | null {
  const normalized = value.trim().toUpperCase();
  if (
    normalized === "DRAFT" ||
    normalized === "ISSUED" ||
    normalized === "PARTIALLY_RECEIVED" ||
    normalized === "RECEIVED" ||
    normalized === "CANCELLED"
  ) {
    return normalized;
  }
  return null;
}

export function canEditPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "DRAFT" || status === "ISSUED";
}

export function formatPurchaseOrderProgress(
  quantityOrdered: number,
  quantityReceived: number,
): string {
  return `${quantityReceived} / ${quantityOrdered}`;
}

export function purchaseOrderReceivePercent(
  quantityOrdered: number,
  quantityReceived: number,
): number {
  if (quantityOrdered <= 0) {
    return quantityReceived > 0 ? 100 : 0;
  }
  return Math.min(100, Math.round((quantityReceived / quantityOrdered) * 100));
}

export function getRemainingPoLineQuantity(
  quantityOrdered: number | { toNumber(): number },
  quantityReceived: number | { toNumber(): number },
): number {
  const ordered =
    typeof quantityOrdered === "number"
      ? quantityOrdered
      : quantityOrdered.toNumber();
  const received =
    typeof quantityReceived === "number"
      ? quantityReceived
      : quantityReceived.toNumber();
  return Math.max(0, Math.ceil(ordered - received));
}
