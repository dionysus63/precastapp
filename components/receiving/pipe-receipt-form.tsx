"use client";

import Link from "next/link";
import { randomId } from "@/lib/random-id";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePurchaseReceipt } from "@/app/inventory/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  buildPrefilledReceiptLines,
  PurchaseOrderReceiptBanner,
  type PurchaseOrderReceiptOption,
} from "@/components/receiving/purchase-order-receipt-banner";
import {
  receivingCategoryDefaultSupplier,
  receivingCategoryLabels,
} from "@/lib/receiving-utils";

type PipeProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
};

type PipeReceiptFormProps = {
  category: "RCP" | "ADS_PIPE";
  products: PipeProductOption[];
  returnPath?: string;
  lockedPurchaseOrder?: PurchaseOrderReceiptOption | null;
  openPurchaseOrders?: PurchaseOrderReceiptOption[];
};

type ReceiptLineRow = {
  id: string;
  productId: string;
  quantityReceived: string;
};

function createRow(productId = "", quantityReceived = ""): ReceiptLineRow {
  return {
    id: randomId(),
    productId,
    quantityReceived,
  };
}

function prefillRowsFromPurchaseOrder(
  purchaseOrder: PurchaseOrderReceiptOption | null | undefined,
): ReceiptLineRow[] | null {
  if (!purchaseOrder) {
    return null;
  }
  const prefilled = buildPrefilledReceiptLines(purchaseOrder);
  if (prefilled.length === 0) {
    return null;
  }
  return prefilled.map((line) =>
    createRow(line.productId, line.quantityReceived),
  );
}

export function PipeReceiptForm({
  category,
  products,
  returnPath = "/receiving",
  lockedPurchaseOrder = null,
  openPurchaseOrders = [],
}: PipeReceiptFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState(
    lockedPurchaseOrder?.id ?? "",
  );
  const [lines, setLines] = useState<ReceiptLineRow[]>(
    () => prefillRowsFromPurchaseOrder(lockedPurchaseOrder) ?? [createRow()],
  );
  const [submissionKey] = useState(() => randomId());
  const defaultSupplier = receivingCategoryDefaultSupplier[category] ?? "";

  // Prefill happens on the selection event (and lazily above for a locked PO)
  // so a server-props refresh can't overwrite quantities the user edited.
  function handleSelectPurchaseOrder(purchaseOrderId: string) {
    setSelectedPurchaseOrderId(purchaseOrderId);
    const purchaseOrder =
      openPurchaseOrders.find((po) => po.id === purchaseOrderId) ?? null;
    const prefilledRows = prefillRowsFromPurchaseOrder(purchaseOrder);
    if (prefilledRows) {
      setLines(prefilledRows);
    }
  }

  function addLine() {
    setLines((current) => [...current, createRow()]);
  }

  function updateLine(id: string, patch: Partial<ReceiptLineRow>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("category", category);
    formData.set("returnPath", returnPath);
    if (selectedPurchaseOrderId) {
      formData.set("purchaseOrderId", selectedPurchaseOrderId);
    }

    for (const line of lines) {
      if (line.productId && line.quantityReceived) {
        formData.append("productId", line.productId);
        formData.append("quantityReceived", line.quantityReceived);
      }
    }

    startTransition(async () => {
      formData.set("submissionKey", submissionKey);
      const result = await savePurchaseReceipt(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.returnPath ?? returnPath);
      router.refresh();
    });
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PurchaseOrderReceiptBanner
        lockedPurchaseOrder={lockedPurchaseOrder}
        openPurchaseOrders={openPurchaseOrders}
        selectedPurchaseOrderId={selectedPurchaseOrderId}
        onSelectPurchaseOrderId={handleSelectPurchaseOrder}
      />

      <SectionCard title="Delivery details">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="receiptDate" className="text-xs font-medium text-slate-700">
              Date *
            </label>
            <input
              id="receiptDate"
              name="receiptDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="batchLabel" className="text-xs font-medium text-slate-700">
              Supplier / PO reference
            </label>
            <input
              id="batchLabel"
              name="batchLabel"
              placeholder={defaultSupplier}
              defaultValue={defaultSupplier}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="enteredBy" className="text-xs font-medium text-slate-700">
              Received by
            </label>
            <input id="enteredBy" name="enteredBy" className={inputClass} />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="notes" className="text-xs font-medium text-slate-700">
            Notes
          </label>
          <input id="notes" name="notes" className={inputClass} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Recording a {receivingCategoryLabels[category]} delivery.
        </p>
      </SectionCard>

      <SectionCard title="Products received">
        {products.length === 0 ? (
          <p className="text-sm text-slate-600">
            No inventory-tracked products found for this category. Add products in
            the catalog first.
          </p>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.id}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]"
              >
                <select
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(line.id, { productId: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Select product…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productCode} — {product.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Qty"
                  value={line.quantityReceived}
                  onChange={(event) =>
                    updateLine(line.id, {
                      quantityReceived: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        )}
        {products.length > 0 ? (
          <button
            type="button"
            onClick={addLine}
            className="mt-3 text-xs font-medium text-slate-700 underline"
          >
            Add line
          </button>
        ) : null}
      </SectionCard>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link
          href="/receiving"
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending || products.length === 0}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Record delivery"}
        </button>
      </div>
    </form>
  );
}
