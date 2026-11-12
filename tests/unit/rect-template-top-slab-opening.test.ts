import { describe, expect, it } from "vitest";
import {
  computeRectStructure,
  resolveTopSlabOpening,
  type RectStructureInput,
  type RectTemplateConfig,
} from "@/lib/rect-structure";
import { topSlabOpeningRect } from "@/lib/rect-structure-diagram";

// Templates carry a default top-slab access opening; a structure inherits
// it unless it enters its own size.
const TEMPLATE: RectTemplateConfig = {
  wallThicknessInches: 8,
  baseSlabThicknessInches: 8,
  topSlabThicknessInches: 8,
  minimumBrickInches: 4,
  sumpMode: "FIXED",
  sumpFixedInches: 24,
  wallPricePerFoot: 0,
  minPricingHeightFeet: 0,
  topSlabPrice: 0,
  baseSlabPrice: 0,
  topSlabOpeningLengthInches: 30,
  topSlabOpeningWidthInches: 24,
  topSlabOpeningSide: "RIGHT",
};

function input(overrides: Partial<RectStructureInput> = {}): RectStructureInput {
  return {
    rimElevation: 103.4,
    castingHeightFeet: 0.42,
    insideLengthFeet: 6,
    insideWidthFeet: 4,
    baseAttached: true,
    template: TEMPLATE,
    openingSizes: [],
    openings: [],
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: null,
    ...overrides,
  };
}

describe("top slab opening inherited from the template", () => {
  it("uses the template opening when the structure has none", () => {
    const result = computeRectStructure(input());
    expect(result.topSlabOpening).toEqual({
      lengthInches: 30,
      widthInches: 24,
      side: "RIGHT",
    });
    expect(result.topSlabOpeningFromTemplate).toBe(true);
    // The sheet draws it against the Right wall's inside face.
    const rect = topSlabOpeningRect(result);
    expect(rect).not.toBeNull();
    expect(rect!.x + rect!.width).toBeCloseTo(1 - 8 / 88, 4);
  });

  it("treats a blank structure entry (side only) as inherited", () => {
    const result = computeRectStructure(
      input({
        topSlabOpening: { lengthInches: null, widthInches: null, side: "UP" },
      }),
    );
    expect(result.topSlabOpening?.side).toBe("RIGHT");
    expect(result.topSlabOpeningFromTemplate).toBe(true);
  });

  it("lets the structure's own size override the template", () => {
    const result = computeRectStructure(
      input({
        topSlabOpening: { lengthInches: 36, widthInches: 36, side: "DOWN" },
      }),
    );
    expect(result.topSlabOpening).toEqual({
      lengthInches: 36,
      widthInches: 36,
      side: "DOWN",
    });
    expect(result.topSlabOpeningFromTemplate).toBe(false);
  });

  it("subtracts the inherited opening from the top slab weight", () => {
    const withOpening = computeRectStructure(input());
    const noDefault = computeRectStructure(
      input({
        template: {
          ...TEMPLATE,
          topSlabOpeningLengthInches: null,
          topSlabOpeningWidthInches: null,
          topSlabOpeningSide: null,
        },
      }),
    );
    expect(noDefault.topSlabOpening).toBeNull();
    expect(noDefault.topSlabOpeningFromTemplate).toBe(false);
    expect(withOpening.weights.topSlabLbs).not.toBeNull();
    expect(withOpening.weights.topSlabLbs!).toBeLessThan(
      noDefault.weights.topSlabLbs!,
    );
  });

  it("drops the opening entirely when the template has no top slab", () => {
    const result = computeRectStructure(
      input({ template: { ...TEMPLATE, topSlabThicknessInches: 0 } }),
    );
    expect(result.topSlabOpening).toBeNull();
    expect(result.topSlabOpeningFromTemplate).toBe(false);
  });

  it("defaults the side to Up when the template stores none", () => {
    const resolved = resolveTopSlabOpening(null, {
      topSlabOpeningLengthInches: 24,
      topSlabOpeningWidthInches: 24,
      topSlabOpeningSide: null,
    });
    expect(resolved.opening?.side).toBe("UP");
    expect(resolved.fromTemplate).toBe(true);
  });
});
