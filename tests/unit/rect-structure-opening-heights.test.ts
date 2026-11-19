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
  {
    pipeMaterial: "RCP",
    pipeSizeInches: 24,
    openingWidthInches: 36,
    openingHeightInches: 36,
    pipeWallThicknessInches: 3,
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
    // it keeps its full 28"x28" size and slides down: top at the wall top,
    // bottom 2" above the floor (the pipe rides high in the block-out).
    const opening = result.openings[0];
    expect(opening.extendsToTop).toBe(true);
    expect(opening.openingHeightInches).toBe(28);
    expect(opening.catalogHeightInches).toBe(28);
    expect(opening.topOfOpeningFeet).toBeCloseTo(163.28, 2);
    expect(opening.floorToOpeningBottomInches).toBe(2);
    expect(
      result.warnings.some((warning) => warning.includes("slid down")),
    ).toBe(true);
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

  it("slides an opening down when it pokes past 30\" walls", () => {
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
    // 28"x28" @ +3" keeps its full size and slides down 1": top at the wall
    // top, bottom now +2".
    expect(opening.extendsToTop).toBe(true);
    expect(opening.openingHeightInches).toBe(28);
    expect(opening.floorToOpeningBottomInches).toBe(2);
    expect(opening.topOfOpeningFeet).toBeCloseTo(163.4533, 3);
    expect(
      result.warnings.some((warning) => warning.includes("slid down")),
    ).toBe(true);
    // The pipe itself (top 163.33) stays under the walls: no red error.
    expect(result.pipeErrors).toHaveLength(0);
  });

  it("cuts an opening off only when it is taller than the walls", () => {
    // Very shallow box: raw available lands at 1.0' of wall, far less than
    // the 28" opening. Sliding down cannot help — the block-out becomes a
    // full-height open-top notch.
    const result = computeRectStructure(input({ rimElevation: 162.92 }));

    expect(result.wallHeightFeet).toBe(1);
    const opening = result.openings[0];
    expect(opening.extendsToTop).toBe(true);
    expect(opening.openingHeightInches).toBe(12);
    expect(opening.floorToOpeningBottomInches).toBe(0);
    expect(
      result.warnings.some((warning) =>
        warning.includes("taller than the walls"),
      ),
    ).toBe(true);
    // The pipe cannot fit either — hard red error.
    expect(result.pipeErrors).toHaveLength(1);
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

describe("computeRectStructure openings never start below the floor", () => {
  // DS-S4 from Nick's Quick Build (2026-11-19): three pipes at the same
  // invert. The 18" pipe is first, so it sets the 5" sump; the two 24" pipes
  // need 6" under the invert for a centered 36" block-out. They printed as
  // 36"x37" in a 36" wall: 1" of it was below the floor.
  function dsS4(overrides: Partial<RectStructureInput> = {}): RectStructureInput {
    const base = input();
    return {
      ...base,
      rimElevation: 14.97,
      castingHeightFeet: 0.5,
      insideLengthFeet: 5,
      insideWidthFeet: 4,
      template: {
        ...base.template,
        topSlabThicknessInches: 10,
        minimumBrickInches: 3,
      },
      openings: [
        opening({ label: "A", wall: "LEFT", invertElevation: 10.75 }),
        opening({
          label: "B",
          wall: "RIGHT",
          pipeSizeInches: 24,
          invertElevation: 10.75,
        }),
        opening({
          label: "C",
          wall: "UP",
          pipeSizeInches: 24,
          invertElevation: 10.75,
        }),
      ],
      ...overrides,
    };
  }

  it("keeps a 36\" opening at 36\" in a 36\" wall", () => {
    const result = computeRectStructure(dsS4());

    expect(result.sumpFeet).toBeCloseTo(0.4167, 4);
    expect(result.floorElevation).toBeCloseTo(10.3333, 4);
    expect(result.wallHeightFeet).toBe(3);
    expect(result.brickFeet).toBeCloseTo(0.3, 2);

    const [a, b, c] = result.openings;
    // A's 28" block-out starts exactly at the floor: untouched.
    expect(a.openingHeightInches).toBe(28);
    expect(a.floorToOpeningBottomInches).toBe(0);
    expect(a.extendsToTop).toBe(false);

    for (const big of [b, c]) {
      expect(big.openingWidthInches).toBe(36);
      expect(big.openingHeightInches).toBe(36);
      expect(big.bottomOfOpeningFeet).toBeCloseTo(10.3333, 4);
      expect(big.topOfOpeningFeet).toBeCloseTo(13.3333, 4);
      expect(big.floorToOpeningBottomInches).toBe(0);
      expect(big.extendsToTop).toBe(true);
    }
    expect(result.warnings.some((warning) => warning.includes('x37"'))).toBe(
      false,
    );
    expect(
      result.warnings.filter((warning) =>
        warning.includes("sits on the floor"),
      ),
    ).toHaveLength(2);
    expect(
      result.warnings.some((warning) =>
        warning.includes(
          'Opening B runs to the top of the walls (36"x36" open-top block-out)',
        ),
      ),
    ).toBe(true);
    expect(result.pipeErrors).toHaveLength(0);
  });

  it("raises the walls for an opening lifted onto the floor", () => {
    // No sump under an 18" pipe: centered on the pipe, the 28" block-out
    // would start 5" below the floor and top out 23" above it, which a 2'
    // wall covers. Sitting on the floor it tops out at 28", so the walls
    // have to go to 2.5' (raw available 2.6').
    const base = input();
    const result = computeRectStructure({
      ...base,
      rimElevation: 166.35,
      template: {
        ...base.template,
        sumpMode: "FIXED",
        sumpFixedInches: 0,
      },
      openings: [opening({ invertElevation: 163.0 })],
    });

    expect(result.floorElevation).toBeCloseTo(163.0, 4);
    expect(result.wallHeightFeet).toBe(2.5);
    expect(
      result.warnings.some((warning) => warning.includes("Walls raised to 2.50'")),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes('would start 5" below it'),
      ),
    ).toBe(true);

    const only = result.openings[0];
    expect(only.bottomOfOpeningFeet).toBeCloseTo(163.0, 4);
    expect(only.floorToOpeningBottomInches).toBe(0);
    // 2" of wall would be left over the 28" block-out, so it runs to the
    // wall top: 30" measured from the floor, never from below it.
    expect(only.extendsToTop).toBe(true);
    expect(only.openingHeightInches).toBe(30);
    expect(only.topOfOpeningFeet).toBeCloseTo(165.5, 4);
  });

  it("says nothing when the opening starts at or above the floor", () => {
    const result = computeRectStructure(
      dsS4({
        openings: [
          opening({ label: "A", wall: "LEFT", invertElevation: 10.75 }),
        ],
      }),
    );
    expect(
      result.warnings.some((warning) =>
        warning.includes("sits on the floor"),
      ),
    ).toBe(false);
    expect(result.openings[0].floorToOpeningBottomInches).toBe(0);
  });
});
