import { describe, expect, it } from "vitest";
import {
  applyWallHeightAdjust,
  computeDrillSheet,
  computeWallHeightFeet,
} from "@/lib/drill-sheet";

// Heights are added up from parts kept to 4 decimals of a foot, so a length
// in twelfths is a hair off (1" = 0.0833'). Brick of exactly the minimum, or
// space of exactly a 6" step, must not read as short because of that hair.

describe("computeWallHeightFeet with rounded parts", () => {
  it("keeps the wall when the brick is exactly the minimum", () => {
    // 1.5833' under the casting: 18" of wall and exactly 1" of brick.
    expect(computeWallHeightFeet(1.5833, 1)).toEqual({
      wallHeightFeet: 1.5,
      brickFeet: 0.0833,
    });
    // Same with a 4" minimum (0.3333').
    expect(computeWallHeightFeet(1.8333, 4)).toEqual({
      wallHeightFeet: 1.5,
      brickFeet: 0.3333,
    });
  });

  it("still drops 6\" when the brick really is short", () => {
    // 0.08' is 0.96": short of the 1" minimum.
    expect(computeWallHeightFeet(1.58, 1)).toEqual({
      wallHeightFeet: 1,
      brickFeet: 0.58,
    });
  });

  it("uses a full 6\" step the space reaches within a hair", () => {
    // 8" casting, 8" slab and 4" sump add up to 2.4999' where 2.5' is meant.
    expect(computeWallHeightFeet(2.4999, 0)).toEqual({
      wallHeightFeet: 2.5,
      brickFeet: 0,
    });
    // A real shortfall still rounds down.
    expect(computeWallHeightFeet(2.49, 0)).toEqual({
      wallHeightFeet: 2,
      brickFeet: 0.49,
    });
  });
});

describe("applyWallHeightAdjust with rounded parts", () => {
  it("does not call a raised wall too tall by a hair", () => {
    expect(
      applyWallHeightAdjust({ wallHeightFeet: 2, brickFeet: 0.4999 }, 2.4999, 6),
    ).toEqual({ wallHeightFeet: 2.5, brickFeet: 0, shortByFeet: 0 });
  });

  it("still reports a wall raised past the space", () => {
    const raised = applyWallHeightAdjust(
      { wallHeightFeet: 2, brickFeet: 0.25 },
      2.25,
      6,
    );
    expect(raised.shortByFeet).toBeCloseTo(0.25, 4);
  });
});

describe("drill sheet with exactly the minimum brick", () => {
  it("keeps the 18\" wall and 1\" of brick", () => {
    // Rim 2.25 over invert 0.00: 4" casting, 8" keyless slab, 4" sump leave
    // 1.5833', which is an 18" wall and exactly the 1" minimum brick. The
    // wall used to drop to 12", and the second opening no longer fit.
    const result = computeDrillSheet({
      rimElevation: 2.25,
      castingHeightFeet: 0.3333,
      diameter: {
        insideDiameterFeet: 4,
        maxBaseHeightFeet: 4,
        maxRiserHeightFeet: 4,
        wallThicknessInches: 5,
        keyHeightFeet: 0.3333,
        wallPricePerFoot: 135,
        basePrice: 530,
      },
      template: {
        wallThicknessInches: 5,
        baseSlabThicknessInches: 8,
        topSlabThicknessInches: 12,
        minimumBrickInches: 1,
        connectionType: "KOR_N_SEAL",
        sumpMode: "DEFAULT",
        sumpFixedInches: null,
        openingToJointMinTopInches: 4,
        openingToJointMinBottomInches: 4,
      },
      pipeOpeningSizes: [
        {
          pipeMaterial: "PVC",
          pipeSizeInches: 4,
          pipeType: "SDR35",
          hasBoot: true,
          holeDiameterInches: 12,
          pipeWallThicknessInches: 0.125,
          bootModel: "S106-12MT",
          pricePerBoot: 50,
        },
      ],
      openings: [0, 0.2].map((invertElevation, index) => ({
        label: String.fromCharCode(65 + index),
        pipeMaterial: "PVC SDR35",
        pipeSizeInches: 4,
        invertElevation,
        angleDegrees: index * 90,
      })),
    });
    expect(result.wallHeightFeet).toBe(1.5);
    expect(result.brickFeet).toBeCloseTo(1 / 12, 3);
    expect(result.errorMessage).toBeNull();
    expect(result.warnings).toEqual([]);
  });
});
