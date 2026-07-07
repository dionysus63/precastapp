"use client";

import { useMemo } from "react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getRemainingPoLineQuantity } from "@/lib/purchase-order-utils";

export type PurchaseOrderReceiptOption = {
  id: string;
  poNumber: string;
  vendorName: string;
  lines: Array<{
    productId: string | null;
    itemCode: string;
    description: string | null;
    quantityOrdered: { toNumber(): number } | number;
    quantityReceived: { toNumber(): number } | number;
  }>;
};

export type PrefilledReceiptLine = {
  productId: string;
  quantityReceived: string;
};

export function buildPrefilledReceiptLines(
  purchaseOrder: PurchaseOrderReceiptOption,
): PrefilledReceiptLine[] {
  return purchaseOrder.lines
    .filter((line) => line.productId)
    .map((line) => ({
      productId: line.productId!,
      quantityReceived: String(
        getRemainingPoLineQuantity(line.quantityOrdered, line.quantityReceived),
      ),
    }))
    .filter((line) => Number(line.quantityReceived) > 0);
}

type PurchaseOrderReceiptBannerProps = {
  lockedPurchaseOrder?: PurchaseOrderReceiptOption | null;
  openPurchaseOrders?: PurchaseOrderReceiptOption[];
  selectedPurchaseOrderId: string;
  onSelectPurchaseOrderId: (purchaseOrderId: string) => void;
};

export function PurchaseOrderReceiptBanner({
  lockedPurchaseOrder,
  openPurchaseOrders = [],
  selectedPurchaseOrderId,
  onSelectPurchaseOrderId,
}: PurchaseOrderReceiptBannerProps) {
  const selectedPo = useMemo(
    () =>
      openPurchaseOrders.find((po) => po.id === selectedPurchaseOrderId) ??
      null,
    [openPurchaseOrders, selectedPurchaseOrderId],
  );

  if (lockedPurchaseOrder) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
        Receiving against purchase order{" "}
        <span className="font-semibold">{lockedPurchaseOrder.poNumber}</span>.
        Quantities will deduct from the PO when saved.
      </div>
    );
  }

  if (openPurchaseOrders.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <label htmlFor="purchaseOrderId" className="text-xs font-medium text-slate-700">
        Apply to purchase order (optional)
      </label>
      <select
        id="purchaseOrderId"
        value={selectedPurchaseOrderId}
        onChange={(event) => onSelectPurchaseOrderId(event.target.value)}
        className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm"
      >
        <option value="">No purchase order</option>
        {openPurchaseOrders.map((po) => (
          <option key={po.id} value={po.id}>
            {po.poNumber} — {po.vendorName}
          </option>
        ))}
      </select>
      {selectedPo ? (
        <p className="mt-2 text-xs text-slate-600">
          <StatusBadge label={selectedPo.poNumber} variant="info" /> remaining
          lines will pre-fill below.
        </p>
      ) : null}
    </div>
  );
}
