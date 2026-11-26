import { isNonBillableLineItem } from "@/lib/quotes/constants";
import {
  netUnitPrice,
  normalizeDiscountPercent,
} from "@/lib/pricing/line-discount";

/** The pricing part of a quote line as the quote form sends it. */
export type LineDiscountInput = {
  lineType: string;
  /** The billed price. Ignored when a list price comes with the line. */
  unitPrice: number;
  /** Price before the discount; absent on callers that know no discounts. */
  listPrice?: number | null;
  discountPercent?: number | null;
  discountTyped?: boolean;
};

export type LineDiscountResolved = {
  unitPrice: number;
  listPrice: number | null;
  discountPercent: number | null;
  discountTyped: boolean;
};

/**
 * Works out what a line bills at. The billed price is always recomputed here
 * from the list price and the percentage, so a stale or tampered browser
 * cannot store a price that does not match its own discount.
 *
 * A line with no discount stores no list price: its unit price is the list
 * price. The one exception is a discount typed down to nothing, which is kept
 * (as 0%) so the line does not pick the standard discount up again.
 */
export function resolveLineDiscount(line: LineDiscountInput): LineDiscountResolved {
  const listPrice = line.listPrice ?? line.unitPrice;
  if (isNonBillableLineItem(line.lineType)) {
    return {
      unitPrice: line.unitPrice,
      listPrice: null,
      discountPercent: null,
      discountTyped: false,
    };
  }
  const percent = normalizeDiscountPercent(line.discountPercent);
  const typed = Boolean(line.discountTyped);
  if (percent === 0 && !typed) {
    return {
      unitPrice: listPrice,
      listPrice: null,
      discountPercent: null,
      discountTyped: false,
    };
  }
  return {
    unitPrice: netUnitPrice(listPrice, percent),
    listPrice,
    discountPercent: percent,
    discountTyped: typed,
  };
}

/** Every line of a save, with its billed price worked out. */
export function resolveLineDiscounts<Line extends LineDiscountInput>(
  lines: Line[],
): Array<Line & LineDiscountResolved> {
  return lines.map((line) => ({ ...line, ...resolveLineDiscount(line) }));
}
