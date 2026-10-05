"use client";

import {
  CustomStructureCostBreakdown,
  CustomStructurePricingFooter,
} from "@/components/quotes/custom-structure-cost-breakdown";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { quoteInputClassName } from "@/components/quotes/quote-utils";
import type { CustomStructureCostItem } from "@/lib/quotes/types";
import type {
  CustomStructureRow,
  CustomStructureRowField,
} from "@/components/quotes/quote-form/quote-form-utils";

/** "Edit Custom Structure" dialog for a custom structure line already on the quote. */
export function EditCustomStructureDialog({
  draft,
  onFieldChange,
  onCostItemsChange,
  onCancel,
  onSave,
}: {
  draft: CustomStructureRow;
  onFieldChange: (field: CustomStructureRowField, value: string) => void;
  onCostItemsChange: (costItems: CustomStructureCostItem[]) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="border-b border-slate-100 px-4 py-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Edit Custom Structure
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Update structure details, internal cost breakdown, and pricing.
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Structure Number
              </label>
              <input
                type="text"
                value={draft.structureNumber}
                onChange={(event) =>
                  onFieldChange(
                    "structureNumber",
                    event.target.value,
                  )
                }
                className={quoteInputClassName}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Quantity
              </label>
              <input
                type="text"
                value={draft.qty}
                onChange={(event) =>
                  onFieldChange("qty", event.target.value)
                }
                className={quoteInputClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700">
                Description
              </label>
              <RichTextEditor
                value={draft.description}
                onChange={(value) =>
                  onFieldChange("description", value)
                }
                minHeightClassName="min-h-[7rem]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Weight (lb)
              </label>
              <input
                type="text"
                value={draft.weight}
                onChange={(event) =>
                  onFieldChange(
                    "weight",
                    event.target.value,
                  )
                }
                className={quoteInputClassName}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Yards
              </label>
              <input
                type="text"
                value={draft.yards}
                onChange={(event) =>
                  onFieldChange("yards", event.target.value)
                }
                className={quoteInputClassName}
              />
            </div>
          </div>

          <CustomStructureCostBreakdown
            items={draft.costItems}
            onChange={onCostItemsChange}
          />

          <CustomStructurePricingFooter
            qty={draft.qty}
            unitPrice={draft.unitPrice}
            costItems={draft.costItems}
            onUnitPriceChange={(value) =>
              onFieldChange("unitPrice", value)
            }
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
