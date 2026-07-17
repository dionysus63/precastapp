import { describe, expect, it } from "vitest";
import {
  computeRectStructure,
  type RectOpeningInput,
  type RectStructureInput,
} from "@/lib/rect-structure";

// STR 212 from the field report: 18" RCP with a 28" x 28" catalog opening in
// a shallow structure. The opening must never poke into the brick course.
const OPENING_SIZES = [
  {
    pipeMaterial: "RCP",
    pipeSizeInches: 18,
    openingWidthInches: 28,
    openingHeightInches: 28,
    pricePerOpening: null,
  },
  {
    pipeMaterial: "RCP",
    pipeSizeInches: 12,
    openingWidthInches: 20,
    openingHeightInches: 20,
    pricePerOpening: null,
  },
];

function opening(overrides: Partial<RectOpeningInput> = {}): RectOpeningInput {
  return {
    label: "A",
    wall: "UP",
    pipeMaterial: "RCP",
    pipeSizeInches: 18,
    invertElevation: 161.62,
    angleDegrees: 0,
    placement: "CENTERED",
    offsetInches: null,
    widthOverrideInches: null,
    ...overrides,
  };
}

function input(overrides: Partial<RectStructureInput> = {}): RectStructureInput {
  return {
    rimElevation: 164.03,
    castingHeightFeet: 0.75,
    insideLengthFeet: 4,
    insideWidthFeet: 4,
    hasTopSlab: false,
    hasBaseSlab: true,
    baseAttached: true,
    template: {
      wallThicknessInches: 8,
      baseSlabThicknessInches: 8,
      topSlabThicknessInches: 0,
      minimumBrickInches: 4,
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      wallPricePerFoot: 0,
      minPricingHeightFeet: 0,
      topSlabPrice: 0,
      baseSlabPrice: 0,
    },
    openingSizes: OPENING_SIZES,
    openings: [opening()],
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: null,
    ...overrides,
  };
}

describe("computeRectStructure opening-height guard", () => {
  it("removes the brick and deepens the sump so the walls clear the opening", () => {
    // Default sump (28-18)/2 = 5" gives rawAvailable 2.0767' and would have
    // produced an 18" wall + 7" brick, with the 28" opening at the floor
    // topping out 10" above the walls.
    const result = computeRectStructure(input());

    expect(result.wallHeightFeet).toBe(2.5);
    expect(result.brickFeet).toBe(0);
    // Sump grew from 5" by the 6"-increment deficit (~5.1") to ~10".
    expect(result.sumpFeet).toBeCloseTo(0.84, 2);
    expect(result.floorElevation).toBeCloseTo(160.78, 2);
    expect(
      result.warnings.some((warning) =>
        warning.includes("Brick removed and the sump increased"),
      ),
    ).toBe(true);
    // Even with no brick the 28" opening still pokes ~3" above wallTop
    // (163.28 vs opening top 163.54) — that residual must be called out.
    expect(
      result.warnings.some((warning) =>
        warning.includes("still extends") && warning.includes("raise the rim"),
      ),
    ).toBe(true);
  });

  it("raises the walls out of the brick when the available height allows it", () => {
    // Deeper structure: same 28" opening but 2' more rim height. Base wall
    // would be limited by brick preference; the opening forces 2.5'.
    const result = computeRectStructure(
      input({
        rimElevation: 166.03,
        openings: [opening({ invertElevation: 163.0 })],
      }),
    );

    // required = opening top (164.92) - floor (162.58) = 2.33 → 2.5' wall.
    expect(result.wallHeightFeet).toBeGreaterThanOrEqual(2.5);
    const wallTop =
      (result.floorElevation ?? 0) + result.wallHeightFeet;
    const openingTop = result.openings[0].topOfOpeningFeet ?? 0;
    expect(wallTop + 1e-6).toBeGreaterThanOrEqual(openingTop);
    expect(
      result.warnings.some(
        (warning) =>
          warning.includes("still extends") ||
          warning.includes("Brick removed"),
      ),
    ).toBe(false);
  });

  it("leaves structures alone when the opening already fits in the walls", () => {
    const result = computeRectStructure(
      input({
        rimElevation: 166.03,
        openings: [
          opening({ pipeSizeInches: 12, invertElevation: 161.62 }),
        ],
      }),
    );

    const wallTop = (result.floorElevation ?? 0) + result.wallHeightFeet;
    const openingTop = result.openings[0].topOfOpeningFeet ?? 0;
    expect(wallTop + 1e-6).toBeGreaterThanOrEqual(openingTop);
    expect(
      result.warnings.some(
        (warning) =>
          warning.includes("Walls raised") || warning.includes("Brick removed"),
      ),
    ).toBe(false);
  });

  it("keeps sections consistent with the grown wall height", () => {
    const result = computeRectStructure(input());
    expect(result.errorMessage).toBeNull();
    const sectionsSum = result.sections.reduce(
      (sum, section) => sum + section.heightFeet,
      0,
    );
    expect(sectionsSum).toBeCloseTo(result.wallHeightFeet, 4);
  });
});
