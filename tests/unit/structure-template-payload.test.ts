import { describe, expect, it } from "vitest";
import { parseTemplateData } from "@/lib/structure-template-payload";

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
