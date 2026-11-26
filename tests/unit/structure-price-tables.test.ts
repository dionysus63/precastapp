import { describe, expect, it } from "vitest";
import {
  parseFeetInput,
  resolveStructurePriceRow,
  rowHasOwnPrices,
  splitPastedBlock,
} from "@/lib/pricing/structure-price-tables";
import {
  copyRingPricesBetweenPriceLists,
  getRingDefaultPricePerFoot,
  parseRingBuilderConfig,
  setRingPriceForPriceList,
} from "@/lib/ring-builder-settings";

const NO_PRICES = { wallPricePerFoot: null, basePrice: null };

describe("what a mold row is saved as", () => {
  it("saves the prices typed", () => {
    expect(
      resolveStructurePriceRow(
        "molds",
        { wallPricePerFoot: "$185", basePrice: "1,620.5" },
        { values: NO_PRICES, inherited: null, disabledColumns: [] },
      ),
    ).toEqual({
      ok: true,
      prices: { wallPricePerFoot: "185.00", basePrice: "1620.50" },
      shared: {},
    });
  });

  it("takes the row off the list when every price is blank", () => {
    expect(
      resolveStructurePriceRow(
        "molds",
        { wallPricePerFoot: " ", basePrice: "" },
        {
          values: { wallPricePerFoot: "185.00", basePrice: "620.00" },
          inherited: null,
          disabledColumns: [],
        },
      ),
    ).toEqual({ ok: true, prices: null, shared: {} });
  });

  it("fills a blank price from the default list when the list had none of its own", () => {
    // Typing a wall price on a list that was following the default list
    // must not quietly make the base free.
    expect(
      resolveStructurePriceRow(
        "molds",
        { wallPricePerFoot: "200", basePrice: "" },
        {
          values: NO_PRICES,
          inherited: { wallPricePerFoot: "185.00", basePrice: "620.00" },
          disabledColumns: [],
        },
      ),
    ).toMatchObject({ prices: { wallPricePerFoot: "200.00", basePrice: "620.00" } });
  });

  it("makes a price cleared on the list's own row zero", () => {
    expect(
      resolveStructurePriceRow(
        "molds",
        { wallPricePerFoot: "200", basePrice: "" },
        {
          values: { wallPricePerFoot: "200.00", basePrice: "640.00" },
          inherited: { wallPricePerFoot: "185.00", basePrice: "620.00" },
          disabledColumns: [],
        },
      ),
    ).toMatchObject({ prices: { wallPricePerFoot: "200.00", basePrice: "0.00" } });
  });

  it("is zero for a blank price with nothing to fall back on", () => {
    expect(
      resolveStructurePriceRow(
        "molds",
        { wallPricePerFoot: "200" },
        { values: NO_PRICES, inherited: null, disabledColumns: [] },
      ),
    ).toMatchObject({ prices: { wallPricePerFoot: "200.00", basePrice: "0.00" } });
  });

  it("names the column of a price it cannot read", () => {
    expect(
      resolveStructurePriceRow(
        "molds",
        { wallPricePerFoot: "200", basePrice: "six" },
        { values: NO_PRICES, inherited: null, disabledColumns: [] },
      ),
    ).toEqual({ ok: false, error: "Base Price: Type a price such as 1450 or 618.50." });
  });
});

describe("what a rectangular template row is saved as", () => {
  const template = {
    values: {
      wallPricePerFoot: null,
      topSlabPrice: null,
      baseSlabPrice: null,
      minPricingHeightFeet: null,
    },
    inherited: null,
    disabledColumns: ["topSlabPrice"],
  };

  it("keeps the minimum feet billed apart from the list's prices", () => {
    expect(
      resolveStructurePriceRow(
        "rectTemplates",
        { wallPricePerFoot: "165", minPricingHeightFeet: "4", baseSlabPrice: "690" },
        template,
      ),
    ).toEqual({
      ok: true,
      prices: { wallPricePerFoot: "165.00", topSlabPrice: "0.00", baseSlabPrice: "690.00" },
      shared: { minPricingHeightFeet: "4.00" },
    });
  });

  it("saves a minimum on a row with no prices on the list", () => {
    expect(
      resolveStructurePriceRow("rectTemplates", { minPricingHeightFeet: "2.5" }, template),
    ).toEqual({ ok: true, prices: null, shared: { minPricingHeightFeet: "2.50" } });
  });

  it("never prices a slab the template does not have", () => {
    const withInherited = {
      ...template,
      inherited: { wallPricePerFoot: "150.00", topSlabPrice: "400.00", baseSlabPrice: "600.00" },
    };
    expect(
      resolveStructurePriceRow(
        "rectTemplates",
        { wallPricePerFoot: "165", topSlabPrice: "999" },
        withInherited,
      ),
    ).toMatchObject({
      prices: { wallPricePerFoot: "165.00", topSlabPrice: "0.00", baseSlabPrice: "600.00" },
    });
  });
});

