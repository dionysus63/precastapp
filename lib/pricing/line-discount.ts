import { Decimal } from "@/lib/decimal";
import {
  DISCOUNT_GROUP_KEYS,
  emptyDiscountRateTable,
  priceAfterDiscount,
  type DiscountGroupKey,
  type DiscountRateTable,
} from "@/lib/pricing/discount-groups";

/**
 * Discounts on a quote line. A line carries a list price and a percentage
 * off; what is billed (and stored as the line's unit price) is the list price
 * less that percentage. The percentage starts as the standard discount of the
 * product's group and can be typed over on any line.
 *
 * Safe to import from both server and client modules.
 */

export const QUOTE_DISCOUNT_BASES = ["DELIVERED", "PICKUP"] as const;
export type QuoteDiscountBasis = (typeof QUOTE_DISCOUNT_BASES)[number];

export const QUOTE_DISCOUNT_BASIS_LABELS: Record<QuoteDiscountBasis, string> = {
  DELIVERED: "Delivered",
  PICKUP: "Picked Up",
};

/** F.O.B. of a quote priced delivered, unless its price list names another. */
export const DELIVERED_FOB = "Jobsite";
/** F.O.B. of a quote priced for pickup. */
export const PICKUP_FOB = "Our Yard";
/** The note line a quote priced for pickup carries. */
export const PICKUP_NOTE_TEXT = "Price is for material picked up";

/**
 * The F.O.B. a quote starts with: "Our Yard" when priced for pickup,
 * otherwise the price list's own wording, or "Jobsite" when it has none.
 */
export function fobForDiscountBasis(
  basis: QuoteDiscountBasis,
  priceListFob?: string | null,
): string {
  return basis === "PICKUP" ? PICKUP_FOB : priceListFob?.trim() || DELIVERED_FOB;
}

/**
 * The F.O.B. after the quote switches between delivered and picked up. A
 * standard wording (or a blank) follows the switch; anything the estimator
 * typed themselves is left alone.
 */
export function fobAfterDiscountBasisChange(
  currentFob: string,
  nextBasis: QuoteDiscountBasis,
  priceListFob?: string | null,
): string {
  const standard = [
    "",
    // What quotes started with before F.O.B. followed the basis.
    "factory",
    DELIVERED_FOB,
    PICKUP_FOB,
    priceListFob ?? "",
  ].map((wording) => wording.trim().toLowerCase());
  return standard.includes(currentFob.trim().toLowerCase())
    ? fobForDiscountBasis(nextBasis, priceListFob)
    : currentFob;
}

export function isQuoteDiscountBasis(value: unknown): value is QuoteDiscountBasis {
  return (
    typeof value === "string" &&
    (QUOTE_DISCOUNT_BASES as readonly string[]).includes(value)
  );
}

/** What the quote form needs to fill in a line's standard discount. */
export type QuoteDiscountPricing = {
  rates: DiscountRateTable;
  /**
   * The products of each group that has a discount. A product listed nowhere
   * gets none, so groups without a discount are left out to keep this small.
   */
  productIdsByGroup: Partial<Record<DiscountGroupKey, string[]>>;
};

/** No standard discounts at all: every line starts at list price. */
export function emptyQuoteDiscountPricing(): QuoteDiscountPricing {
  return { rates: emptyDiscountRateTable(), productIdsByGroup: {} };
}

/** The part of a quote line that decides its standard discount. */
export type DiscountRuleLine = {
  productId?: string | null;
  /** A galley family total: stock precast, split into products on award. */
  galleyFamilyCode?: string | null;
  /** A ring priced by the ring builder: stock precast with no product row. */
  isDrainRing?: boolean;
};

export type DiscountRuleLookup = (
  line: DiscountRuleLine,
  basis: QuoteDiscountBasis,
) => number;

/**
 * The standard discount for a line, in percent. Lines with no product behind
 * them (job structures, services, typed-in lines) get none; a discount on
 * those is typed on the line.
 */
export function createDiscountRuleLookup(
  pricing: QuoteDiscountPricing,
): DiscountRuleLookup {
  const groupByProductId = new Map<string, DiscountGroupKey>();
  for (const group of DISCOUNT_GROUP_KEYS) {
    for (const productId of pricing.productIdsByGroup[group] ?? []) {
      groupByProductId.set(productId, group);
    }
  }
  return (line, basis) => {
    const group = line.productId
      ? groupByProductId.get(line.productId)
      : line.galleyFamilyCode || line.isDrainRing
        ? "STOCK_PRECAST"
        : undefined;
    if (!group) {
      return 0;
    }
    const rates = pricing.rates[group];
    return basis === "PICKUP" ? rates.pickupPercent : rates.deliveredPercent;
  };
}

/**
 * A discount percentage as a clean number: blank, junk and negatives are no
 * discount, anything over 100 is 100, and at most two decimals are kept.
 */
export function normalizeDiscountPercent(
  value: number | string | null | undefined,
): number {
  if (value == null || value === "") {
    return 0;
  }
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(value.replace(/%/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return new Decimal(Math.min(parsed, 100)).toDecimalPlaces(2).toNumber();
}

/** List price less the discount, to the cent: the price the line bills at. */
export function netUnitPrice(
  listPrice: number,
  discountPercent: number | string | null | undefined,
): number {
  const percent = normalizeDiscountPercent(discountPercent);
  if (percent === 0 || !Number.isFinite(listPrice)) {
    return listPrice;
  }
  return priceAfterDiscount(listPrice, percent).toNumber();
}

/** "10%", "12.5%"; blank for no discount. */
export function formatDiscountPercentLabel(
  discountPercent: number | string | null | undefined,
): string {
  const percent = normalizeDiscountPercent(discountPercent);
  return percent > 0 ? `${percent}%` : "";
}
