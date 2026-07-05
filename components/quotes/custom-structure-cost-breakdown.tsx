"use client";

import {
  createDefaultCostItem,
  getCostItemExtendedTotal,
  hasCostBreakdown,
  sumCostBreakdown,
} from "@/lib/quotes/custom-structure";
import type { CustomStructureCostItem } from "@/lib/quotes/types";
import { formatQuoteCurrency, parseQuoteNumber } from "@/components/quotes/quote-utils";

const inputClassName =
  "w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm";

export type CustomStructureCostBreakdownProps = {
  items: CustomStructureCostItem[];
  onChange: (items: CustomStructureCostItem[]) => void;
  compact?: boolean;
};

export function CustomStructureCostBreakdown({
  items,
  onChange,
  compact = false,
}: CustomStructureCostBreakdownProps) {
  function updateItem(
    id: string,
    field: keyof Omit<CustomStructureCostItem, "id">,
    value: string,
  ) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function addItem() {
    onChange([...items, createDefaultCostItem()]);
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  const breakdownTotal = sumCostBreakdown(items);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-900">Cost Breakdown</h4>
          <p className="text-[11px] text-slate-500">
            Internal only — not shown on customer PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add cost line
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-[11px] text-slate-500">
          No cost lines yet — add concrete, hatches, castings, etc. to build up
          the price.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="min-w-[10rem] px-3 py-2 font-semibold">Item</th>
                <th className="w-20 px-3 py-2 font-semibold">Qty</th>
                <th className="w-28 px-3 py-2 font-semibold">Unit Cost</th>
                <th className="w-28 px-3 py-2 font-semibold">Extended</th>
                <th className="w-16 px-3 py-2 font-semibold"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(event) =>
                        updateItem(item.id, "label", event.target.value)
                      }
                      placeholder="Concrete, hatch, labor..."
                      className={inputClassName}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.qty}
                      onChange={(event) =>
                        updateItem(item.id, "qty", event.target.value)
                      }
                      className={`${inputClassName} min-w-0 max-w-[4.5rem]`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.unitCost}
                      onChange={(event) =>
                        updateItem(item.id, "unitCost", event.target.value)
                      }
                      placeholder="0.00"
                      className={inputClassName}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 pt-3 font-medium text-slate-700">
                    {formatQuoteCurrency(getCostItemExtendedTotal(item))}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-[11px] font-medium text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60">
                <td
                  colSpan={3}
                  className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Breakdown total
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">
                  {formatQuoteCurrency(breakdownTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export type CustomStructurePricingFooterProps = {
  qty: string;
  unitPrice: string;
  costItems: CustomStructureCostItem[];
  onUnitPriceChange: (value: string) => void;
};

export function CustomStructurePricingFooter({
  qty,
  unitPrice,
  costItems,
  onUnitPriceChange,
}: CustomStructurePricingFooterProps) {
  const breakdownActive = hasCostBreakdown(costItems);
  const resolvedUnitPrice = breakdownActive
    ? sumCostBreakdown(costItems)
    : parseQuoteNumber(unitPrice);
  const lineTotal = resolvedUnitPrice * parseQuoteNumber(qty || "1");

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Unit Price
          </label>
          {breakdownActive ? (
            <div className="mt-1">
              <p className="text-sm font-semibold text-slate-900">
                {formatQuoteCurrency(resolvedUnitPrice)}
              </p>
              <p className="text-[11px] text-slate-500">
                Calculated from breakdown
              </p>
            </div>
          ) : (
            <input
              type="text"
              value={unitPrice}
              onChange={(event) => onUnitPriceChange(event.target.value)}
              placeholder="32500"
              className={`${inputClassName} mt-1`}
            />
          )}
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Quantity
          </label>
          <p className="mt-1 text-sm font-medium text-slate-900">{qty || "1"}</p>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Line Total
          </label>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatQuoteCurrency(lineTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CustomStructureDetailBreakdown({
  items,
}: {
  items: CustomStructureCostItem[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <details className="mt-2 rounded-lg border border-amber-200 bg-amber-50/40">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-amber-900">
        Internal cost breakdown ({items.length} line
        {items.length === 1 ? "" : "s"}) — not shown to customer
      </summary>
      <div className="border-t border-amber-200 px-3 py-2">
        <table className="min-w-full text-left text-[11px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-amber-800/80">
              <th className="pb-1 font-semibold">Item</th>
              <th className="pb-1 font-semibold">Qty</th>
              <th className="pb-1 font-semibold">Unit Cost</th>
              <th className="pb-1 font-semibold">Extended</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-1 text-amber-950">{item.label || "—"}</td>
                <td className="py-1 text-amber-950">{item.qty}</td>
                <td className="py-1 text-amber-950">
                  {formatQuoteCurrency(parseQuoteNumber(item.unitCost))}
                </td>
                <td className="py-1 font-medium text-amber-950">
                  {formatQuoteCurrency(getCostItemExtendedTotal(item))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                className="pt-2 text-right text-[10px] font-semibold uppercase tracking-wide text-amber-800/80"
              >
                Total
              </td>
              <td className="pt-2 font-semibold text-amber-950">
                {formatQuoteCurrency(sumCostBreakdown(items))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}
