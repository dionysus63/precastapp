"use client";

import {
  QUOTE_DISCOUNT_BASES,
  QUOTE_DISCOUNT_BASIS_LABELS,
  type QuoteDiscountBasis,
} from "@/lib/pricing/line-discount";
import { selectedClassName } from "@/lib/selected-styles";

/**
 * Above the quote's line table: is this quote priced delivered or picked up,
 * and does the printed quote show the discount.
 */
export function QuoteDiscountBar({
  discountBasis,
  onDiscountBasisChange,
  showDiscount,
  onShowDiscountChange,
  hasDiscountedLine,
}: {
  discountBasis: QuoteDiscountBasis;
  onDiscountBasisChange: (basis: QuoteDiscountBasis) => void;
  showDiscount: boolean;
  onShowDiscountChange: (show: boolean) => void;
  hasDiscountedLine: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
      data-quote-discount-bar
    >
      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-slate-600">
          Discounts for
        </span>
        <div className="flex gap-1.5" role="group" aria-label="Discounts for">
          {QUOTE_DISCOUNT_BASES.map((basis) => {
            const active = basis === discountBasis;
            return (
              <button
                key={basis}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (!active) {
                    onDiscountBasisChange(basis);
                  }
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  active
                    ? selectedClassName
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {QUOTE_DISCOUNT_BASIS_LABELS[basis]}
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={showDiscount}
          onChange={(event) => onShowDiscountChange(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300"
        />
        Show discounts on the printed quote
      </label>
      <span className="text-xs text-slate-500">
        {!hasDiscountedLine
          ? "No line has a discount, so the quote prints with no discount column."
          : showDiscount
            ? "The quote prints List Price, Disc % and Net Price."
            : "The quote prints the price after discount only."}
      </span>
    </div>
  );
}
