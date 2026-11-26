import { Decimal, toDecimal, type DecimalInstance, type DecimalLike } from "@/lib/decimal";

/**
 * The company prices off one list price per product and a standard discount
 * per group: stock precast gets one discount when delivered and a bigger one
 * when picked up, imported cast iron gets the same either way, and the rest
 * get none. This file is the one place that says which group a product is in
 * and how a discount turns a list price into the price charged.
 *
 * Safe to import from both server and client modules.
 */

export const DISCOUNT_GROUP_KEYS = [
  "STOCK_PRECAST",
  "CASTING_IMPORTED",
  "CASTING_DOMESTIC",
  "ADS_PIPE",
  "RCP_PIPE",
  "OTHER",
] as const;

export type DiscountGroupKey = (typeof DISCOUNT_GROUP_KEYS)[number];

export const DISCOUNT_GROUP_LABELS: Record<DiscountGroupKey, string> = {
  STOCK_PRECAST: "Stock Precast",
  CASTING_IMPORTED: "Cast Iron, Imported",
  CASTING_DOMESTIC: "Cast Iron, Domestic",
  ADS_PIPE: "ADS Pipe",
  RCP_PIPE: "RCP Pipe",
  OTHER: "Everything Else",
};

export function isDiscountGroupKey(value: unknown): value is DiscountGroupKey {
  return (
    typeof value === "string" &&
    (DISCOUNT_GROUP_KEYS as readonly string[]).includes(value)
  );
}

export type DiscountGroupProduct = {
  productType: string;
  /** The casting supplier's origin; null when the product has no supplier. */
  castingOrigin?: "DOMESTIC" | "IMPORTED" | null;
};

/**
 * The group a product's standard discount comes from. A casting with no
 * supplier lands in OTHER (no discount): the app cannot tell imported from
 * domestic, and giving a discount by mistake costs money.
 */
export function discountGroupForProduct(
  product: DiscountGroupProduct,
): DiscountGroupKey {
  switch (product.productType) {
    case "STOCK_PRECAST":
      return "STOCK_PRECAST";
    case "CASTING":
      if (product.castingOrigin === "IMPORTED") {
        return "CASTING_IMPORTED";
      }
      if (product.castingOrigin === "DOMESTIC") {
        return "CASTING_DOMESTIC";
      }
      return "OTHER";
    case "ADS_PIPE":
      return "ADS_PIPE";
    case "PRECAST_PIPE":
      return "RCP_PIPE";
    default:
      return "OTHER";
  }
}

/** Percentages off list price: 10 means 10%. */
export type DiscountRates = {
  deliveredPercent: number;
  pickupPercent: number;
};

export const NO_DISCOUNT: DiscountRates = { deliveredPercent: 0, pickupPercent: 0 };

export type DiscountRateTable = Record<DiscountGroupKey, DiscountRates>;

/** Every group with no discount: what a database with no rules means. */
export function emptyDiscountRateTable(): DiscountRateTable {
  return {
    STOCK_PRECAST: { ...NO_DISCOUNT },
    CASTING_IMPORTED: { ...NO_DISCOUNT },
    CASTING_DOMESTIC: { ...NO_DISCOUNT },
    ADS_PIPE: { ...NO_DISCOUNT },
    RCP_PIPE: { ...NO_DISCOUNT },
    OTHER: { ...NO_DISCOUNT },
  };
}

export function hasAnyDiscount(rates: DiscountRates): boolean {
  return rates.deliveredPercent > 0 || rates.pickupPercent > 0;
}

/**
 * List price less a percentage, rounded to cents the way every stored price
 * is. The rounded price each is what gets multiplied by the quantity, so a
 * printed line always multiplies out.
 */
export function priceAfterDiscount(
  listPrice: DecimalLike,
  discountPercent: DecimalLike,
): DecimalInstance {
  const percent = toDecimal(discountPercent);
  return toDecimal(listPrice)
    .mul(new Decimal(100).sub(percent))
    .div(100)
    .toDecimalPlaces(2);
}

/** "10", "12.5", "0": a percentage without trailing zeros. */
export function formatDiscountPercent(percent: DecimalLike): string {
  return toDecimal(percent).toDecimalPlaces(2).toString();
}

export type ParsedPercent =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * A percentage as typed: blank means no discount, a trailing % is fine.
 * Returned as a string so it reaches the database without a float in between.
 */
export function parseDiscountPercentInput(raw: string): ParsedPercent {
  const trimmed = raw.trim().replace(/%$/, "").trim();
  if (trimmed === "") {
    return { ok: true, value: "0" };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: "Type a percentage such as 10 or 12.5." };
  }
  const value = new Decimal(trimmed);
  if (value.gt(100)) {
    return { ok: false, error: "A discount cannot be more than 100%." };
  }
  if (!value.toDecimalPlaces(2).equals(value)) {
    return { ok: false, error: "Use at most two decimal places." };
  }
  return { ok: true, value: value.toString() };
}
