import { describe, expect, it } from "vitest";
import {
  calculateQuoteTotals,
  getLineItemTotal,
  getLineNetUnitPrice,
  type EditableQuoteLineItem,
} from "@/components/quotes/quote-utils";
import {
  applyLineFieldChange,
  applyPickupNote,
} from "@/components/quotes/quote-form/line-item-ops";
import { buildQuoteLineItemsInput } from "@/components/quotes/quote-form/quote-form-utils";
import { emptyDiscountRateTable } from "@/lib/pricing/discount-groups";
import {
  PICKUP_NOTE_TEXT,
  createDiscountRuleLookup,
  fobAfterDiscountBasisChange,
  fobForDiscountBasis,
  formatDiscountPercentLabel,
  netUnitPrice,
  normalizeDiscountPercent,
  type QuoteDiscountPricing,
} from "@/lib/pricing/line-discount";
import {
  resolveLineDiscount,
  resolveLineDiscounts,
} from "@/lib/quotes/line-discount-input";

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
    },
  };
}

function line(overrides: Partial<EditableQuoteLineItem>): EditableQuoteLineItem {
  return {
    id: "line-1",
    lineNumber: 1,
    type: "STOCK_PRODUCT",
    typeLabel: "Stock Product",
    item: "R4X8",
    description: "4' x 8' ring",
    qty: "2",
    unit: "EA",
    unitPrice: "1000",
    weight: "",
    yards: "",
    taxable: true,
    ...overrides,
  };
}

describe("the standard discount of a quote line", () => {
  const ruleFor = createDiscountRuleLookup(companyPricing());

  it("gives stock precast 10% delivered and 20% picked up", () => {
    expect(ruleFor({ productId: "ring-4x8" }, "DELIVERED")).toBe(10);
    expect(ruleFor({ productId: "ring-4x8" }, "PICKUP")).toBe(20);
  });

  it("gives imported castings 10% either way", () => {
    expect(ruleFor({ productId: "frame-imported" }, "DELIVERED")).toBe(10);
    expect(ruleFor({ productId: "frame-imported" }, "PICKUP")).toBe(10);
  });

  it("gives no discount to a product of any other group", () => {
    // Domestic castings and pipe are not listed: their groups have no discount.
    expect(ruleFor({ productId: "frame-domestic" }, "DELIVERED")).toBe(0);
    expect(ruleFor({ productId: "ads-12" }, "PICKUP")).toBe(0);
  });

  it("gives no discount to a line with no product: a job structure or service", () => {
    expect(ruleFor({ productId: null }, "DELIVERED")).toBe(0);
    expect(ruleFor({}, "PICKUP")).toBe(0);
  });

  it("treats rings from the ring builder and galley totals as stock precast", () => {
    expect(ruleFor({ productId: null, isDrainRing: true }, "PICKUP")).toBe(20);
    expect(ruleFor({ galleyFamilyCode: "4X8" }, "DELIVERED")).toBe(10);
  });
});

describe("discount percent and net price", () => {
  it("reads typed percentages and ignores junk", () => {
    expect(normalizeDiscountPercent("10")).toBe(10);
    expect(normalizeDiscountPercent(" 12.5% ")).toBe(12.5);
    expect(normalizeDiscountPercent("")).toBe(0);
    expect(normalizeDiscountPercent(undefined)).toBe(0);
    expect(normalizeDiscountPercent("abc")).toBe(0);
    expect(normalizeDiscountPercent(-5)).toBe(0);
    expect(normalizeDiscountPercent(250)).toBe(100);
    expect(normalizeDiscountPercent("7.555")).toBe(7.56);
  });

  it("takes the percentage off the list price, to the cent", () => {
    expect(netUnitPrice(1000, 10)).toBe(900);
    expect(netUnitPrice(1000, 20)).toBe(800);
    expect(netUnitPrice(675, 12.5)).toBe(590.63);
    expect(netUnitPrice(618.5, 0)).toBe(618.5);
    expect(netUnitPrice(618.5, "")).toBe(618.5);
  });

  it("labels a discount for print and leaves no discount blank", () => {
    expect(formatDiscountPercentLabel(10)).toBe("10%");
    expect(formatDiscountPercentLabel("12.50")).toBe("12.5%");
    expect(formatDiscountPercentLabel(0)).toBe("");
    expect(formatDiscountPercentLabel(null)).toBe("");
  });
});

