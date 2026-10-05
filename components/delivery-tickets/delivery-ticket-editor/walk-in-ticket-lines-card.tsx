"use client";

import { SectionCard } from "@/components/dashboard/section-card";
import { formatUsd } from "@/lib/format";
import { DASHBOARD_HEADER_HEIGHT, inlineTableInputClass } from "./editor-styles";
import {
  formatWeight,
  parseEditorWeight,
  productPriceFor,
} from "./editor-utils";
import type { EditorLine, ProductOption } from "./types";

type WalkInTicketLinesCardProps = {
  stickyRegionHeight: number;
  lines: EditorLine[];
  products: ProductOption[];
  showLineWeights: boolean;
  onToggleLineWeights: () => void;
  updateLine: (key: string, field: keyof EditorLine, value: string) => void;
  removeLine: (key: string) => void;
  markDirty: () => void;
  walkInSubtotal: number;
  walkInMoney: { salesTax: number; total: number };
  walkInMissingPriceCount: number;
  defaultTaxRatePercent: number;
  totalWeight: number;
};

/** Walk-in "On this ticket" panel (sticky on xl): quantity steppers, price
 * each with a "custom" tag, optional per-line weights, and the totals. */
export function WalkInTicketLinesCard({
  stickyRegionHeight,
  lines,
  products,
  showLineWeights,
  onToggleLineWeights,
  updateLine,
  removeLine,
  markDirty,
  walkInSubtotal,
  walkInMoney,
  walkInMissingPriceCount,
  defaultTaxRatePercent,
  totalWeight,
}: WalkInTicketLinesCardProps) {
  return (
    <div
      className="xl:sticky xl:self-start"
      style={{
        top: `${DASHBOARD_HEADER_HEIGHT + stickyRegionHeight + 8}px`,
      }}
    >
      <SectionCard
        title="On this ticket"
        description="Adjust quantities and prices here."
        action={
          lines.length > 0 ? (
            <button
              type="button"
              onClick={onToggleLineWeights}
              className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              {showLineWeights
                ? "Hide individual weights"
                : "Show individual weights"}
            </button>
          ) : null
        }
      >
        {lines.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nothing here yet — tap products on the left to add them.
          </p>
        ) : (
          <div className="space-y-1.5">
            {lines.map((line) => {
              const qty = Number(line.quantity) || 0;
              const price = Number(line.unitPrice ?? "");
              const priceMissing =
                !line.unitPrice?.trim() ||
                !Number.isFinite(price) ||
                price < 0;
              const weightEach = parseEditorWeight(line.weightEach) ?? 0;
              // Hand-entered price (differs from the active list's
              // pickup price) — tagged so list switches don't hide it.
              const catalogProduct = line.productId
                ? products.find((entry) => entry.id === line.productId)
                : undefined;
              const catalogPrice = catalogProduct
                ? productPriceFor(catalogProduct, true)
                : null;
              const isCustomPrice =
                !priceMissing &&
                catalogPrice != null &&
                Math.abs(price - catalogPrice) >= 0.005;
              return (
                <div
                  key={line.key}
                  className="rounded-lg border border-slate-200 p-2"
                >
                  <div className="flex items-start gap-1.5 text-xs">
                    <button
                      type="button"
                      aria-label={`Remove ${line.itemCode}`}
                      title={`Remove ${line.itemCode}`}
                      onClick={() => removeLine(line.key)}
                      className="mt-px shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900">
                        {line.itemCode}
                      </span>
                      <span className="ml-1.5 text-slate-500">
                        {line.description}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Qty
                      </span>
                      <button
                        type="button"
                        aria-label={`Decrease ${line.itemCode} quantity`}
                        onClick={() => {
                          const next = Math.max(
                            0,
                            (Number(line.quantity) || 0) - 1,
                          );
                          updateLine(
                            line.key,
                            "quantity",
                            String(next),
                          );
                          markDirty();
                        }}
                        className="h-8 w-6 shrink-0 rounded-md text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        −
                      </button>
                      <input
                        aria-label={`${line.itemCode} quantity`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.key, "quantity", event.target.value)
                        }
                        className={`w-9 ${inlineTableInputClass} !px-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${line.itemCode} quantity`}
                        onClick={() => {
                          updateLine(
                            line.key,
                            "quantity",
                            String((Number(line.quantity) || 0) + 1),
                          );
                          markDirty();
                        }}
                        className="h-8 w-6 shrink-0 rounded-md text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        +
                      </button>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Each
                      </span>
                      <span>$</span>
                      <input
                        aria-label={`${line.itemCode} price each`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice ?? ""}
                        placeholder="0.00"
                        onChange={(event) =>
                          updateLine(line.key, "unitPrice", event.target.value)
                        }
                        onBlur={() => {
                          const parsed = Number(line.unitPrice ?? "");
                          if (
                            line.unitPrice?.trim() &&
                            Number.isFinite(parsed) &&
                            parsed >= 0
                          ) {
                            updateLine(
                              line.key,
                              "unitPrice",
                              parsed.toFixed(2),
                            );
                          }
                        }}
                        className={`w-20 ${inlineTableInputClass} text-center ${
                          priceMissing ? "border-amber-400 bg-amber-50/60" : ""
                        }`}
                      />
                      {isCustomPrice ? (
                        <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-800">
                          custom
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto text-sm font-semibold text-slate-900">
                      {!priceMissing && qty > 0
                        ? formatUsd(qty * price)
                        : "—"}
                    </span>
                  </div>
                  {showLineWeights ? (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span>Weight each</span>
                      <input
                        aria-label={`${line.itemCode} weight each`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.weightEach}
                        onChange={(event) =>
                          updateLine(line.key, "weightEach", event.target.value)
                        }
                        className={`w-16 ${inlineTableInputClass} text-center`}
                      />
                      <span>lb</span>
                      {qty > 0 && weightEach > 0 ? (
                        <span className="ml-auto">
                          {formatWeight(qty * weightEach)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="space-y-0.5 border-t border-slate-200 pt-2 text-xs">
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-slate-600">Subtotal</span>
                <span className="w-24 text-right font-medium text-slate-900">
                  {formatUsd(walkInSubtotal)}
                </span>
              </div>
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-slate-600">
                  Tax ({defaultTaxRatePercent.toFixed(3).replace(/\.?0+$/, "")}%)
                </span>
                <span className="w-24 text-right font-medium text-slate-900">
                  {formatUsd(walkInMoney.salesTax)}
                </span>
              </div>
              <div className="flex items-baseline justify-end gap-2 border-t border-slate-200 pt-1">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="w-24 text-right text-sm font-semibold text-slate-900">
                  {formatUsd(walkInMoney.total)}
                </span>
              </div>
            </div>
            {walkInMissingPriceCount > 0 ? (
              <p className="text-[11px] text-amber-700">
                {walkInMissingPriceCount} line
                {walkInMissingPriceCount === 1 ? "" : "s"} missing a price —
                they won&apos;t count toward the subtotal.
              </p>
            ) : null}
            {totalWeight > 0 ? (
              <div className="flex items-baseline justify-end gap-2 text-[11px] text-slate-500">
                <span>Total weight</span>
                <span className="w-24 text-right">
                  {formatWeight(totalWeight)}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
