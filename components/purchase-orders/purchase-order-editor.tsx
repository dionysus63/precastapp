"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from "@/app/purchase-orders/actions";
import { FileUploadDropzone } from "@/components/files/file-upload-dropzone";
import { SectionCard } from "@/components/dashboard/section-card";
import { VendorQuotePreview } from "@/components/purchase-orders/vendor-quote-preview";
import { purchaseOrderCategoryFormOptions } from "@/lib/purchase-order-utils";
import type { ReceivingCategory } from "@/app/generated/prisma/client";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
} from "@/lib/table-styles";
type VendorOption = {
  id: string;
  name: string;
  defaultCategory: ReceivingCategory | null;
};

type EditorLine = {
  id: string;
  productId: string;
  itemCode: string;
  description: string;
  quantityOrdered: string;
  unit: string;
  unitPrice: string;
};

type PurchaseOrderEditorProps = {
  mode: "create" | "edit";
  vendors: VendorOption[];
  purchaseOrderId?: string;
  initial?: {
    vendorId: string;
    category: string;
    orderDate: string;
    expectedDate: string;
    notes: string;
    enteredBy: string;
    updatedAt: string;
    lines: Array<{
      productId: string | null;
      itemCode: string;
      description: string | null;
      quantityOrdered: number;
      unit: string;
      unitPrice: number;
    }>;
    vendorQuoteName?: string | null;
  };
};

function createLine(): EditorLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    itemCode: "",
    description: "",
    quantityOrdered: "",
    unit: "EA",
    unitPrice: "",
  };
}

