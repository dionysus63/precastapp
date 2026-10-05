"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  CustomStructureCostBreakdown,
  CustomStructurePricingFooter,
} from "@/components/quotes/custom-structure-cost-breakdown";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  formatQuoteCurrency,
  parseQuoteNumber,
  quoteInputClassName,
} from "@/components/quotes/quote-utils";
import { resolveCustomStructureUnitPrice } from "@/lib/quotes/custom-structure";
import type { CustomStructureCostItem } from "@/lib/quotes/types";
import {
  createDefaultCustomStructureRow,
  type CustomStructureRow,
  type CustomStructureRowField,
} from "@/components/quotes/quote-form/quote-form-utils";

/** Body of the add-line modal for "Custom Structure" (multi-row editor). */
export function AddCustomStructurePanel({
  jobId,
  customStructureRows,
  setCustomStructureRows,
  onOpenImport,
  customPasteOpen,
  setCustomPasteOpen,
  customPasteText,
  setCustomPasteText,
  customPasteError,
  setCustomPasteError,
  onPaste,
  updateCustomStructureRow,
  updateCustomStructureRowCostItems,
  duplicateCustomStructureRow,
  onCancel,
  onAdd,
}: {
  jobId: string;
  customStructureRows: CustomStructureRow[];
  setCustomStructureRows: Dispatch<SetStateAction<CustomStructureRow[]>>;
  onOpenImport: () => Promise<void>;
  customPasteOpen: boolean;
  setCustomPasteOpen: Dispatch<SetStateAction<boolean>>;
  customPasteText: string;
  setCustomPasteText: (value: string) => void;
  customPasteError: string | null;
  setCustomPasteError: (value: string | null) => void;
  onPaste: () => void;
  updateCustomStructureRow: (
    id: string,
    field: CustomStructureRowField,
    value: string,
  ) => void;
  updateCustomStructureRowCostItems: (
    id: string,
    costItems: CustomStructureCostItem[],
  ) => void;
  duplicateCustomStructureRow: (id: string) => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div className="border-b border-slate-100 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Add Custom Structure
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Job-specific structures with optional internal cost breakdown.
          Breakdown totals auto-calculate the unit price.
        </p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-700">
            {customStructureRows.length} structure
            {customStructureRows.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {jobId ? (
              <button
                type="button"
                onClick={() => void onOpenImport()}
                className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
              >
                Import from job structures
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setCustomPasteOpen((current) => !current);
                setCustomPasteError(null);
              }}
              className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
            >
              Paste from Excel
            </button>
            <button
              type="button"
              onClick={() =>
                setCustomStructureRows((current) => [
                  ...current,
                  createDefaultCustomStructureRow(current),
                ])
              }
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add another structure
            </button>
          </div>
        </div>
        {customPasteOpen ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
            <p className="text-[11px] font-medium text-slate-700">
              Paste cells from Excel — include the header row.
              Recognized columns: Structure #, Description, Qty, Unit
              Price, Weight, Yards.
            </p>
            <textarea
              rows={5}
              value={customPasteText}
              onChange={(event) => {
                setCustomPasteText(event.target.value);
                setCustomPasteError(null);
              }}
              placeholder={
                "Structure #\tDescription\tQty\tUnit Price\tWeight\tYards\nCS-1\tCustom 8'x12' valve vault\t2\t32500\t28500\t9.2"
              }
              className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] text-slate-900"
            />
            {customPasteError ? (
              <p className="mt-2 text-[11px] font-medium text-red-600">
                {customPasteError}
              </p>
            ) : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onPaste}
                disabled={!customPasteText.trim()}
                className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Add pasted structures
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomPasteOpen(false);
                  setCustomPasteError(null);
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {customStructureRows.map((row, rowIndex) => (
          <div
            key={row.id}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(8rem,1fr)_5rem]">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700">
                    Structure #
                  </label>
                  <input
                    type="text"
                    value={row.structureNumber}
                    onChange={(event) =>
                      updateCustomStructureRow(
                        row.id,
                        "structureNumber",
                        event.target.value,
                      )
                    }
                    className={`${quoteInputClassName} mt-1`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700">
                    Qty
                  </label>
                  <input
                    type="text"
                    value={row.qty}
                    onChange={(event) =>
                      updateCustomStructureRow(
                        row.id,
                        "qty",
                        event.target.value,
                      )
                    }
                    className={`${quoteInputClassName} mt-1`}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => duplicateCustomStructureRow(row.id)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Duplicate
                </button>
                {customStructureRows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCustomStructureRows((current) =>
                        current.filter((entry) => entry.id !== row.id),
                      )
                    }
                    className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700">
                Description
              </label>
              <div className="mt-1">
                <RichTextEditor
                  value={row.description}
                  onChange={(value) =>
                    updateCustomStructureRow(
                      row.id,
                      "description",
                      value,
                    )
                  }
                  placeholder="Custom 8'x12' valve vault with aluminum hatch"
                  minHeightClassName="min-h-[5.5rem]"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-700">
                  Weight (lb)
                </label>
                <input
                  type="text"
                  value={row.weight}
                  onChange={(event) =>
                    updateCustomStructureRow(
                      row.id,
                      "weight",
                      event.target.value,
                    )
                  }
                  placeholder="28500"
                  className={`${quoteInputClassName} mt-1`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700">
                  Yards
                </label>
                <input
                  type="text"
                  value={row.yards}
                  onChange={(event) =>
                    updateCustomStructureRow(
                      row.id,
                      "yards",
                      event.target.value,
                    )
                  }
                  placeholder="9.2"
                  className={`${quoteInputClassName} mt-1`}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Used for production and delivery planning.
                </p>
              </div>
            </div>

            <CustomStructureCostBreakdown
              items={row.costItems}
              onChange={(costItems) =>
                updateCustomStructureRowCostItems(row.id, costItems)
              }
            />

            <CustomStructurePricingFooter
              qty={row.qty}
              unitPrice={row.unitPrice}
              costItems={row.costItems}
              onUnitPriceChange={(value) =>
                updateCustomStructureRow(row.id, "unitPrice", value)
              }
            />

            {rowIndex < customStructureRows.length - 1 ? (
              <div className="border-b border-slate-100 pt-1" />
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-600">
          Combined total:{" "}
          <span className="font-semibold text-slate-900">
            {formatQuoteCurrency(
              customStructureRows.reduce((sum, row) => {
                const unitPrice = parseQuoteNumber(
                  resolveCustomStructureUnitPrice(
                    row.unitPrice,
                    row.costItems,
                  ),
                );
                return (
                  sum + unitPrice * parseQuoteNumber(row.qty || "1")
                );
              }, 0),
            )}
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Add to Quote
          </button>
        </div>
      </div>
    </>
  );
}
