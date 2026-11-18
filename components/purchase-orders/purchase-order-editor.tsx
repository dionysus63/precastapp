"use client";

import Link from "next/link";
import { randomId } from "@/lib/random-id";
import { localTodayInput } from "@/lib/date-only";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from "@/app/purchase-orders/actions";
import {
  isPreviewBesideInputs,
  portraitPreviewDrawerPaneClassName,
  portraitPreviewSplitClassName,
  previewDrawerOnlyClassName,
} from "@/components/common/live-pdf-preview";
import { BackButton } from "@/components/dashboard/back-button";
import { FileUploadDropzone } from "@/components/files/file-upload-dropzone";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  PurchaseOrderLivePreview,
  type PurchaseOrderPreviewView,
} from "@/components/purchase-orders/purchase-order-live-preview";
import { formatUsd } from "@/lib/format";
import { useStoredFlag } from "@/lib/hooks/use-stored-flag";
import { standardPageWidthClassName } from "@/lib/page-width";
import {
  draftPurchaseOrderMoney,
  type PurchaseOrderDraftPreviewInput,
} from "@/lib/purchase-order-draft-preview";
import { purchaseOrderCategoryFormOptions } from "@/lib/purchase-order-utils";
import { selectedFillClassName } from "@/lib/selected-styles";
import type { ReceivingCategory } from "@/app/generated/prisma/client";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableComputedCellClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
} from "@/lib/table-styles";
import { navigateAfterAction, reloadAfterAction } from "@/lib/reload-after-action";
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
  backHref: string;
  backLabel: string;
  /** Who is signed in: fills "Entered by" on a new purchase order. */
  defaultEnteredBy?: string;
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
    /** A "quote only" order: its quote reference, and its total. */
    quoteOnly?: boolean;
    quoteNumber?: string | null;
    quoteDate?: string;
    quoteTotal?: number;
  };
};

/** How the order's content is entered. */
type EntryMode = "lines" | "quote";

const ENTRY_MODES: Array<{ value: EntryMode; label: string; title: string }> = [
  {
    value: "lines",
    label: "Line items",
    title: "List each item with its quantity and price",
  },
  {
    value: "quote",
    label: "Quote only",
    title: "Order everything on the vendor's quote: its number, date and total",
  },
];