describe("a quote form line with a discount", () => {
  it("totals at the net price", () => {
    const discounted = line({ discountPercent: "10" });
    expect(getLineNetUnitPrice(discounted)).toBe(900);
    expect(getLineItemTotal(discounted)).toBe(1800);
    expect(getLineItemTotal(line({}))).toBe(2000);
  });

  it("feeds the quote totals with net prices", () => {
    const totals = calculateQuoteTotals(
      [line({ discountPercent: "10" }), line({ id: "line-2", lineNumber: 2 })],
      0,
    );
    expect(totals.subtotal).toBe(3800);
    expect(totals.total).toBe(3800);
  });

  it("never discounts a category, note or page break", () => {
    const category = line({ type: "CATEGORY", discountPercent: "10" });
    expect(getLineNetUnitPrice(category)).toBe(1000);
    expect(getLineItemTotal(category)).toBe(0);
  });

  it("marks a discount typed on the line as the line's own", () => {
    const typed = applyLineFieldChange(line({}), "discountPercent", "15");
    expect(typed.discountPercent).toBe("15");
    expect(typed.discountTyped).toBe(true);
  });

  it("keeps a discount typed down to 0 as the line's own", () => {
    const typed = applyLineFieldChange(line({}), "discountPercent", "0");
    expect(typed.discountPercent).toBe("0");
    expect(typed.discountTyped).toBe(true);
  });

  it("hands the line back to the standard discount when the box is cleared", () => {
    const typed = line({ discountPercent: "15", discountTyped: true });
    const cleared = applyLineFieldChange(typed, "discountPercent", "  ");
    expect(cleared.discountPercent).toBeUndefined();
    expect(cleared.discountTyped).toBe(false);
  });

  it("leaves the discount alone when another cell is edited", () => {
    const typed = line({ discountPercent: "15", discountTyped: true });
    const edited = applyLineFieldChange(typed, "qty", "5");
    expect(edited.qty).toBe("5");
    expect(edited.discountPercent).toBe("15");
    expect(edited.discountTyped).toBe(true);
  });

  it("saves the net price as the unit price beside the list price", () => {
    const [saved] = buildQuoteLineItemsInput([
      line({ discountPercent: "10", discountTyped: false }),
    ]);
    expect(saved.unitPrice).toBe(900);
    expect(saved.listPrice).toBe(1000);
    expect(saved.discountPercent).toBe(10);
    expect(saved.discountTyped).toBe(false);
    expect(saved.total).toBe(1800);
  });
});

describe("what the server stores for a line", () => {
  it("works the billed price out again from list price and percent", () => {
    // A browser that sends a billed price not matching its own discount.
    const resolved = resolveLineDiscount({
      lineType: "STOCK_PRODUCT",
      unitPrice: 1,
      listPrice: 1000,
      discountPercent: 10,
    });
    expect(resolved).toEqual({
      unitPrice: 900,
      listPrice: 1000,
      discountPercent: 10,
      discountTyped: false,
    });
  });

  it("stores no list price on a line with no discount", () => {
    const resolved = resolveLineDiscount({
      lineType: "STOCK_PRODUCT",
      unitPrice: 1000,
      listPrice: 1000,
      discountPercent: 0,
    });
    expect(resolved).toEqual({
      unitPrice: 1000,
      listPrice: null,
      discountPercent: null,
      discountTyped: false,
    });
  });

  it("keeps a typed 0% so the standard discount stays off the line", () => {
    const resolved = resolveLineDiscount({
      lineType: "STOCK_PRODUCT",
      unitPrice: 1000,
      listPrice: 1000,
      discountPercent: 0,
      discountTyped: true,
    });
    expect(resolved).toEqual({
      unitPrice: 1000,
      listPrice: 1000,
      discountPercent: 0,
      discountTyped: true,
    });
  });

  it("leaves a caller that knows no discounts exactly as it was", () => {
    // Import Existing Job and the like send a unit price and nothing else.
    const resolved = resolveLineDiscount({
      lineType: "CUSTOM_STRUCTURE",
      unitPrice: 4250,
    });
    expect(resolved).toEqual({
      unitPrice: 4250,
      listPrice: null,
      discountPercent: null,
      discountTyped: false,
    });
  });

  it("stores no discount on a category line", () => {
    const [resolved] = resolveLineDiscounts([
      {
        lineType: "CATEGORY",
        unitPrice: 0,
        listPrice: 0,
        discountPercent: 10,
        discountTyped: true,
        description: "Drainage",
      },
    ]);
    expect(resolved.listPrice).toBeNull();
    expect(resolved.discountPercent).toBeNull();
    expect(resolved.discountTyped).toBe(false);
    expect(resolved.description).toBe("Drainage");
  });
});

