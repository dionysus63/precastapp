import { describe, expect, it } from "vitest";
import {
  computeDrillSheet,
  type DiameterConfig,
  type DrillSheetInput,
  type PipeOpeningSizeEntry,
  type TemplateConfig,
} from "@/lib/drill-sheet";

// A pipe opening cannot run out of the top of the wall. When the usual wall
// (6" steps, brick kept at the minimum) leaves a hole sticking out even with
// the top slab key dropped, the wall takes brick, down to none, to reach the
// first 6" step that clears the hole.

// Nick's "PRESSURE RELIEF" (2026-11-24, 4'Ø Storm): rim 30.00, A 12" HDPE at
// 26.10 in a 22" hole (5" sump), B 8" DI at 27.50 in a 14" hole that drills
// @ +19" (top at 28.43). Without the key there is 3.3234' under the casting:
// a 3'-0" wall leaves 3.88" of brick, 1/8" under the 4" minimum, so the wall
// used to stop at 2'-6" with 10" of brick and the hole 3" above it.
const template: TemplateConfig = {
  wallThicknessInches: 5,
  baseSlabThicknessInches: 8,
  topSlabThicknessInches: 12,
  minimumBrickInches: 4,
  connectionType: "KOR_N_SEAL",
  sumpMode: "DEFAULT",
  sumpFixedInches: null,
  openingToJointMinTopInches: 0,
  openingToJointMinBottomInches: 0,
};

const diameter: DiameterConfig = {
  insideDiameterFeet: 4,
  maxBaseHeightFeet: 4,
  maxRiserHeightFeet: 4,
  wallThicknessInches: 5,
  // 12" slab less this key = the 0.66' keyless slab on Nick's sheet.
  keyHeightFeet: 0.34,
  wallPricePerFoot: 135,
  basePrice: 530,
};

const pipeOpeningSizes: PipeOpeningSizeEntry[] = [
  {
    pipeMaterial: "HDPE",
    pipeSizeInches: 12,
    pipeType: "",
    hasBoot: false,
    holeDiameterInches: 22,
    pipeWallThicknessInches: 1.25,
    bootModel: null,
    pricePerBoot: 0,
  },
  {
    pipeMaterial: "DI",
    pipeSizeInches: 8,
    pipeType: "",
    hasBoot: false,
    holeDiameterInches: 14,
    pipeWallThicknessInches: 0.5,
    bootModel: null,
    pricePerBoot: 0,
  },
];

function sheet(
  overrides: Partial<DrillSheetInput> & {
    minimumBrickInches?: number;
    invertB?: number;
  } = {},
): ReturnType<typeof computeDrillSheet> {
  const { minimumBrickInches, invertB, ...input } = overrides;
  return computeDrillSheet({
    rimElevation: 30,
    castingHeightFeet: 0.3333,
    diameter,
    template:
      minimumBrickInches == null
        ? template
        : { ...template, minimumBrickInches },
    pipeOpeningSizes,
    openings: [
      {
        label: "A",
        pipeMaterial: "HDPE",
        pipeSizeInches: 12,
        invertElevation: 26.1,
        angleDegrees: 0,
      },
      {
        label: "B",
        pipeMaterial: "DI",
        pipeSizeInches: 8,
        invertElevation: invertB ?? 27.5,
        angleDegrees: 180,
      },
    ],
    ...input,
  });
}

describe("wall raised into the brick for a pipe opening", () => {
  it("takes the 3'-0\" wall and lets the brick go under the minimum", () => {
    const result = sheet();
    expect(result.openings[1].baseTopToOpeningBottomInches).toBe(19);
    expect(result.hasKey).toBe(false);
    expect(result.wallHeightFeet).toBe(3);
    expect(result.brickFeet).toBeCloseTo(0.3234, 4);
    expect(result.sections.map((s) => s.heightFeet)).toEqual([3]);
    expect(result.errorMessage).toBeNull();
    expect(result.warnings).toEqual([
      'Wall raised to 3.00\' so the highest pipe opening stays inside the wall. Brick (3.88") is below the 4" minimum.',
    ]);
  });

  it("lets the brick go all the way to none", () => {
    // Rim 0.32' lower: 3.0034' under the casting, a 3'-0" wall and no brick.
    const result = sheet({ rimElevation: 29.68 });
    expect(result.wallHeightFeet).toBe(3);
    expect(result.brickFeet).toBeLessThan(0.01);
    expect(result.errorMessage).toBeNull();
    expect(result.warnings.join(" ")).toMatch(/Wall raised to 3\.00'/);
  });

  it("still fails, and says by how much, when no brick is left to take", () => {
    // Rim 29.50: 2.8234' under the casting even without the key, so the
    // usual 2'-0" wall stays (2'-6" would leave 3.88" of brick).
    const result = sheet({ rimElevation: 29.5 });
    expect(result.wallHeightFeet).toBe(2);
    expect(result.errorMessage).toBe(
      "Highest pipe opening top (28.43') is too close to the top of the wall (27.68'). Minimum clearance is 0\". The wall would have to be 3.00', 2.12\" more than fits under this rim even with no brick.",
    );
  });

  it("leaves a wall that already clears the hole as it was", () => {
    // A 3" minimum: the usual wall is already 3'-0".
    const result = sheet({ minimumBrickInches: 3 });
    expect(result.wallHeightFeet).toBe(3);
    expect(result.brickFeet).toBeCloseTo(0.3234, 4);
    expect(result.warnings).toEqual([]);
    expect(result.errorMessage).toBeNull();
  });

  it("counts a change made by hand from the raised wall", () => {
    const lowered = sheet({ wallHeightAdjustInches: -6 });
    expect(lowered.wallHeightFeet).toBe(2.5);
    expect(lowered.errorMessage).toMatch(
      /too close to the top of the wall \(28\.18'\)/,
    );
    expect(lowered.errorMessage).not.toMatch(/would have to be/);
  });
});

describe("wall raised by hand that only fits without the key", () => {
  it("drops the key instead of calling the wall too tall", () => {
    // B at 27.00 drills @ +13" (top 27.93) and clears the keyed 2'-6" wall.
    const auto = sheet({ invertB: 27 });
    expect(auto.hasKey).toBe(true);
    expect(auto.wallHeightFeet).toBe(2.5);
    expect(auto.errorMessage).toBeNull();

    // +6" is 0.2" too tall with the 12" keyed slab, and fits the 0.66' one.
    const raised = sheet({ invertB: 27, wallHeightAdjustInches: 6 });
    expect(raised.hasKey).toBe(false);
    expect(raised.wallHeightFeet).toBe(3);
    expect(raised.brickFeet).toBeCloseTo(0.3234, 4);
    expect(raised.errorMessage).toBeNull();
    expect(raised.warnings).toEqual([]);
  });

  it("does the same on the structure whose hole needs the taller wall", () => {
    const raised = sheet({ wallHeightAdjustInches: 6 });
    expect(raised.hasKey).toBe(false);
    expect(raised.wallHeightFeet).toBe(3);
    expect(raised.errorMessage).toBeNull();
  });

  it("still errors when the wall is too tall without the key too", () => {
    const tooTall = sheet({ invertB: 27, wallHeightAdjustInches: 12 });
    expect(tooTall.errorMessage).toMatch(
      /Wall raised 12" by hand is .* too tall/,
    );
  });
});
