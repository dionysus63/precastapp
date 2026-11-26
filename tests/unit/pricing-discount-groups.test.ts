import { describe, expect, it } from "vitest";
import {
  DISCOUNT_GROUP_KEYS,
  discountGroupForProduct,
  emptyDiscountRateTable,
  formatDiscountPercent,
  hasAnyDiscount,
  parseDiscountPercentInput,
  priceAfterDiscount,
} from "@/lib/pricing/discount-groups";

describe("discountGroupForProduct", () => {
  it("puts each product type in the group its discount comes from", () => {
    expect(discountGroupForProduct({ productType: "STOCK_PRECAST" })).toBe("STOCK_PRECAST");
    expect(discountGroupForProduct({ productType: "ADS_PIPE" })).toBe("ADS_PIPE");
    expect(discountGroupForProduct({ productType: "PRECAST_PIPE" })).toBe("RCP_PIPE");
    expect(discountGroupForProduct({ productType: "ACCESSORY" })).toBe("OTHER");
    expect(discountGroupForProduct({ productType: "CONFIGURABLE" })).toBe("OTHER");
    expect(discountGroupForProduct({ productType: "SERVICE" })).toBe("OTHER");
  });

  it("splits castings by where the supplier is", () => {
    expect(
      discountGroupForProduct({ productType: "CASTING", castingOrigin: "IMPORTED" }),
    ).toBe("CASTING_IMPORTED");
    expect(
      discountGroupForProduct({ productType: "CASTING", castingOrigin: "DOMESTIC" }),
    ).toBe("CASTING_DOMESTIC");
  });

  it("gives a casting with no supplier no discount group of its own", () => {
    expect(discountGroupForProduct({ productType: "CASTING", castingOrigin: null })).toBe("OTHER");
    expect(discountGroupForProduct({ productType: "CASTING" })).toBe("OTHER");
  });

  it("ignores a supplier origin on something that is not a casting", () => {
    expect(
      discountGroupForProduct({ productType: "STOCK_PRECAST", castingOrigin: "IMPORTED" }),
    ).toBe("STOCK_PRECAST");
  });
});

describe("priceAfterDiscount", () => {
  it("takes the percentage off the list price", () => {
    expect(priceAfterDiscount("1450.00", 10).toFixed(2)).toBe("1305.00");
    expect(priceAfterDiscount("1450.00", 20).toFixed(2)).toBe("1160.00");
    expect(priceAfterDiscount(618, 10).toFixed(2)).toBe("556.20");
  });

  it("rounds to the cent, half up", () => {
    // 14.25 less 12.5% = 12.46875
    expect(priceAfterDiscount("14.25", "12.5").toFixed(2)).toBe("12.47");
    // 0.25 less 10% = 0.225
    expect(priceAfterDiscount("0.25", 10).toFixed(2)).toBe("0.23");
  });

  it("leaves the price alone with no discount and zeroes it at 100%", () => {
    expect(priceAfterDiscount("38.50", 0).toFixed(2)).toBe("38.50");
    expect(priceAfterDiscount("38.50", 100).toFixed(2)).toBe("0.00");
  });

  it("does no float math", () => {
    // 1.1 * 0.9 is 0.9900000000000001 in floats.
    expect(priceAfterDiscount("1.10", 10).toString()).toBe("0.99");
  });
});

describe("parseDiscountPercentInput", () => {
  it("reads a percentage with or without the sign", () => {
    expect(parseDiscountPercentInput("10")).toEqual({ ok: true, value: "10" });
    expect(parseDiscountPercentInput(" 12.5 % ")).toEqual({ ok: true, value: "12.5" });
    expect(parseDiscountPercentInput("20.00")).toEqual({ ok: true, value: "20" });
  });

  it("reads blank as no discount", () => {
    expect(parseDiscountPercentInput("")).toEqual({ ok: true, value: "0" });
    expect(parseDiscountPercentInput("  ")).toEqual({ ok: true, value: "0" });
  });

  it("refuses what is not a percentage between 0 and 100", () => {
    expect(parseDiscountPercentInput("ten").ok).toBe(false);
    expect(parseDiscountPercentInput("-5").ok).toBe(false);
    expect(parseDiscountPercentInput("101").ok).toBe(false);
    expect(parseDiscountPercentInput("12.345").ok).toBe(false);
    expect(parseDiscountPercentInput("1e2").ok).toBe(false);
  });
});

describe("discount table helpers", () => {
  it("starts every group with no discount", () => {
    const table = emptyDiscountRateTable();
    expect(Object.keys(table).sort()).toEqual([...DISCOUNT_GROUP_KEYS].sort());
    for (const group of DISCOUNT_GROUP_KEYS) {
      expect(hasAnyDiscount(table[group])).toBe(false);
    }
  });

  it("gives each group its own rates to change", () => {
    const table = emptyDiscountRateTable();
    table.STOCK_PRECAST.deliveredPercent = 10;
    expect(table.OTHER.deliveredPercent).toBe(0);
  });

  it("counts a discount on either side", () => {
    expect(hasAnyDiscount({ deliveredPercent: 0, pickupPercent: 20 })).toBe(true);
    expect(hasAnyDiscount({ deliveredPercent: 10, pickupPercent: 0 })).toBe(true);
  });

  it("prints a percentage without trailing zeros", () => {
    expect(formatDiscountPercent("10.00")).toBe("10");
    expect(formatDiscountPercent(12.5)).toBe("12.5");
    expect(formatDiscountPercent(0)).toBe("0");
  });
});
