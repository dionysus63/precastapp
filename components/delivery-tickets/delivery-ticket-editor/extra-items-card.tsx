"use client";

import { SectionCard } from "@/components/dashboard/section-card";
import { formatUsd } from "@/lib/format";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
} from "@/lib/table-styles";
import { compactInputClass } from "./editor-styles";
import { productPriceFor } from "./editor-utils";
import type { EditorLine, ProductOption } from "./types";

type ExtraItemsCardProps = {
  isPickup: boolean;
  extraSearch: string;
  onExtraSearchChange: (value: string) => void;
  extraResults: ProductOption[];
  extraLines: EditorLine[];
  onAddProduct: (product: ProductOption) => void;
  onAddCustomLine: () => void;
  updateLine: (key: string, field: keyof EditorLine, value: string) => void;
  removeLine: (key: string) => void;
};

/** JOB ticket: items the customer added after the quote — catalog search,
 * custom lines, and the priced extras table. */
export function ExtraItemsCard({
  isPickup,
  extraSearch,
  onExtraSearchChange,
  extraResults,
  extraLines,
  onAddProduct,
  onAddCustomLine,
  updateLine,
  removeLine,
}: ExtraItemsCardProps) {
  return (
    <SectionCard
      title="Extra items"
      description="Items the customer added after the quote — no new quote needed; they bill on the invoice at the price you enter here."
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            value={extraSearch}
            onChange={(event) => onExtraSearchChange(event.target.value)}
            placeholder="Search products by code or name…"
            className={compactInputClass}
          />
          {extraResults.length > 0 ? (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              {extraResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onAddProduct(product)}
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-slate-900">
                      {product.productCode}
                    </span>{" "}
                    <span className="text-slate-600">{product.name}</span>
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {(() => {
                      const price = productPriceFor(product, isPickup);
                      return price != null
                        ? formatUsd(price)
                        : "no list price";
                    })()}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onAddCustomLine}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Custom item
        </button>
      </div>

      {extraLines.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Item</th>
                <th className={tableHeaderCellClassName}>Description</th>
                <th className={`${tableHeaderCellClassName} text-center`}>Qty</th>
                <th className={`${tableHeaderCellClassName} text-center`}>Unit</th>
                <th className={`${tableHeaderCellClassName} text-center`}>
                  Price Each ($) *
                </th>
                <th className={`${tableHeaderCellClassName} text-center`}>
                  Weight Each (lb)
                </th>
                <th className={`${tableHeaderCellClassName} text-right`}>
                  Line Total
                </th>
                <th className={tableHeaderCellClassName} />
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {extraLines.map((line) => {
                const qty = Number(line.quantity) || 0;
                const price = Number(line.unitPrice ?? "");
                const priceMissing =
                  !line.unitPrice?.trim() ||
                  !Number.isFinite(price) ||
                  price < 0;
                return (
                  <tr key={line.key}>
                    <td className={tableCellClassName}>
                      {line.productId ? (
                        <span className="font-medium text-slate-900">
                          {line.itemCode}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={line.itemCode}
                          placeholder="Item code / name"
                          onChange={(event) =>
                            updateLine(
                              line.key,
                              "itemCode",
                              event.target.value,
                            )
                          }
                          className={`w-32 ${tableInlineInputClassName}`}
                        />
                      )}
                    </td>
                    <td className={tableCellClassName}>
                      <input
                        type="text"
                        value={line.description}
                        onChange={(event) =>
                          updateLine(
                            line.key,
                            "description",
                            event.target.value,
                          )
                        }
                        className={`w-full min-w-40 ${tableInlineInputClassName}`}
                      />
                    </td>
                    <td className={`${tableCellClassName} text-center`}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(
                            line.key,
                            "quantity",
                            event.target.value,
                          )
                        }
                        className={`mx-auto w-16 ${tableInlineInputClassName} text-center`}
                      />
                    </td>
                    <td className={`${tableCellClassName} text-center text-slate-600`}>
                      {line.unit}
                    </td>
                    <td className={`${tableCellClassName} text-center`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice ?? ""}
                        placeholder="required"
                        onChange={(event) =>
                          updateLine(
                            line.key,
                            "unitPrice",
                            event.target.value,
                          )
                        }
                        className={`mx-auto w-24 ${tableInlineInputClassName} text-center ${
                          priceMissing
                            ? "border-amber-400 bg-amber-50/60"
                            : ""
                        }`}
                      />
                    </td>
                    <td className={`${tableCellClassName} text-center`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.weightEach}
                        onChange={(event) =>
                          updateLine(
                            line.key,
                            "weightEach",
                            event.target.value,
                          )
                        }
                        className={`mx-auto w-20 ${tableInlineInputClassName} text-center`}
                      />
                    </td>
                    <td className={`${tableCellClassName} text-right font-medium text-slate-900`}>
                      {!priceMissing && qty > 0
                        ? formatUsd(qty * price)
                        : "—"}
                    </td>
                    <td className={`${tableCellClassName} text-right`}>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          Nothing extra on this load — search the catalog or add a custom
          item when a customer phones something in.
        </p>
      )}
    </SectionCard>
  );
}