describe("F.O.B. follows Delivered / Picked Up", () => {
  it("starts a delivered quote at Jobsite and a pickup quote at Our Yard", () => {
    expect(fobForDiscountBasis("DELIVERED")).toBe("Jobsite");
    expect(fobForDiscountBasis("PICKUP")).toBe("Our Yard");
  });

  it("lets a price list name its own delivered F.O.B.", () => {
    expect(fobForDiscountBasis("DELIVERED", " Delivered to site ")).toBe(
      "Delivered to site",
    );
    expect(fobForDiscountBasis("DELIVERED", "  ")).toBe("Jobsite");
    expect(fobForDiscountBasis("PICKUP", "Delivered to site")).toBe("Our Yard");
  });

  it("switches a standard wording with the basis, both ways", () => {
    expect(fobAfterDiscountBasisChange("Jobsite", "PICKUP")).toBe("Our Yard");
    expect(fobAfterDiscountBasisChange("Our Yard", "DELIVERED")).toBe("Jobsite");
    expect(fobAfterDiscountBasisChange("", "PICKUP")).toBe("Our Yard");
    // Older quotes started at "Factory".
    expect(fobAfterDiscountBasisChange("Factory", "PICKUP")).toBe("Our Yard");
    expect(fobAfterDiscountBasisChange("factory ", "DELIVERED")).toBe("Jobsite");
    expect(
      fobAfterDiscountBasisChange("Delivered to site", "PICKUP", "Delivered to site"),
    ).toBe("Our Yard");
    expect(
      fobAfterDiscountBasisChange("Our Yard", "DELIVERED", "Delivered to site"),
    ).toBe("Delivered to site");
  });

  it("leaves an F.O.B. the estimator typed alone", () => {
    expect(fobAfterDiscountBasisChange("Rail siding, Yaphank", "PICKUP")).toBe(
      "Rail siding, Yaphank",
    );
  });
});

describe("the pickup note line", () => {
  it("is added as the first line when the quote switches to Picked Up", () => {
    const next = applyPickupNote([line({}), line({ id: "line-2" })], "PICKUP");
    expect(next).toHaveLength(3);
    expect(next[0]).toMatchObject({
      type: "NOTE",
      description: PICKUP_NOTE_TEXT,
      lineNumber: 1,
    });
    expect(next.map((entry) => entry.lineNumber)).toEqual([1, 2, 3]);
    expect(next[1].id).toBe("line-1");
  });

  it("is not added twice", () => {
    const once = applyPickupNote([line({})], "PICKUP");
    expect(applyPickupNote(once, "PICKUP")).toBe(once);
  });

  it("comes off again when the quote switches back to Delivered", () => {
    const withNote = applyPickupNote([line({})], "PICKUP");
    const back = applyPickupNote(withNote, "DELIVERED");
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ id: "line-1", lineNumber: 1 });
  });

  it("keeps a note the estimator reworded, and their other notes", () => {
    const reworded = line({
      id: "note-1",
      type: "NOTE",
      description: "Price is for material picked up at our Brookhaven yard",
    });
    const other = line({ id: "note-2", type: "NOTE", description: "Castings by others" });
    const lines = [reworded, other, line({})];
    expect(applyPickupNote(lines, "DELIVERED")).toBe(lines);
  });
});
