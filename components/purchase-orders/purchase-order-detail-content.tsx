"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updatePurchaseOrderStatus } from "@/app/purchase-orders/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { VendorQuotePreview } from "@/components/purchase-orders/vendor-quote-preview";
import {
  purchaseOrderReceivePercent,
  purchaseOrderStatusLabels,
} from "@/lib/purchase-order-utils";
import { formatUsd } from "@/lib/format";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
type PurchaseOrderDetailContentProps = {
  purchaseOrder: {
    id: string;
    poNumber: string;
    vendorName: string;
    orderDateLabel: string;
    expectedDateLabel: string | null;
    categoryLabel: string;
    status: string;
    statusLabel: string;
    statusVariant: "success" | "info" | "warning" | "neutral" | "default" | "danger";
    total: number;
    notes: string | null;
    enteredBy: string | null;
    hasVendorQuote: boolean;
    vendorQuoteName: string | null;
    category: string | null;
    lines: Array<{
      id: string;
      itemCode: string;
      description: string | null;
      quantityOrdered: number;
      quantityReceived: number;
      unit: string;
      unitPrice: number;
      total: number;
      overReceived: boolean;
    }>;
    receipts: Array<{
      id: string;
      receiptDate: Date;
      enteredBy: string | null;
    }>;
  };
  canManage: boolean;
};

export function PurchaseOrderDetailContent({
  purchaseOrder,
  canManage,
}: PurchaseOrderDetailContentProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function runStatus(status: "ISSUED" | "CANCELLED") {
    startTransition(async () => {
      const result = await updatePurchaseOrderStatus(purchaseOrder.id, status);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  const orderedTotal = purchaseOrder.lines.reduce(
    (sum, line) => sum + line.quantityOrdered,
    0,
  );
  const receivedTotal = purchaseOrder.lines.reduce(
    (sum, line) => sum + line.quantityReceived,
    0,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p>
          <div className="mt-2">
            <StatusBadge
              label={purchaseOrder.statusLabel}
              variant={purchaseOrder.statusVariant}
            />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Vendor</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {purchaseOrder.vendorName}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Order date</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {purchaseOrder.orderDateLabel}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {formatUsd(purchaseOrder.total)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canManage && purchaseOrder.status === "DRAFT" ? (
          <>
            <Link
              href={`/purchase-orders/${purchaseOrder.id}/edit`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Edit
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => runStatus("ISSUED")}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Issue PO
            </button>
          </>
        ) : null}
        {canManage &&
        purchaseOrder.category &&
        (purchaseOrder.status === "ISSUED" ||
          purchaseOrder.status === "PARTIALLY_RECEIVED") ? (
          <Link
            href={`/receiving/receive?category=${purchaseOrder.category}&po=${purchaseOrder.id}`}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Receive delivery
          </Link>
        ) : null}
        {canManage &&
        purchaseOrder.status !== "CANCELLED" &&
        purchaseOrder.status !== "RECEIVED" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => runStatus("CANCELLED")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <SectionCard title="Line items" noPadding>
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Item</th>
                <th className={tableHeaderCellClassName}>Description</th>
                <th className={tableHeaderCellClassName}>Ordered</th>
                <th className={tableHeaderCellClassName}>Received</th>
                <th className={tableHeaderCellClassName}>Progress</th>
                <th className={tableHeaderCellClassName}>Unit price</th>
                <th className={tableHeaderCellClassName}>Total</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {purchaseOrder.lines.map((line) => {
                const percent = purchaseOrderReceivePercent(
                  line.quantityOrdered,
                  line.quantityReceived,
                );
                return (
                  <tr key={line.id} className="text-slate-800">
                    <td className={`${tableCellClassName} font-medium`}>{line.itemCode}</td>
                    <td className={tableCellClassName}>{line.description ?? "—"}</td>
                    <td className={tableCellClassName}>
                      {line.quantityOrdered} {line.unit}
                    </td>
                    <td className={tableCellClassName}>
                      {line.quantityReceived} {line.unit}
                      {line.overReceived ? (
                        <StatusBadge label="Over" variant="warning" />
                      ) : null}
                    </td>
                    <td className={tableCellClassName}>
                      <div className="flex min-w-[120px] items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500">{percent}%</span>
                      </div>
                    </td>
                    <td className={tableCellClassName}>{formatUsd(line.unitPrice)}</td>
                    <td className={tableCellClassName}>{formatUsd(line.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
          Overall received: {receivedTotal} / {orderedTotal}
        </div>
      </SectionCard>

      {purchaseOrder.hasVendorQuote ? (
        <SectionCard title="Vendor quote">
          <VendorQuotePreview
            purchaseOrderId={purchaseOrder.id}
            fileName={purchaseOrder.vendorQuoteName}
          />
        </SectionCard>
      ) : null}

      {purchaseOrder.notes ? (
        <SectionCard title="Notes">
          <p className="text-sm text-slate-700">{purchaseOrder.notes}</p>
        </SectionCard>
      ) : null}

      {purchaseOrder.receipts.length > 0 ? (
        <SectionCard title="Linked receiving entries">
          <ul className="space-y-2 text-xs text-slate-700">
            {purchaseOrder.receipts.map((receipt) => (
              <li key={receipt.id}>
                {receipt.receiptDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {receipt.enteredBy ? ` · ${receipt.enteredBy}` : ""}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <p className="text-xs text-slate-500">
        Category: {purchaseOrder.categoryLabel}
        {purchaseOrder.enteredBy ? ` · Entered by ${purchaseOrder.enteredBy}` : ""}
        {purchaseOrder.expectedDateLabel
          ? ` · Expected ${purchaseOrder.expectedDateLabel}`
          : ""}
      </p>
    </div>
  );
}
