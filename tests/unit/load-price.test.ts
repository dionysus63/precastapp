import { describe, expect, it } from "vitest";
import { emptyDiscountRateTable } from "@/lib/pricing/discount-groups";
import {
  createDiscountRuleLookup,
  type QuoteDiscountPricing,
} from "@/lib/pricing/line-discount";
import {
  catalogLoadPrice,
  loadBasisForFulfillment,
  quoteLineLoadPrice,
  type LoadPriceLine,
} from "@/lib/pricing/load-price";

/** The company's rules: stock precast 10 / 20, imported castings 10 / 10. */
function companyPricing(): QuoteDiscountPricing {
  const rates = emptyDiscountRateTable();
  rates.STOCK_PRECAST = { deliveredPercent: 10, pickupPercent: 20 };
  rates.CASTING_IMPORTED = { deliveredPercent: 10, pickupPercent: 10 };
  return {
    rates,
    productIdsByGroup: {
      STOCK_PRECAST: ["ring-4x8"],
      CASTING_IMPORTED: ["frame-imported"],
      CASTING_DOMESTIC: ["frame-domestic"],
    },
  };
}

const standard = createDiscountRuleLookup(companyPricing());

/** A stock precast line quoted delivered: $1,000 list, 10% off. */
function ringLine(overrides: Partial<LoadPriceLine> = {}): LoadPriceLine {
  return {
    productId: "ring-4x8",
    unitPrice: 900,
    listPrice: 1000,
    discountPercent: 10,
    discountTyped: false,
    ...overrides,
  };
}

describe("how a ticket's load leaves", () => {
  it("is picked up only on a pickup ticket", () => {
    expect(loadBasisForFulfillment("PICKUP")).toBe("PICKUP");
    expect(loadBasisForFulfillment("DELIVERY")).toBe("DELIVERED");
    expect(loadBasisForFulfillment(null)).toBe("DELIVERED");
  });
});

describe("what a quote line bills at on a load", () => {
  it("bills the quoted price when the load leaves the way it was quoted", () => {
    expect(quoteLineLoadPrice(ringLine(), "DELIVERED", "DELIVERED", standard)).toEqual({
      unitPrice: 900,
      listPrice: 1000,
      discountPercent: 10,
      repriced: false,
    });
  });

  it("takes the pickup discount when a delivered quote is picked up", () => {
    expect(quoteLineLoadPrice(ringLine(), "DELIVERED", "PICKUP", standard)).toEqual({
      unitPrice: 800,
      listPrice: 1000,
      discountPercent: 20,
      repriced: true,
    });
  });

  it("takes the delivered discount when a pickup quote is delivered", () => {
    const quotedForPickup = ringLine({ unitPrice: 800, discountPercent: 20 });
    expect(
      quoteLineLoadPrice(quotedForPickup, "PICKUP", "DELIVERED", standard),
    ).toEqual({
      unitPrice: 900,
      listPrice: 1000,
      discountPercent: 10,
      repriced: true,
    });
  });

  it("keeps an awarded price on every load", () => {
    const awarded = ringLine({
      unitPrice: 850,
      discountPercent: 15,
      discountTyped: true,
    });
    for (const loadBasis of ["DELIVERED", "PICKUP"] as const) {
      expect(quoteLineLoadPrice(awarded, "DELIVERED", loadBasis, standard)).toEqual({
        unitPrice: 850,
        listPrice: 1000,
        discountPercent: 15,
        repriced: false,
      });
    }
  });

  it("keeps a discount typed down to nothing", () => {
    const noDiscount = ringLine({
      unitPrice: 1000,
      discountPercent: 0,
      discountTyped: true,
    });
    expect(quoteLineLoadPrice(noDiscount, "DELIVERED", "PICKUP", standard)).toEqual({
      unitPrice: 1000,
      listPrice: null,
      discountPercent: null,
      repriced: false,
    });
  });

  it("keeps the price when the group discounts the same both ways", () => {
    const frame = ringLine({ productId: "frame-imported" });
    expect(quoteLineLoadPrice(frame, "DELIVERED", "PICKUP", standard)).toMatchObject({
      unitPrice: 900,
      discountPercent: 10,
      repriced: false,
    });
  });

  it("keeps the price of a line with no product behind it", () => {
    const structure: LoadPriceLine = {
      productId: null,
      unitPrice: 2380,
      listPrice: null,
      discountPercent: null,
      discountTyped: false,
    };
    expect(quoteLineLoadPrice(structure, "DELIVERED", "PICKUP", standard)).toEqual({
      unitPrice: 2380,
      listPrice: null,
      discountPercent: null,
      repriced: false,
    });
  });

  it("keeps the price of a line quoted before discounts", () => {
    // Stock precast with no discount on the line, although the group has
    // one for a delivered quote: the price was set by hand or before the
    // rules existed, so nothing is taken off it for a pickup.
    const old = ringLine({ unitPrice: 362, listPrice: null, discountPercent: null });
    expect(quoteLineLoadPrice(old, "DELIVERED", "PICKUP", standard)).toEqual({
      unitPrice: 362,
      listPrice: null,
      discountPercent: null,
      repriced: false,
    });
  });

  it("discounts a line that had no discount the way it was quoted", () => {
    const rates = emptyDiscountRateTable();
    rates.RCP_PIPE = { deliveredPercent: 0, pickupPercent: 5 };
    const pipeRule = createDiscountRuleLookup({
      rates,
      productIdsByGroup: { RCP_PIPE: ["rcp-18"] },
    });
    const pipe: LoadPriceLine = {
      productId: "rcp-18",
      unitPrice: 200,
      listPrice: null,
      discountPercent: null,
      discountTyped: false,
    };
    expect(quoteLineLoadPrice(pipe, "DELIVERED", "PICKUP", pipeRule)).toEqual({
      unitPrice: 190,
      listPrice: 200,
      discountPercent: 5,
      repriced: true,
    });
    // And back to list price when a pickup quote of it is delivered.
    const quotedForPickup = { ...pipe, unitPrice: 190, listPrice: 200, discountPercent: 5 };
    expect(
      quoteLineLoadPrice(quotedForPickup, "PICKUP", "DELIVERED", pipeRule),
    ).toEqual({
      unitPrice: 200,
      listPrice: null,
      discountPercent: null,
      repriced: true,
    });
  });

  it("counts a ring builder line as stock precast", () => {
    const perFoot: LoadPriceLine = {
      productId: null,
      isDrainRing: true,
      unitPrice: 90,
      listPrice: 100,
      discountPercent: 10,
      discountTyped: false,
    };
    expect(quoteLineLoadPrice(perFoot, "DELIVERED", "PICKUP", standard)).toMatchObject({
      unitPrice: 80,
      discountPercent: 20,
    });
  });
});

describe("what a product off the price list bills at", () => {
  it("takes the pickup discount at the counter", () => {
    expect(catalogLoadPrice(1450, "ring-4x8", "PICKUP", standard)).toEqual({
      unitPrice: 1160,
      listPrice: 1450,
      discountPercent: 20,
      repriced: false,
    });
  });

  it("takes the delivered discount on a delivered load", () => {
    expect(catalogLoadPrice(1450, "ring-4x8", "DELIVERED", standard)).toMatchObject({
      unitPrice: 1305,
      discountPercent: 10,
    });
  });

  it("is the list price for a group with no discount", () => {
    expect(catalogLoadPrice(512, "frame-domestic", "PICKUP", standard)).toEqual({
      unitPrice: 512,
      listPrice: null,
      discountPercent: null,
      repriced: false,
    });
  });
});
