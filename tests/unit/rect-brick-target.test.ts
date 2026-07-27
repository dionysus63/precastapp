import { describe, expect, it } from "vitest";
import {
  computeRectStructure,
  type RectStructureInput,
} from "@/lib/rect-structure";

// Simple open-top box: rim 110, no casting, 12" RCP at invert 104 with a
// 20x20 catalog opening. Default sump (20-12)/2 = 4" makes rawAvailable
// 6.3333' of wall+brick to distribute.
const OPENING_SIZES = [
  {
    pipeMaterial: "RCP",
    pipeSizeInches: 12,
    openingWidthInches: 20,
    openingHeightInches: 20,
    pipeWallThicknessInches: 2,
    pricePerOpening: null,
  },
];

function input(overrides: Partial<RectStructureInput> = {}): RectStructureInput {
  return {
    rimElevation: 110,
    castingHeightFeet: 0,
    insideLengthFeet: 4,
    insideWidthFeet: 4,
    hasTopSlab: false,
    hasBaseSlab: true,
    baseAttached: true,
    template: {
      wallThicknessInches: 8,
      baseSlabThicknessInches: 8,
      topSlabThicknessInches: 0,
      minimumBrickInches: 6,
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      wallPricePerFoot: 0,
      minPricingHeightFeet: 0,
      topSlabPrice: 0,
      baseSlabPrice: 0,
    },
    openingSizes: OPENING_SIZES,
    openings: [
      {
        label: "A",
        wall: "UP",
        pipeMaterial: "RCP",
        pipeSizeInches: 12,
        invertElevation: 104,
        angleDegrees: 0,
        placement: "CENTERED",
        offsetInches: null,
        widthOverrideInches: null,
      },
    ],
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: null,
    ...overrides,
  };
}

describe("computeRectStructure brick target", () => {
  it("without a target, the template minimum drives brick", () => {
    // 6.3333' raw: 6.0' wall leaves 4" brick < 6" minimum, so a course drops.
    const result = computeRectStructure(input());
    expect(result.wallHeightFeet).toBe(5.5);
    expect(result.brickFeet).toBeCloseTo(0.8333, 3);
  });

  it("a zero target maximizes the walls", () => {
    const result = computeRectStructure(input({ brickTargetInches: 0 }));
    expect(result.wallHeightFeet).toBe(6);
    expect(result.brickFeet).toBeCloseTo(0.3333, 3);
  });

  it("a 10-inch target drops the walls a course", () => {
    const result = computeRectStructure(input({ brickTargetInches: 10 }));
    expect(result.wallHeightFeet).toBe(5.5);
    expect(result.brickFeet).toBeCloseTo(0.8333, 3); // exactly 10"
  });

  it("a 16-inch target drops another course", () => {
    const result = computeRectStructure(input({ brickTargetInches: 16 }));
    expect(result.wallHeightFeet).toBe(5);
    expect(result.brickFeet).toBeCloseTo(1.3333, 3);
  });

  it("an impossible target warns; opening clearance still raises the walls", () => {
    const result = computeRectStructure(input({ brickTargetInches: 100 }));
    // The target zeroes the walls, then the opening-height guard raises them
    // to the 6" increment that clears the 20" opening.
    expect(result.wallHeightFeet).toBe(2);
    expect(
      result.warnings.some((warning) => warning.includes("target does not")),
    ).toBe(true);
  });
});