/** A typed quantity or price as a number; half-typed or empty counts as 0. */
function typedAmount(value: string): number {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** A typed dollar total, which may carry "$" and thousands commas. */
function typedMoney(value: string): number {
  return typedAmount(value.replace(/[$,\s]/g, ""));
}

function createLine(): EditorLine {
  return {
    id: randomId(),
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
  backHref,
  backLabel,
  defaultEnteredBy = "",
  initial,
}: PurchaseOrderEditorProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [orderDate, setOrderDate] = useState(
    () => initial?.orderDate ?? localTodayInput(),
  );
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate ?? "");
  const [enteredBy, setEnteredBy] = useState(
    initial ? initial.enteredBy : defaultEnteredBy,
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  // Both ways of entering the order keep what was typed while the other one
  // is showing; only the one showing is saved.
  const [entryMode, setEntryMode] = useState<EntryMode>(
    initial?.quoteOnly ? "quote" : "lines",
  );
  const [quoteNumber, setQuoteNumber] = useState(initial?.quoteNumber ?? "");
  const [quoteDate, setQuoteDate] = useState(initial?.quoteDate ?? "");
  const [quoteTotal, setQuoteTotal] = useState(
    initial?.quoteOnly && initial.quoteTotal ? initial.quoteTotal.toFixed(2) : "",
  );
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  // The live purchase order PDF beside the inputs; hiding it is remembered
  // per PC.
  const [previewHidden, setPreviewHidden] = useStoredFlag(
    "precastapp:purchase-order-editor-preview-hidden",
    false,
  );
  // On a window too narrow for both, the preview opens over the right side
  // of the window when asked for, and closes again without being remembered.
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  const [previewView, setPreviewView] =
    useState<PurchaseOrderPreviewView>("purchaseOrder");
  useEffect(() => {
    if (!previewDrawerOpen) {
      return;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewDrawerOpen]);

  function showPreview() {
    setPreviewHidden(false);
    setPreviewDrawerOpen(!isPreviewBesideInputs());
  }

  function hidePreview() {
    if (isPreviewBesideInputs()) {
      setPreviewHidden(true);
    }
    setPreviewDrawerOpen(false);
  }

  function handleQuoteFilesChange(files: File[]) {
    setQuoteFiles(files);
    // A quote just dropped in is there to be typed from: bring it up.
    setPreviewView(files.length > 0 ? "vendorQuote" : "purchaseOrder");
  }
  const [lines, setLines] = useState<EditorLine[]>(
    initial?.lines.length
      ? initial.lines.map((line) => ({
          id: randomId(),
          productId: line.productId ?? "",
          itemCode: line.itemCode,
          description: line.description ?? "",
          quantityOrdered: String(line.quantityOrdered),
          unit: line.unit,
          unitPrice: String(line.unitPrice),
        }))
      : [createLine()],
  );
  const [submissionKey] = useState(() => randomId());

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

  // What prints, in the shape the preview is drawn from. Category and the
  // vendor quote never reach the paper, so they are left out.
  const previewInput: PurchaseOrderDraftPreviewInput = {
    purchaseOrderId: purchaseOrderId ?? null,
    vendorId: vendorId || null,
    orderDate: orderDate || null,
    expectedDate: expectedDate || null,
    enteredBy: enteredBy.trim() || null,
    notes: notes.trim() || null,
    lines: lines.map((line) => ({
      itemCode: line.itemCode.trim(),
      description: line.description.trim(),
      quantityOrdered: typedAmount(line.quantityOrdered),
      unit: line.unit.trim(),
      unitPrice: typedAmount(line.unitPrice),
    })),
    quote:
      entryMode === "quote"
        ? {
            number: quoteNumber.trim(),
            date: quoteDate || null,
            total: typedMoney(quoteTotal),
          }
        : null,
  };
  const money = draftPurchaseOrderMoney(previewInput.lines);

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
    formData.set("entryMode", entryMode);

    for (const line of entryMode === "lines" ? lines : []) {
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
        navigateAfterAction(`/purchase-orders/${result.id}`);
      } else if (purchaseOrderId) {
        navigateAfterAction(`/purchase-orders/${purchaseOrderId}`);
      } else {
        reloadAfterAction();
      }
    });
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

  return (
    // The page is full width for the preview; with the preview hidden the
    // inputs go back to the standard column they were laid out for.
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 ${previewHidden ? standardPageWidthClassName : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton href={backHref} label={backLabel} />
        {previewHidden || !previewDrawerOpen ? (
          // Hidden by choice: offered at every width. Not hidden: only a
          // narrow window needs it, where the preview waits to be opened.
          <button
            type="button"
            onClick={showPreview}
            className={`rounded-md btn-plain px-3 py-1.5 text-xs font-medium ${
              previewHidden ? "" : previewDrawerOnlyClassName
            }`}
          >
            Show purchase order preview
          </button>
        ) : null}
      </div>

      <div className={previewHidden ? "" : portraitPreviewSplitClassName}>
        <div className="min-w-0 space-y-4">
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
                  value={orderDate}
                  onChange={(event) => setOrderDate(event.target.value)}
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
                  value={expectedDate}
                  onChange={(event) => setExpectedDate(event.target.value)}
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
                  value={enteredBy}
                  onChange={(event) => setEnteredBy(event.target.value)}
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
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={entryMode === "quote" ? "Vendor quote" : "Line items"}
            noPadding
            action={
              <div
                role="group"
                aria-label="How to enter the order"
                className="flex overflow-hidden rounded-md border border-slate-300 text-xs font-semibold"
              >
                {ENTRY_MODES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    title={option.title}
                    aria-pressed={entryMode === option.value}
                    onClick={() => setEntryMode(option.value)}
                    className={`px-3 py-1 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-slate-300 ${
                      entryMode === option.value
                        ? selectedFillClassName
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            }
          >
            {entryMode === "quote" ? (
              <div className="space-y-3 p-4">
                <p className="text-xs text-slate-500">
                  The purchase order orders everything on the vendor&apos;s quote and
                  names it by number, date and total. No items are listed.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="quoteNumber"
                      className="text-xs font-medium text-slate-700"
                    >
                      Quote number
                    </label>
                    <input
                      id="quoteNumber"
                      name="quoteNumber"
                      value={quoteNumber}
                      onChange={(event) => setQuoteNumber(event.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="quoteDate"
                      className="text-xs font-medium text-slate-700"
                    >
                      Quote date
                    </label>
                    <input
                      id="quoteDate"
                      name="quoteDate"
                      type="date"
                      value={quoteDate}
                      onChange={(event) => setQuoteDate(event.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="quoteTotal"
                      className="text-xs font-medium text-slate-700"
                    >
                      Quote total *
                    </label>
                    <input
                      id="quoteTotal"
                      name="quoteTotal"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={quoteTotal}
                      onChange={(event) => setQuoteTotal(event.target.value)}
                      className={`${inputClass} text-right tabular-nums`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Item</th>
                    <th className={tableHeaderCellClassName}>Description</th>
                    <th className={tableHeaderCellClassName}>Qty</th>
                    <th className={tableHeaderCellClassName}>Unit</th>
                    <th className={tableHeaderCellClassName}>Price</th>
                    <th className={tableHeaderCellClassName}>Total</th>
                    <th className={tableHeaderCellClassName}></th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {lines.map((line, index) => (
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
                          // Stored to four decimals (pipe by the foot).
                          step="0.0001"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.id, { unitPrice: event.target.value })
                          }
                          className={`${tableInlineInputClassName} w-24 text-right tabular-nums`}
                        />
                      </td>
                      <td className={tableComputedCellClassName}>
                        {formatUsd(money.lineTotals[index] ?? 0)}
                      </td>
                      <td className={tableCellClassName}>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="text-2xs text-slate-500 hover:text-slate-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={addLine}
                className="rounded-md btn-plain px-3 py-1.5 text-xs font-medium"
              >
                Add line
              </button>
              <p className="text-sm text-slate-600">
                Total{" "}
                <span
                  className="ml-2 font-semibold tabular-nums text-slate-900"
                  data-purchase-order-total
                >
                  {formatUsd(money.total)}
                </span>
              </p>
            </div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Vendor quote PDF">
            <FileUploadDropzone
              files={quoteFiles}
              onFilesChange={handleQuoteFilesChange}
              accept=".pdf,application/pdf"
              multiple={false}
              label="Drop vendor quote PDF here"
              description={
                entryMode === "quote"
                  ? "Attach the vendor's quote for accounts payable. It opens in the preview pane, so its number, date and total can be typed from it."
                  : "Attach the vendor's quote for accounts payable. It opens in the preview pane, so the lines can be typed from it."
              }
            />
            {initial?.vendorQuoteName && quoteFiles.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Current file: {initial.vendorQuoteName}. Upload a new PDF to replace it.
              </p>
            ) : null}
          </SectionCard>

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
          className="rounded-lg btn-plain px-4 py-2 text-xs font-semibold"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending || !vendorId}
          className="rounded-lg btn-main px-4 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create Purchase Order"
              : "Save Changes"}
        </button>
          </div>
        </div>

        {previewHidden ? null : (
          <div
            className={portraitPreviewDrawerPaneClassName(previewDrawerOpen)}
            data-preview-drawer={previewDrawerOpen ? "open" : "closed"}
          >
            <PurchaseOrderLivePreview
              input={previewInput}
              quoteFile={quoteFiles[0] ?? null}
              savedQuoteName={initial?.vendorQuoteName ?? null}
              view={previewView}
              onViewChange={setPreviewView}
              onHide={hidePreview}
            />
          </div>
        )}
      </div>
    </form>
  );
}