export function PurchaseOrderEditor({
  mode,
  vendors,
  purchaseOrderId,
  initial,
}: PurchaseOrderEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [lines, setLines] = useState<EditorLine[]>(
    initial?.lines.length
      ? initial.lines.map((line) => ({
          id: crypto.randomUUID(),
          productId: line.productId ?? "",
          itemCode: line.itemCode,
          description: line.description ?? "",
          quantityOrdered: String(line.quantityOrdered),
          unit: line.unit,
          unitPrice: String(line.unitPrice),
        }))
      : [createLine()],
  );
  const [submissionKey] = useState(() => crypto.randomUUID());

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === vendorId),
    [vendors, vendorId],
  );

  function addLine() {
    setLines((current) => [...current, createLine()]);
  }

  function updateLine(id: string, patch: Partial<EditorLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(id: string) {
    setLines((current) =>
      current.length <= 1 ? current : current.filter((line) => line.id !== id),
    );
  }

  function handleVendorChange(nextVendorId: string) {
    setVendorId(nextVendorId);
    const vendor = vendors.find((entry) => entry.id === nextVendorId);
    if (vendor?.defaultCategory && !category) {
      setCategory(vendor.defaultCategory);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("vendorId", vendorId);
    formData.set("category", category);
    formData.set("submissionKey", submissionKey);
    if (initial?.updatedAt) {
      formData.set("expectedUpdatedAt", initial.updatedAt);
    }
    if (quoteFiles[0]) {
      formData.set("vendorQuote", quoteFiles[0]);
    }

    for (const line of lines) {
      if (!line.itemCode.trim() && !line.quantityOrdered.trim()) {
        continue;
      }
      formData.append("productId", line.productId);
      formData.append("itemCode", line.itemCode);
      formData.append("description", line.description);
      formData.append("quantityOrdered", line.quantityOrdered);
      formData.append("unit", line.unit);
      formData.append("unitPrice", line.unitPrice);
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createPurchaseOrder(formData)
          : await updatePurchaseOrder(purchaseOrderId!, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (mode === "create" && "id" in result && result.id) {
        router.push(`/purchase-orders/${result.id}`);
      } else if (purchaseOrderId) {
        router.push(`/purchase-orders/${purchaseOrderId}`);
      }
      router.refresh();
    });
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

  const showPreview = quoteFiles.length > 0 || Boolean(initial?.vendorQuoteName);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <SectionCard title="Vendor quote PDF">
        <FileUploadDropzone
          files={quoteFiles}
          onFilesChange={setQuoteFiles}
          accept=".pdf,application/pdf"
          multiple={false}
          label="Drop vendor quote PDF here"
          description="Attach the vendor's quote for accounts payable. Line items are entered manually beside the preview."
        />
        {initial?.vendorQuoteName && quoteFiles.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Current file: {initial.vendorQuoteName}. Upload a new PDF to replace it.
          </p>
        ) : null}
      </SectionCard>

      <div
        className={`grid gap-5 ${showPreview ? "xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : ""}`}
      >
        <div className="space-y-5">
          <SectionCard title="Purchase order details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="vendorId" className="text-xs font-medium text-slate-700">
                  Vendor *
                </label>
                <select
                  id="vendorId"
                  required
                  value={vendorId}
                  onChange={(event) => handleVendorChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select vendor…</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                {selectedVendor?.defaultCategory ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Default category: {selectedVendor.defaultCategory.replace(/_/g, " ")}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="category" className="text-xs font-medium text-slate-700">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={inputClass}
                >
                  {purchaseOrderCategoryFormOptions.map((option) => (
                    <option key={option.value || "one-off"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="orderDate" className="text-xs font-medium text-slate-700">
                  Order date *
                </label>
                <input
                  id="orderDate"
                  name="orderDate"
                  type="date"
                  required
                  defaultValue={
                    initial?.orderDate ?? new Date().toISOString().slice(0, 10)
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="expectedDate" className="text-xs font-medium text-slate-700">
                  Expected delivery
                </label>
                <input
                  id="expectedDate"
                  name="expectedDate"
                  type="date"
                  defaultValue={initial?.expectedDate ?? ""}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="enteredBy" className="text-xs font-medium text-slate-700">
                  Entered by
                </label>
                <input
                  id="enteredBy"
                  name="enteredBy"
                  defaultValue={initial?.enteredBy ?? ""}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="notes" className="text-xs font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  defaultValue={initial?.notes ?? ""}
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Line items" noPadding>
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Item</th>
                    <th className={tableHeaderCellClassName}>Description</th>
                    <th className={tableHeaderCellClassName}>Qty</th>
                    <th className={tableHeaderCellClassName}>Unit</th>
                    <th className={tableHeaderCellClassName}>Price</th>
                    <th className={tableHeaderCellClassName}></th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className={tableCellClassName}>
                        <input
                          value={line.itemCode}
                          onChange={(event) =>
                            updateLine(line.id, { itemCode: event.target.value })
                          }
                          placeholder="Item code"
                          className={`${tableInlineInputClassName} w-full min-w-[120px]`}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          value={line.description}
                          onChange={(event) =>
                            updateLine(line.id, { description: event.target.value })
                          }
                          placeholder="Description"
                          className={`${tableInlineInputClassName} w-full min-w-[180px]`}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.quantityOrdered}
                          onChange={(event) =>
                            updateLine(line.id, {
                              quantityOrdered: event.target.value,
                            })
                          }
                          className={`${tableInlineInputClassName} w-20 text-right tabular-nums`}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          value={line.unit}
                          onChange={(event) =>
                            updateLine(line.id, { unit: event.target.value })
                          }
                          className={`${tableInlineInputClassName} w-16`}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.id, { unitPrice: event.target.value })
                          }
                          className={`${tableInlineInputClassName} w-24 text-right tabular-nums`}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="text-[11px] text-slate-500 hover:text-slate-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={addLine}
                className="text-xs font-medium text-slate-700 underline"
              >
                Add line
              </button>
            </div>
          </SectionCard>
        </div>

        {showPreview ? (
          <VendorQuotePreview
            file={quoteFiles[0] ?? null}
            purchaseOrderId={
              quoteFiles.length === 0 ? purchaseOrderId : undefined
            }
            fileName={initial?.vendorQuoteName}
          />
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link
          href={
            mode === "edit" && purchaseOrderId
              ? `/purchase-orders/${purchaseOrderId}`
              : "/purchase-orders"
          }
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending || !vendorId}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create Purchase Order"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
