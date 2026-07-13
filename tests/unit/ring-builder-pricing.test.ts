import { describe, expect, it } from "vitest";
import {
  formatDrainRingPoolDescription,
  formatFeetAndInches,
} from "@/lib/drain-ring-utils";
import {
  getRingDefaultPricePerFoot,
  parseRingBuilderConfig,
} from "@/lib/ring-builder-settings";

const DELIVERED = "list-delivered";
const PICKUP = "list-pickup";

const config = parseRingBuilderConfig([
  {
    diameterFeet: 10,
    style: "DRAIN",
    otherSubcategories: [],
    defaultPricePerFoot: 185,
    pricePerFootByPriceList: { [DELIVERED]: 205 },
  },
  {
    diameterFeet: 12,
    style: "DRAIN",
    otherSubcategories: [],
    defaultPricePerFoot: 228,
  },
]);

describe("ring builder per-price-list pricing", () => {
  it("uses the price list override when one exists", () => {
    expect(getRingDefaultPricePerFoot(config, 10, "DRAIN", DELIVERED)).toBe(205);
  });

  it("falls back to the base rate for lists without an override", () => {
    expect(getRingDefaultPricePerFoot(config, 10, "DRAIN", PICKUP)).toBe(185);
    expect(getRingDefaultPricePerFoot(config, 12, "DRAIN", DELIVERED)).toBe(228);
  });

  it("falls back to the base rate when no price list is selected", () => {
    expect(getRingDefaultPricePerFoot(config, 10, "DRAIN", null)).toBe(185);
    expect(getRingDefaultPricePerFoot(config, 10, "DRAIN")).toBe(185);
  });

  it("returns zero for unmapped diameter/style combinations", () => {
    expect(getRingDefaultPricePerFoot(config, 8, "DRAIN", DELIVERED)).toBe(0);
  });

  it("honors an explicit zero override", () => {
    const zeroConfig = parseRingBuilderConfig([
      {
        diameterFeet: 10,
        style: "DRAIN",
        otherSubcategories: [],
        defaultPricePerFoot: 185,
        pricePerFootByPriceList: { [DELIVERED]: 0 },
      },
    ]);
    expect(getRingDefaultPricePerFoot(zeroConfig, 10, "DRAIN", DELIVERED)).toBe(
      0,
    );
  });

  it("drops invalid override values and keys during parsing", () => {
    const parsed = parseRingBuilderConfig([
      {
        diameterFeet: 10,
        style: "DRAIN",
        otherSubcategories: [],
        defaultPricePerFoot: 185,
        pricePerFootByPriceList: {
          [DELIVERED]: "not-a-number",
          "": 99,
          [PICKUP]: -5,
          "list-ok": "210.50",
        },
      },
    ]);
    expect(parsed[0]!.pricePerFootByPriceList).toEqual({ "list-ok": 210.5 });
  });

  it("parses legacy configs without the override field", () => {
    const parsed = parseRingBuilderConfig([
      {
        diameterFeet: 10,
        style: "DRAIN",
        otherSubcategories: [],
        defaultPricePerFoot: 185,
      },
    ]);
    expect(parsed[0]!.pricePerFootByPriceList).toEqual({});
  });
});

describe("ring pool line descriptions", () => {
  it("formats drain pools in the diameter-first style", () => {
    expect(
      formatDrainRingPoolDescription({
        poolCount: 2,
        poolHeight: 9,
        diameter: 10,
        style: "DRAIN",
      }),
    ).toBe(`10'Ø Storm Pool - 2 @ 9'-0" Deep`);
  });

  it("labels sanitary pools and fractional depths", () => {
    expect(
      formatDrainRingPoolDescription({
        poolCount: 1,
        poolHeight: 9.5,
        diameter: 12,
        style: "SANITARY",
      }),
    ).toBe(`12'Ø Sanitary Pool - 1 @ 9'-6" Deep`);
  });

  it("converts decimal feet to feet and inches with carry", () => {
    expect(formatFeetAndInches(9)).toBe(`9'-0"`);
    expect(formatFeetAndInches(9.5)).toBe(`9'-6"`);
    expect(formatFeetAndInches(9.99)).toBe(`10'-0"`);
    expect(formatFeetAndInches(8.25)).toBe(`8'-3"`);
  });
});
