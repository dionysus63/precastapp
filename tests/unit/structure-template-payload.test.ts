import { describe, expect, it } from "vitest";
import {
  assertSizeAndSlabsUnchangedForSheets,
  parseTemplateData,
  templateHasSlab,
} from "@/lib/structure-template-payload";

const BASE = {
  name: "Test Rect",
  shape: "RECTANGULAR",
  wallThicknessInches: "8",
  baseSlabThicknessInches: "8",
  topSlabThicknessInches: "8",
  minimumBrickInches: "0",
  openingToJointMinTopInches: "0",
  openingToJointMinBottomInches: "0",
};

describe("parseTemplateData rect sizes", () => {
  it("takes whole-inch footprints", () => {
    const payload = parseTemplateData({
      ...BASE,
      rectSizes: [{ insideLengthInches: "55", insideWidthInches: "30" }],
    });
    expect(payload.rectSizes).toEqual([
      { insideLengthInches: 55, insideWidthInches: 30 },
    ]);
  });

  it("converts legacy feet fields (bulk import) at 12 inches per foot", () => {
    const payload = parseTemplateData({
      ...BASE,
      rectSizes: [{ insideLengthFeet: 4.5, insideWidthFeet: 2.5 }],
    });
    expect(payload.rectSizes).toEqual([
      { insideLengthInches: 54, insideWidthInches: 30 },
    ]);
  });

  it("rejects fractional inches", () => {
    expect(() =>
      parseTemplateData({
        ...BASE,
        rectSizes: [{ insideLengthInches: "54.5", insideWidthInches: "30" }],
      }),
    ).toThrow(/whole inches/);
  });

  it("requires exactly one size for rectangular templates", () => {
    expect(() =>
      parseTemplateData({ ...BASE, rectSizes: [] }),
    ).toThrow(/inside length and width/);
    expect(() =>
      parseTemplateData({
        ...BASE,
        rectSizes: [
          { insideLengthInches: "48", insideWidthInches: "48" },
          { insideLengthInches: "60", insideWidthInches: "48" },
        ],
      }),
    ).toThrow(/exactly one inside size/);
  });
});

const RECT = {
  ...BASE,
  rectSizes: [{ insideLengthInches: "72", insideWidthInches: "48" }],
};

describe("parseTemplateData rect slab checkboxes", () => {
  it("stores an unchecked slab as thickness 0, whatever was typed", () => {
    const payload = parseTemplateData({
      ...RECT,
      hasTopSlab: true,
      hasBaseSlab: false,
      baseSlabThicknessInches: "8",
    });
    expect(payload.topSlabThicknessInches).toBe(8);
    expect(payload.baseSlabThicknessInches).toBe(0);
    expect(templateHasSlab(payload.topSlabThicknessInches)).toBe(true);
    expect(templateHasSlab(payload.baseSlabThicknessInches)).toBe(false);
  });

  it("needs a thickness for a checked slab", () => {
    expect(() =>
      parseTemplateData({ ...RECT, hasTopSlab: true, topSlabThicknessInches: "0" }),
    ).toThrow(/top slab thickness, or uncheck Top slab/i);
    expect(() =>
      parseTemplateData({ ...RECT, hasBaseSlab: true, baseSlabThicknessInches: "" }),
    ).toThrow(/base slab thickness, or uncheck Base slab/i);
  });

  it("still reads thickness 0 as no slab when no checkbox is sent (import)", () => {
    const payload = parseTemplateData({ ...RECT, topSlabThicknessInches: "0" });
    expect(payload.topSlabThicknessInches).toBe(0);
  });
});

const ROUND = {
  ...BASE,
  name: "Test Round",
  shape: "CIRCULAR",
};

describe("parseTemplateData round templates: one mold", () => {
  it("takes exactly one diameter", () => {
    const payload = parseTemplateData({
      ...ROUND,
      diameters: [{ insideDiameterFeet: "4" }],
    });
    expect(payload.diameters).toEqual([
      expect.objectContaining({ insideDiameterFeet: 4 }),
    ]);
  });

  it("rejects none and more than one", () => {
    expect(() => parseTemplateData({ ...ROUND, diameters: [] })).toThrow(
      /Pick the template's mold/,
    );
    expect(() =>
      parseTemplateData({
        ...ROUND,
        diameters: [{ insideDiameterFeet: "4" }, { insideDiameterFeet: "5" }],
      }),
    ).toThrow(/exactly one mold/);
  });
});

describe("size and slabs are locked while drill sheets use the template", () => {
  const roundPayload = (feet: string) =>
    parseTemplateData({ ...ROUND, diameters: [{ insideDiameterFeet: feet }] });
  const existingRound = (feet: number[]) => ({
    shape: "CIRCULAR" as const,
    topSlabThicknessInches: 8,
    baseSlabThicknessInches: 8,
    diameters: feet.map((value) => ({ insideDiameterFeet: value })),
    rectSizes: [],
  });
  const existingRect = {
    shape: "RECTANGULAR" as const,
    topSlabThicknessInches: 8,
    baseSlabThicknessInches: 8,
    diameters: [],
    rectSizes: [{ insideLengthInches: 72, insideWidthInches: 48 }],
  };

  it("blocks a mold change only when sheets exist", () => {
    expect(() =>
      assertSizeAndSlabsUnchangedForSheets(existingRound([4]), roundPayload("5"), 3),
    ).toThrow(/mold can't change while 3 drill sheets use it/);
    expect(() =>
      assertSizeAndSlabsUnchangedForSheets(existingRound([4]), roundPayload("5"), 0),
    ).not.toThrow();
    expect(() =>
      assertSizeAndSlabsUnchangedForSheets(existingRound([4]), roundPayload("4"), 3),
    ).not.toThrow();
  });

  it("lets a legacy template with several diameters be narrowed to one", () => {
    expect(() =>
      assertSizeAndSlabsUnchangedForSheets(existingRound([4, 5]), roundPayload("5"), 3),
    ).not.toThrow();
  });

  it("blocks adding or removing a slab, and resizing, when sheets exist", () => {
    expect(() =>
      assertSizeAndSlabsUnchangedForSheets(
        existingRect,
        parseTemplateData({ ...RECT, hasTopSlab: false }),
        1,
      ),
    ).toThrow(/slabs can't change while 1 drill sheet uses it/);
    expect(() =>
      assertSizeAndSlabsUnchangedForSheets(
        existingRect,
        parseTemplateData({
          ...RECT,
          rectSizes: [{ insideLengthInches: "60", insideWidthInches: "48" }],
        }),
        1,
      ),
    ).toThrow(/inside size can't change/);
    // Thickness, prices and everything else stay editable.
    expect(() =>
      assertSizeAndSlabsUnchangedForSheets(
        existingRect,
        parseTemplateData({ ...RECT, topSlabThicknessInches: "10" }),
        1,
      ),
    ).not.toThrow();
  });

  it("lets a legacy rect template without a size be given one", () => {
    expect(() =>
      assertSizeAndSlabsUnchangedForSheets(
        { ...existingRect, rectSizes: [] },
        parseTemplateData(RECT),
        4,
      ),
    ).not.toThrow();
  });
});
