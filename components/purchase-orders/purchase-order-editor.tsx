"use client";

import Link from "next/link";
import { randomId } from "@/lib/random-id";
import { localTodayInput } from "@/lib/date-only";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  createPurchaseOrder,
  searchContractorsForPurchaseOrder,
  searchJobsForPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderContractorOption,
  type PurchaseOrderJobOption,
} from "@/app/purchase-orders/actions";
import { FormTypeahead } from "@/components/common/form-typeahead";
import {
  isPreviewBesideInputs,
  portraitPreviewDrawerPaneClassName,
  portraitPreviewSplitClassName,
  previewDrawerOnlyClassName,
} from "@/components/common/live-pdf-preview";
import { BackButton } from "@/components/dashboard/back-button";
import { FileUploadDropzone } from "@/components/files/file-upload-dropzone";
import { NewVendorDialog } from "@/components/purchase-orders/new-vendor-dialog";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  PurchaseOrderLivePreview,
  type PurchaseOrderPreviewView,
} from "@/components/purchase-orders/purchase-order-live-preview";
import { formatUsd } from "@/lib/format";
import { formatMoneyText, parseMoneyText } from "@/lib/money-input";
import { useStoredFlag } from "@/lib/hooks/use-stored-flag";
import { standardPageWidthClassName } from "@/lib/page-width";
import {
  draftPurchaseOrderMoney,
  type PurchaseOrderDraftPreviewInput,
} from "@/lib/purchase-order-draft-preview";
import { purchaseOrderJobFilterToken } from "@/lib/purchase-order-list-search";
import { purchaseOrderCategoryFormOptions } from "@/lib/purchase-order-utils";
import { selectedFillClassName } from "@/lib/selected-styles";
import type { ReceivingCategory } from "@/app/generated/prisma/client";

import {
  tableActionButtonClassName,
  tableBodyClassName,
  tableCellClassName,
  tableCellInputClassName,
  tableCompactClassName,
  tableComputedCellClassName,
  tableFlushWrapperClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableNumericCellInputClassName,
} from "@/lib/table-styles";
import { navigateAfterAction, reloadAfterAction } from "@/lib/reload-after-action";
type VendorOption = {
  id: string;
  name: string;
  defaultCategory: ReceivingCategory | null;
  /** The vendor's contact on file: a new order's "Attention". */
  contactName: string | null;
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
  /** Whether the signed-in user may add vendors (as in Settings, Vendors). */
  canAddVendor?: boolean;
  /**
   * Set when what is ordered can no longer change (deliveries came in, or
   * the order was cancelled): the sentence that says why. The vendor, the
   * category and the items are then shown but cannot be changed.
   */
  contentLockReason?: string | null;
  initial?: {
    vendorId: string;
    category: string;
    orderDate: string;
    expectedDate: string;
    notes: string;
    enteredBy: string;
    attention?: string;
    updatedAt: string;
    lines: Array<{
      productId: string | null;
      itemCode: string;
      description: string | null;
      quantityOrdered: number;
      unit: string;
      unitPrice: number;
    }>;
    /** Notes for the office only; they never print. */
    internalNotes?: string;
    /** The contractors (customers) the purchase is for. */
    contractors?: PurchaseOrderContractorOption[];
    /** The jobs the purchase is for: each on file (with its id) or typed (id null). */
    jobs?: PurchaseOrderJobChoice[];
    vendorQuoteName?: string | null;
    taxable?: boolean;
    /** A "quote only" order: its quote reference, and its total. */
    quoteOnly?: boolean;
    quoteNumber?: string | null;
    quoteDate?: string;
    quoteTotal?: number;
  };
};

/** A job in the Job box: a job on file, or a name typed in (no id). */
export type PurchaseOrderJobChoice = { id: string | null; label: string };

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

/** A typed quantity as a number; half-typed or empty counts as 0. */
function typedAmount(value: string): number {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** A typed price or total, which may carry "$" and thousands commas. */
function typedMoney(value: string): number {
  return parseMoneyText(value) ?? 0;
}

/** Unit prices are stored to four decimals (pipe by the foot). */
const UNIT_PRICE_DECIMALS = 4;

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

/** A picked contractor or job: its name in a box, with an × that takes it off. */
function PickedChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 py-1 pl-3 pr-1.5 text-xs font-medium text-slate-900">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
        className="rounded px-1 text-sm leading-none text-slate-500 hover:bg-slate-200 hover:text-slate-900"
      >
        ×
      </button>
    </span>
  );
}

