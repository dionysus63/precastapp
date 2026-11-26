import {
  netUnitPrice,
  normalizeDiscountPercent,
  type DiscountRuleLine,
  type DiscountRuleLookup,
  type QuoteDiscountBasis,
} from "@/lib/pricing/line-discount";

/**
 * What a load bills at. A quote is priced one way, delivered or picked up,
 * but each load is billed by how it actually left: a line that follows its
 * group's standard discount takes the discount for that load, and a price
 * agreed by hand stays the same on every load.
 *
 * Safe to import from both server and client modules.
 */

/** How a ticket's load leaves, as a discount basis. */
export function loadBasisForFulfillment(
  fulfillmentMethod: string | null | undefined,
): QuoteDiscountBasis {
  return fulfillmentMethod === "PICKUP" ? "PICKUP" : "DELIVERED";
}

/** The pricing part of a quote line. */
export type LoadPriceLine = DiscountRuleLine & {
  /** The price billed on the quote. */
  unitPrice: number;
  /** Price before the discount; null when the line has no discount. */
  listPrice: number | null;
  discountPercent: number | null;
  /** The discount was typed on the quote (an awarded price). */
  discountTyped: boolean;
};

export type LoadPrice = {
  unitPrice: number;
  /** Null when the load carries no discount. */
  listPrice: number | null;
  discountPercent: number | null;
  /** The load bills at another price than the quote says. */
  repriced: boolean;
};

function quotedPrice(line: LoadPriceLine): LoadPrice {
  const percent = normalizeDiscountPercent(line.discountPercent);
  const discounted = line.listPrice != null && percent > 0;
  return {
    unitPrice: line.unitPrice,
    listPrice: discounted ? line.listPrice : null,
    discountPercent: discounted ? percent : null,
    repriced: false,
  };
}

/**
 * The price one unit of a quote line bills at on a load.
 *
 * The quoted price stays when:
 * - the load leaves the way the quote was priced;
 * - the discount was typed on the quote (an awarded price holds on every
 *   load, picked up or delivered);
 * - the line's group gives the same discount both ways, or the line is in no
 *   group at all (job structures, services, typed-in lines);
 * - the line carries no discount although its group has one for the way the
 *   quote was priced: it was quoted before discounts, or priced by hand.
 *
 * Otherwise the line's list price takes the standard discount for the way
 * this load leaves.
 */
export function quoteLineLoadPrice(
  line: LoadPriceLine,
  quoteBasis: QuoteDiscountBasis,
  loadBasis: QuoteDiscountBasis,
  standardDiscount: DiscountRuleLookup,
): LoadPrice {
  const quoted = quotedPrice(line);
  if (loadBasis === quoteBasis || line.discountTyped) {
    return quoted;
  }
  const quotePercent = standardDiscount(line, quoteBasis);
  const loadPercent = standardDiscount(line, loadBasis);
  if (quotePercent === loadPercent) {
    return quoted;
  }
  if (line.listPrice == null && quotePercent !== 0) {
    return quoted;
  }
  const listPrice = line.listPrice ?? line.unitPrice;
  const unitPrice = netUnitPrice(listPrice, loadPercent);
  return {
    unitPrice,
    listPrice: loadPercent > 0 ? listPrice : null,
    discountPercent: loadPercent > 0 ? loadPercent : null,
    repriced: Math.abs(unitPrice - line.unitPrice) >= 0.005,
  };
}

/**
 * The price of a product taken straight from the price list (a walk-in sale,
 * or an item added to a job ticket outside the quote): list price less the
 * standard discount for the way the load leaves.
 */
export function catalogLoadPrice(
  listPrice: number,
  productId: string,
  loadBasis: QuoteDiscountBasis,
  standardDiscount: DiscountRuleLookup,
): LoadPrice {
  const percent = standardDiscount({ productId }, loadBasis);
  return {
    unitPrice: netUnitPrice(listPrice, percent),
    listPrice: percent > 0 ? listPrice : null,
    discountPercent: percent > 0 ? percent : null,
    repriced: false,
  };
}
