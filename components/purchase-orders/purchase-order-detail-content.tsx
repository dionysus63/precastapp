"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
} from "@/app/purchase-orders/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { navigateAfterAction, reloadAfterAction } from "@/lib/reload-after-action";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  portraitPreviewViewPaneClassName,
  portraitPreviewViewSplitClassName,
} from "@/components/common/live-pdf-preview";
import { PurchaseOrderDocuments } from "@/components/purchase-orders/purchase-order-documents";
import {
  purchaseOrderPdfFileName,
  purchaseOrderReceivePercent,
} from "@/lib/purchase-order-utils";
import { formatUsd } from "@/lib/format";
import { formatCalendarDateShort } from "@/lib/date-only";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableHeaderCellStaticClassName,
} from "@/lib/table-styles";

/** A value in the Order grid; the labels are ordinary table header cells. */
const orderValueCellClassName = `${tableCellClassName} align-top font-medium text-slate-900`;

/** A dash where the order has nothing for a box. */
function orEmpty(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : <span className="font-normal text-slate-500">—</span>;
}
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
    attention: string | null;
    hasVendorQuote: boolean;
    vendorQuoteName: string | null;
    taxable: boolean;
    /** Ordered against the vendor's quote: no lines, the quote is named. */
    quoteOnly: boolean;
    quoteNumber: string | null;
    quoteDateLabel: string | null;
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
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  // Nothing received against it yet: only then can it be deleted for good.
  const canDelete =
    canManage &&
    purchaseOrder.receipts.length === 0 &&
    purchaseOrder.lines.every((line) => line.quantityReceived === 0);

  async function confirmDelete() {
    const accepted = await confirm({
      title: "Delete purchase order?",
      message: `Delete ${purchaseOrder.poNumber} for ${purchaseOrder.vendorName} for good?\n\nThe order${
        purchaseOrder.hasVendorQuote ? ", its lines and the attached vendor quote" : " and its lines"
      } are removed. This cannot be undone. To keep it on file, use Cancel instead.`,
      confirmLabel: "Delete purchase order",
      cancelLabel: "Keep it",
      variant: "danger",
    });
    if (!accepted) {
      return;
    }
    startTransition(async () => {
      const result = await deletePurchaseOrder(purchaseOrder.id);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      navigateAfterAction("/purchase-orders", {
        type: "success",
        text: `Purchase order ${result.poNumber} deleted.`,
      });
    });
  }

  function runStatus(status: "ISSUED" | "CANCELLED") {
    startTransition(async () => {
      const result = await updatePurchaseOrderStatus(purchaseOrder.id, status);
      if (result.error) {
        alert(result.error);
        return;
      }
      reloadAfterAction();
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
    // The PDFs on the left, the order beside them: the same split as the
    // screen that creates a purchase order. On a narrow window the PDFs
    // come below the order.
    <div className={portraitPreviewViewSplitClassName}>
      <div className="min-w-0 max-w-4xl space-y-4">
        <div className="flex flex-wrap gap-2">
          {canManage && purchaseOrder.status === "DRAFT" ? (
            <>
              <Link
                href={`/purchase-orders/${purchaseOrder.id}/edit`}
                className="rounded-lg btn-plain px-3 py-2 text-xs font-semibold"
              >
                Edit
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => runStatus("ISSUED")}
                className="rounded-lg btn-main px-3 py-2 text-xs font-semibold disabled:opacity-60"
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
              className="rounded-lg btn-plain px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              Cancel order
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={pending}
              onClick={confirmDelete}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
            >
              Delete
            </button>
          ) : null}
        </div>

        {/* One grid for everything about the order: two rows of labelled
            boxes, six across, Status last. */}
        <SectionCard title="Order" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0 text-left text-sm">
              <tbody className={tableBodyClassName}>
                <tr>
                  <th scope="col" className={tableHeaderCellStaticClassName}>Vendor</th>
                  <th scope="col" className={tableHeaderCellStaticClassName}>Attention</th>
                  <th scope="col" className={tableHeaderCellStaticClassName}>Category</th>
                  <th scope="col" className={tableHeaderCellStaticClassName}>Tax</th>
                  <th scope="col" className={tableHeaderCellStaticClassName}>Entered by</th>
                  <th scope="col" className={tableHeaderCellStaticClassName}>Status</th>
                </tr>
                <tr>
                  <td className={`${orderValueCellClassName} font-semibold`}>
                    {purchaseOrder.vendorName}
                  </td>
                  <td className={orderValueCellClassName}>
                    {orEmpty(purchaseOrder.attention)}
                  </td>
                  <td className={orderValueCellClassName}>
                    {purchaseOrder.categoryLabel}
                  </td>
                  <td className={orderValueCellClassName}>
                    {purchaseOrder.taxable ? "Taxable" : "Non-taxable"}
                  </td>
                  <td className={orderValueCellClassName}>
                    {orEmpty(purchaseOrder.enteredBy)}
                  </td>
                  <td className={orderValueCellClassName}>
                    <StatusBadge
                      label={purchaseOrder.statusLabel}
                      variant={purchaseOrder.statusVariant}
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="col" className={tableHeaderCellStaticClassName}>Order date</th>
                  <th scope="col" className={tableHeaderCellStaticClassName}>
                    Expected delivery
                  </th>
                  {purchaseOrder.quoteOnly ? (
                    <>
                      <th scope="col" className={tableHeaderCellStaticClassName}>
                        Quote number
                      </th>
                      <th scope="col" className={tableHeaderCellStaticClassName}>
                        Quote date
                      </th>
                    </>
                  ) : (
                    <th scope="col" colSpan={2} className={tableHeaderCellStaticClassName}>
                      Received
                    </th>
                  )}
                  <th scope="col" colSpan={2} className={tableHeaderCellStaticClassName}>
                    Total
                  </th>
                </tr>
                <tr>
                  <td className={orderValueCellClassName}>
                    {purchaseOrder.orderDateLabel}
                  </td>
                  <td className={orderValueCellClassName}>
                    {orEmpty(purchaseOrder.expectedDateLabel)}
                  </td>
                  {purchaseOrder.quoteOnly ? (
                    <>
                      <td className={orderValueCellClassName}>
                        {orEmpty(purchaseOrder.quoteNumber)}
                      </td>
                      <td className={orderValueCellClassName}>
                        {orEmpty(purchaseOrder.quoteDateLabel)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={2} className={`${orderValueCellClassName} tabular-nums`}>
                      {receivedTotal} of {orderedTotal}
                    </td>
                  )}
                  <td
                    colSpan={2}
                    className={`${orderValueCellClassName} text-base font-semibold tabular-nums`}
                  >
                    {formatUsd(purchaseOrder.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>

        {purchaseOrder.quoteOnly ? null : (
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
                        <td className={`${tableCellClassName} font-medium`}>
                          {line.itemCode}
                        </td>
                        <td className={tableCellClassName}>{line.description ?? "—"}</td>
                        <td className={`${tableCellClassName} whitespace-nowrap`}>
                          {line.quantityOrdered} {line.unit}
                        </td>
                        <td className={`${tableCellClassName} whitespace-nowrap`}>
                          {line.quantityReceived} {line.unit}
                          {line.overReceived ? (
                            <StatusBadge label="Over" variant="warning" />
                          ) : null}
                        </td>
                        <td className={tableCellClassName}>
                          <div className="flex min-w-[6rem] items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-2xs text-slate-500">{percent}%</span>
                          </div>
                        </td>
                        <td className={`${tableCellClassName} whitespace-nowrap`}>
                          {formatUsd(line.unitPrice)}
                        </td>
                        <td className={`${tableCellClassName} whitespace-nowrap`}>
                          {formatUsd(line.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {purchaseOrder.notes ? (
          <SectionCard title="Notes">
            <p className="whitespace-pre-line text-sm text-slate-700">
              {purchaseOrder.notes}
            </p>
          </SectionCard>
        ) : null}

        {purchaseOrder.receipts.length > 0 ? (
          <SectionCard title="Linked receiving entries">
            <ul className="space-y-2 text-xs text-slate-700">
              {purchaseOrder.receipts.map((receipt) => (
                <li key={receipt.id}>
                  {formatCalendarDateShort(receipt.receiptDate)}
                  {receipt.enteredBy ? ` · ${receipt.enteredBy}` : ""}
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>

      <div className={portraitPreviewViewPaneClassName}>
        <PurchaseOrderDocuments
          purchaseOrderId={purchaseOrder.id}
          poNumber={purchaseOrder.poNumber}
          pdfFileName={purchaseOrderPdfFileName(
            purchaseOrder.poNumber,
            purchaseOrder.vendorName,
          )}
          vendorQuoteName={
            purchaseOrder.hasVendorQuote
              ? (purchaseOrder.vendorQuoteName ?? "vendor-quote.pdf")
              : null
          }
        />
      </div>
    </div>
  );
}
