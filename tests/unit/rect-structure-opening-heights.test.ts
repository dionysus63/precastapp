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
    pipeWallThicknessInches: 2.5,
    pricePerOpening: null,
  },
  {
    pipeMaterial: "RCP",
    pipeSizeInches: 12,
    openingWidthInches: 20,
    openingHeightInches: 20,
    pipeWallThicknessInches: 2,
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
    // The 28" opening would top out above the walls (163.54 vs 163.28), so
    // it becomes an open-top block-out cut off at the wall top: 25" tall.
    const opening = result.openings[0];
    expect(opening.extendsToTop).toBe(true);
    expect(opening.openingHeightInches).toBe(25);
    expect(opening.catalogHeightInches).toBe(28);
    expect(opening.topOfOpeningFeet).toBeCloseTo(163.28, 2);
    // And the PIPE itself (18" + 2.5" wall = top 163.33) clears nothing:
    // 0.6" above the max wall top even with no brick — hard red error.
    expect(result.pipeErrors).toHaveLength(1);
    expect(result.pipeErrors[0]).toContain('18" RCP');
    expect(result.pipeErrors[0]).toContain("even with no brick");
    expect(result.pipeErrors[0]).toContain("Raise the rim or lower the pipe");
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
      result.warnings.some((warning) => warning.includes("Brick removed")),
    ).toBe(false);
    // Only 2" of concrete would sit over the opening — that strip cracks in
    // shipping, so the block-out extends to the top of the walls instead.
    expect(result.openings[0].extendsToTop).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("extended to the top of the walls"),
      ),
    ).toBe(true);
    // The pipe itself fits (top 164.71 vs walls 165.08): no red error.
    expect(result.pipeErrors).toHaveLength(0);
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
    // Plenty of cover (22") above the opening: no extension, no pipe error.
    expect(result.openings[0].extendsToTop).toBe(false);
    expect(result.pipeErrors).toHaveLength(0);
  });

  it("cuts an opening off at the wall top when it pokes past 30\" walls", () => {
    // Field report: 30"-tall box, 28"x28" opening @ +3" — the opening tops
    // out at 31", 1" past the walls. Fixed 8" sump puts the block-out bottom
    // 3" above the floor; raw lands exactly on 2.5' so nothing can grow.
    const result = computeRectStructure(
      input({
        rimElevation: 163.4533,
        castingHeightFeet: 0,
        template: {
          wallThicknessInches: 8,
          baseSlabThicknessInches: 8,
          topSlabThicknessInches: 0,
          minimumBrickInches: 4,
          sumpMode: "FIXED",
          sumpFixedInches: 8,
          wallPricePerFoot: 0,
          minPricingHeightFeet: 0,
          topSlabPrice: 0,
          baseSlabPrice: 0,
        },
      }),
    );

    expect(result.wallHeightFeet).toBe(2.5);
    expect(result.brickFeet).toBe(0);
    const opening = result.openings[0];
    expect(opening.floorToOpeningBottomInches).toBe(3);
    // 28"x28" @ +3" becomes a 28"x27" open-top block-out ending at the top.
    expect(opening.extendsToTop).toBe(true);
    expect(opening.openingHeightInches).toBe(27);
    expect(opening.topOfOpeningFeet).toBeCloseTo(163.4533, 3);
    expect(
      result.warnings.some((warning) =>
        warning.includes("cut off at the wall top"),
      ),
    ).toBe(true);
    // The pipe itself (top 163.33) stays under the walls: no red error.
    expect(result.pipeErrors).toHaveLength(0);
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