describe("telling a list's own row from one it falls back on", () => {
  it("looks at the prices, not at the numbers kept on the row", () => {
    expect(
      rowHasOwnPrices("rectTemplates", {
        values: {
          wallPricePerFoot: null,
          topSlabPrice: null,
          baseSlabPrice: null,
          minPricingHeightFeet: "4.00",
        },
      }),
    ).toBe(false);
    expect(rowHasOwnPrices("boots", { values: { pricePerBoot: "0.00" } })).toBe(true);
  });
});

describe("reading feet", () => {
  it("reads a plain number, with or without a foot mark", () => {
    expect(parseFeetInput("4")).toEqual({ ok: true, value: "4.00" });
    expect(parseFeetInput(" 2.5' ")).toEqual({ ok: true, value: "2.50" });
    expect(parseFeetInput("")).toEqual({ ok: true, value: null });
  });

  it("turns down what is not a number of feet", () => {
    expect(parseFeetInput("four").ok).toBe(false);
    expect(parseFeetInput("-2").ok).toBe(false);
    expect(parseFeetInput("2.125").ok).toBe(false);
    expect(parseFeetInput("10000").ok).toBe(false);
  });
});

describe("reading cells copied from Excel", () => {
  it("splits rows and columns and drops the trailing line break", () => {
    expect(splitPastedBlock("185\t620\r\n240\t810\r\n")).toEqual([
      ["185", "620"],
      ["240", "810"],
    ]);
  });

  it("keeps blank cells so the others stay lined up", () => {
    expect(splitPastedBlock("185\t\n\n\"1,040.00\"\t810")).toEqual([
      ["185", ""],
      [""],
      ["1,040.00", "810"],
    ]);
  });
});

describe("ring prices per price list", () => {
  const config = parseRingBuilderConfig([
    {
      diameterFeet: 10,
      style: "DRAIN",
      otherSubcategories: ["Covers"],
      defaultPricePerFoot: 185,
      pricePerFootByPriceList: { "list-2026": 205 },
    },
  ]);

  it("sets a ring's price on one list and leaves the rest alone", () => {
    const next = setRingPriceForPriceList(config, 10, "DRAIN", "list-2027", 215);
    expect(getRingDefaultPricePerFoot(next, 10, "DRAIN", "list-2027")).toBe(215);
    expect(getRingDefaultPricePerFoot(next, 10, "DRAIN", "list-2026")).toBe(205);
    expect(next[0].otherSubcategories).toEqual(["Covers"]);
    expect(next[0].defaultPricePerFoot).toBe(185);
  });

  it("puts a ring back on its standard price", () => {
    const next = setRingPriceForPriceList(config, 10, "DRAIN", "list-2026", null);
    expect(getRingDefaultPricePerFoot(next, 10, "DRAIN", "list-2026")).toBe(185);
  });

  it("adds a ring that was never set up", () => {
    const next = setRingPriceForPriceList(config, 12, "SANITARY", "list-2026", 260);
    expect(getRingDefaultPricePerFoot(next, 12, "SANITARY", "list-2026")).toBe(260);
    expect(getRingDefaultPricePerFoot(next, 12, "SANITARY", "another")).toBe(0);
    expect(setRingPriceForPriceList(config, 12, "SANITARY", "list-2026", null)).toBe(config);
  });

  it("copies a list's ring prices onto a copied list", () => {
    const next = copyRingPricesBetweenPriceLists(config, "list-2026", "list-2027");
    expect(getRingDefaultPricePerFoot(next, 10, "DRAIN", "list-2027")).toBe(205);
    // A list with no ring prices of its own copies nothing.
    expect(copyRingPricesBetweenPriceLists(config, "list-old", "list-2027")).toEqual(config);
  });
});