export function PurchaseOrderEditor({
  mode,
  vendors,
  purchaseOrderId,
  backHref,
  backLabel,
  defaultEnteredBy = "",
  canAddVendor = false,
  contentLockReason = null,
  initial,
}: PurchaseOrderEditorProps) {
  const contentLocked = Boolean(contentLockReason);
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
  // Who at the vendor the order is addressed to. It starts as the vendor's
  // contact and can be changed for this order.
  const [attention, setAttention] = useState(initial?.attention ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  // For the office only: none of the next three prints on the purchase order.
  const [internalNotes, setInternalNotes] = useState(initial?.internalNotes ?? "");
  const [contractors, setContractors] = useState<PurchaseOrderContractorOption[]>(
    initial?.contractors ?? [],
  );
  const [jobs, setJobs] = useState<PurchaseOrderJobChoice[]>(initial?.jobs ?? []);
  // The job list offers open jobs that are not picked yet.
  const searchJobs = useCallback(
    (query: string) =>
      searchJobsForPurchaseOrder(
        query,
        jobs.flatMap((job) => (job.id ? [job.id] : [])),
      ),
    [jobs],
  );
  /** Adds a job once: a job on file by its id, a typed name whatever its capitals. */
  function addJob(next: PurchaseOrderJobChoice) {
    setJobs((current) =>
      current.some((job) =>
        next.id
          ? job.id === next.id
          : !job.id && job.label.toLowerCase() === next.label.toLowerCase(),
      )
        ? current
        : [...current, next],
    );
  }
  // The contractor list offers active customers that are not picked yet.
  const searchContractors = useCallback(
    (query: string) =>
      searchContractorsForPurchaseOrder(
        query,
        contractors.map((contractor) => contractor.id),
      ),
    [contractors],
  );
  const [taxable, setTaxable] = useState(initial?.taxable ?? false);
  // The vendor list can grow on this screen ("New vendor").
  const [vendorOptions, setVendorOptions] = useState(vendors);
  const [addingVendor, setAddingVendor] = useState(false);
  const closeNewVendor = useCallback(() => setAddingVendor(false), []);
  // Both ways of entering the order keep what was typed while the other one
  // is showing; only the one showing is saved.
  const [entryMode, setEntryMode] = useState<EntryMode>(
    initial?.quoteOnly ? "quote" : "lines",
  );
  const [quoteNumber, setQuoteNumber] = useState(initial?.quoteNumber ?? "");
  const [quoteDate, setQuoteDate] = useState(initial?.quoteDate ?? "");
  const [quoteTotal, setQuoteTotal] = useState(
    initial?.quoteOnly && initial.quoteTotal
      ? formatMoneyText(String(initial.quoteTotal))
      : "",
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
          unitPrice: formatMoneyText(String(line.unitPrice), UNIT_PRICE_DECIMALS),
        }))
      : [createLine()],
  );
  const [submissionKey] = useState(() => randomId());

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

  /**
   * The Attention box follows the vendor: empty, or still the last vendor's
   * contact, it takes the new vendor's. A name typed for this order stays.
   */
  function followVendorContact(nextVendor: VendorOption | undefined) {
    const previous =
      vendorOptions.find((entry) => entry.id === vendorId)?.contactName?.trim() ?? "";
    if (!attention.trim() || attention.trim() === previous) {
      setAttention(nextVendor?.contactName?.trim() ?? "");
    }
  }

  function handleVendorChange(nextVendorId: string) {
    const vendor = vendorOptions.find((entry) => entry.id === nextVendorId);
    followVendorContact(vendor);
    setVendorId(nextVendorId);
    if (vendor?.defaultCategory && !category) {
      setCategory(vendor.defaultCategory);
    }
  }

  function handleVendorCreated(vendor: VendorOption) {
    setVendorOptions((current) =>
      [...current, vendor].sort((a, b) => a.name.localeCompare(b.name)),
    );
    followVendorContact(vendor);
    setVendorId(vendor.id);
    if (vendor.defaultCategory && !category) {
      setCategory(vendor.defaultCategory);
    }
    setAddingVendor(false);
  }

  // What prints, in the shape the preview is drawn from. Category and the
  // vendor quote never reach the paper, so they are left out.
  const previewInput: PurchaseOrderDraftPreviewInput = {
    purchaseOrderId: purchaseOrderId ?? null,
    vendorId: vendorId || null,
    orderDate: orderDate || null,
    expectedDate: expectedDate || null,
    enteredBy: enteredBy.trim() || null,
    attention: attention.trim() || null,
    notes: notes.trim() || null,
    taxable,
    lines: lines.map((line) => ({
      itemCode: line.itemCode.trim(),
      description: line.description.trim(),
      quantityOrdered: typedAmount(line.quantityOrdered),
      unit: line.unit.trim(),
      unitPrice: typedMoney(line.unitPrice),
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
    formData.set("taxable", taxable ? "true" : "false");
    // Sent even when empty, so the server knows the boxes were on screen.
    formData.set("contractorsSent", "1");
    for (const contractor of contractors) {
      formData.append("contractorId", contractor.id);
    }
    formData.set("jobsSent", "1");
    for (const job of jobs) {
      formData.append(
        "job",
        purchaseOrderJobFilterToken(job.id ? { id: job.id } : { name: job.label }),
      );
    }

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
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm disabled:bg-slate-100 disabled:text-slate-600";
  // One height for boxes that share a row: a list is otherwise a little
  // taller than a text box, which pushes its label out of line.
  const fieldClass = `${inputClass} h-9`;
  const labelClass = "text-xs font-medium text-slate-700";
  // Every field has the width of what goes in it and sits at the left: a
  // date is not as wide as a vendor name, and nothing stretches with the
  // window.
  const fieldRowClass = "flex flex-wrap items-end gap-x-4 gap-y-3";

  return (
    <>
      {/* The page is full width for the preview; with the preview hidden the
          inputs go back to the standard column they were laid out for. */}
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
          {/* The cards stop at a readable width instead of following a wide
              window to its right edge. */}
          <div className="min-w-0 max-w-4xl space-y-4">
            <SectionCard title="Purchase order details">
              <div className="space-y-3">
                {contentLockReason ? (
                  <p className="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {contentLockReason}
                  </p>
                ) : null}
                <div className={fieldRowClass}>
                  <div className="w-80 max-w-full">
                    <label htmlFor="vendorId" className={labelClass}>
                      Vendor *
                    </label>
                    <select
                      id="vendorId"
                      required
                      disabled={contentLocked}
                      value={vendorId}
                      onChange={(event) => handleVendorChange(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Select vendor…</option>
                      {vendorOptions.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {canAddVendor && !contentLocked ? (
                    <button
                      type="button"
                      onClick={() => setAddingVendor(true)}
                      className="h-9 rounded-lg btn-plain px-3 text-xs font-semibold"
                    >
                      New vendor
                    </button>
                  ) : null}
                  <div className="w-56 max-w-full">
                    <label htmlFor="attention" className={labelClass}>
                      Attention
                    </label>
                    <input
                      id="attention"
                      name="attention"
                      value={attention}
                      onChange={(event) => setAttention(event.target.value)}
                      title="Who at the vendor the order is for. Prints as Attn: under the vendor's address."
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div className={fieldRowClass}>
                  <div className="min-w-0 max-w-full">
                    <label htmlFor="contractorBox" className={labelClass}>
                      Contractor
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {contractors.map((contractor) => (
                        <PickedChip
                          key={contractor.id}
                          label={contractor.name}
                          onRemove={() =>
                            setContractors((current) =>
                              current.filter((entry) => entry.id !== contractor.id),
                            )
                          }
                        />
                      ))}
                      <div className="w-64 max-w-full">
                        <FormTypeahead<PurchaseOrderContractorOption>
                          inputId="contractorBox"
                          selectedLabel=""
                          placeholder={
                            contractors.length > 0
                              ? "Add another contractor…"
                              : "Search contractors…"
                          }
                          searchItems={searchContractors}
                          itemKey={(customer) => customer.id}
                          itemLabel={(customer) => customer.name}
                          emptyLabel="No active customer matches."
                          onSelect={(customer) => {
                            if (customer) {
                              setContractors((current) =>
                                current.some((entry) => entry.id === customer.id)
                                  ? current
                                  : [...current, customer],
                              );
                            }
                          }}
                          inputClassName={fieldClass}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 max-w-full">
                    <label htmlFor="jobBox" className={labelClass}>
                      Job
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {jobs.map((job) => (
                        <PickedChip
                          key={job.id ?? `typed:${job.label.toLowerCase()}`}
                          label={job.label}
                          onRemove={() =>
                            setJobs((current) => current.filter((entry) => entry !== job))
                          }
                        />
                      ))}
                      <div className="w-80 max-w-full">
                        <FormTypeahead<PurchaseOrderJobOption>
                          inputId="jobBox"
                          selectedLabel=""
                          placeholder={
                            jobs.length > 0
                              ? "Add another job…"
                              : "Search open jobs, or type a name…"
                          }
                          searchItems={searchJobs}
                          itemKey={(option) => option.id}
                          itemLabel={(option) => option.label}
                          emptyLabel="No open job matches."
                          onSelect={(option) => {
                            if (option) {
                              addJob({ id: option.id, label: option.label });
                            }
                          }}
                          freeText={{
                            label: (typed) => `Use "${typed}" as typed (not a job on file)`,
                            onUse: (typed) => addJob({ id: null, label: typed }),
                          }}
                          inputClassName={fieldClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className={fieldRowClass}>
                  <div className="w-52 max-w-full">
                    <label htmlFor="category" className={labelClass}>
                      Category
                    </label>
                    <select
                      id="category"
                      disabled={contentLocked}
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className={fieldClass}
                    >
                      {purchaseOrderCategoryFormOptions.map((option) => (
                        <option key={option.value || "one-off"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-40">
                    <label htmlFor="orderDate" className={labelClass}>
                      Order date *
                    </label>
                    <input
                      id="orderDate"
                      name="orderDate"
                      type="date"
                      required
                      value={orderDate}
                      onChange={(event) => setOrderDate(event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div className="w-40">
                    <label htmlFor="expectedDate" className={labelClass}>
                      Expected delivery
                    </label>
                    <input
                      id="expectedDate"
                      name="expectedDate"
                      type="date"
                      value={expectedDate}
                      onChange={(event) => setExpectedDate(event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div className="w-40 max-w-full">
                    <label htmlFor="enteredBy" className={labelClass}>
                      Entered by
                    </label>
                    <input
                      id="enteredBy"
                      name="enteredBy"
                      value={enteredBy}
                      onChange={(event) => setEnteredBy(event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <label
                    className="flex cursor-pointer items-center gap-2 py-2 text-xs font-medium text-slate-700"
                    title="Ticked: the purchase order says Taxable. Not ticked: it says Non-taxable."
                  >
                    <input
                      type="checkbox"
                      checked={taxable}
                      onChange={(event) => setTaxable(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Taxable
                  </label>
                </div>
                <div className="max-w-2xl">
                  <label htmlFor="notes" className={labelClass}>
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
                <div className="max-w-2xl">
                  <label htmlFor="internalNotes" className={labelClass}>
                    Internal notes{" "}
                    <span className="font-normal text-slate-500">
                      (for the office, not on the PDF)
                    </span>
                  </label>
                  <textarea
                    id="internalNotes"
                    name="internalNotes"
                    rows={2}
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
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
                      disabled={contentLocked}
                      onClick={() => setEntryMode(option.value)}
                      className={`px-3 py-1 disabled:cursor-not-allowed [&:not(:first-child)]:border-l [&:not(:first-child)]:border-slate-300 ${
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
              {/* Locked: shown as saved, every box in it switched off. */}
              <fieldset disabled={contentLocked} className="min-w-0 disabled:opacity-70">
              {entryMode === "quote" ? (
                <div className="space-y-3 p-4">
                  <p className="text-xs text-slate-500">
                    The purchase order orders everything on the vendor&apos;s quote and
                    names it by number, date and total. No items are listed.
                  </p>
                  <div className={fieldRowClass}>
                    <div className="w-48 max-w-full">
                      <label htmlFor="quoteNumber" className={labelClass}>
                        Quote number
                      </label>
                      <input
                        id="quoteNumber"
                        name="quoteNumber"
                        value={quoteNumber}
                        onChange={(event) => setQuoteNumber(event.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div className="w-40">
                      <label htmlFor="quoteDate" className={labelClass}>
                        Quote date
                      </label>
                      <input
                        id="quoteDate"
                        name="quoteDate"
                        type="date"
                        value={quoteDate}
                        onChange={(event) => setQuoteDate(event.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div className="w-40">
                      <label htmlFor="quoteTotal" className={labelClass}>
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
                        // Leaving the box tidies it: "30318" reads "30,318.00".
                        onBlur={() => setQuoteTotal((typed) => formatMoneyText(typed))}
                        className={`${fieldClass} text-right tabular-nums`}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* An Excel-style grid: each column as wide as what goes in
                      it, the cells are the inputs. */}
                  <div className={tableFlushWrapperClassName}>
                    <table className={`${tableCompactClassName} table-fixed`}>
                      <colgroup>
                        <col className="w-36" />
                        <col className="w-80" />
                        <col className="w-16" />
                        <col className="w-16" />
                        <col className="w-24" />
                        <col className="w-28" />
                        <col className="w-20" />
                      </colgroup>
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
                            <td className={tableGridCellClassName}>
                              <input
                                value={line.itemCode}
                                onChange={(event) =>
                                  updateLine(line.id, { itemCode: event.target.value })
                                }
                                placeholder="Item code"
                                aria-label={`Line ${index + 1} item code`}
                                className={tableCellInputClassName}
                              />
                            </td>
                            <td className={tableGridCellClassName}>
                              <input
                                value={line.description}
                                onChange={(event) =>
                                  updateLine(line.id, { description: event.target.value })
                                }
                                placeholder="Description"
                                aria-label={`Line ${index + 1} description`}
                                className={tableCellInputClassName}
                              />
                            </td>
                            <td className={tableGridCellClassName}>
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
                                aria-label={`Line ${index + 1} quantity`}
                                className={tableNumericCellInputClassName}
                              />
                            </td>
                            <td className={tableGridCellClassName}>
                              <input
                                value={line.unit}
                                onChange={(event) =>
                                  updateLine(line.id, { unit: event.target.value })
                                }
                                aria-label={`Line ${index + 1} unit`}
                                className={tableCellInputClassName}
                              />
                            </td>
                            <td className={tableGridCellClassName}>
                              <input
                                // Text, so it can show "1,185.00" once left.
                                inputMode="decimal"
                                value={line.unitPrice}
                                onChange={(event) =>
                                  updateLine(line.id, { unitPrice: event.target.value })
                                }
                                onBlur={() =>
                                  updateLine(line.id, {
                                    unitPrice: formatMoneyText(
                                      line.unitPrice,
                                      UNIT_PRICE_DECIMALS,
                                    ),
                                  })
                                }
                                aria-label={`Line ${index + 1} price`}
                                className={tableNumericCellInputClassName}
                              />
                            </td>
                            <td className={tableComputedCellClassName}>
                              {formatUsd(money.lineTotals[index] ?? 0)}
                            </td>
                            <td className={`${tableCellClassName} py-1`}>
                              <button
                                type="button"
                                onClick={() => removeLine(line.id)}
                                disabled={lines.length <= 1}
                                className={tableActionButtonClassName}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 px-4 py-3">
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
              </fieldset>
            </SectionCard>

            <SectionCard title="Vendor quote PDF">
              <div className="max-w-xl">
                <FileUploadDropzone
                  files={quoteFiles}
                  onFilesChange={handleQuoteFilesChange}
                  accept=".pdf,application/pdf"
                  multiple={false}
                  compact
                  label="Drop vendor quote PDF here"
                  description={
                    entryMode === "quote"
                      ? "It opens in the preview pane, so its number, date and total can be typed from it."
                      : "It opens in the preview pane, so the lines can be typed from it."
                  }
                />
                {initial?.vendorQuoteName && quoteFiles.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Current file: {initial.vendorQuoteName}. Upload a new PDF to replace
                    it.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
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
      {/* Outside the form above: it is a form of its own. */}
      {addingVendor ? (
        <NewVendorDialog onCreated={handleVendorCreated} onClose={closeNewVendor} />
      ) : null}
    </>
  );
}
