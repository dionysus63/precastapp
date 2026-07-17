import { describe, expect, it } from "vitest";
import {
  CONCRETE_DENSITY_LB_PER_CUFT,
  computeWeights,
  type ComputedOpening,
  type ComputedSection,
  type DiameterConfig,
  type TemplateConfig,
} from "@/lib/drill-sheet";

const density = CONCRETE_DENSITY_LB_PER_CUFT;

function diameterConfig(
  overrides: Partial<DiameterConfig> = {},
): DiameterConfig {
  return {
    insideDiameterFeet: 4,
    maxBaseHeightFeet: 6,
    maxRiserHeightFeet: 6,
    keyHeightFeet: 4 / 12,
    wallPricePerFoot: 0,
    basePrice: 0,
    wallThicknessInches: 4,
    ...overrides,
  };
}

function templateConfig(
  overrides: Partial<TemplateConfig> = {},
): TemplateConfig {
  return {
    wallThicknessInches: 8,
    baseSlabThicknessInches: 8,
    topSlabThicknessInches: 16,
    minimumBrickInches: 4,
    connectionType: "KOR_N_SEAL",
    sumpMode: "DEFAULT",
    sumpFixedInches: null,
    openingToJointMinTopInches: 4,
    openingToJointMinBottomInches: 4,
    ...overrides,
  };
}

function section(
  role: "BASE" | "RISER",
  heightFeet: number,
): ComputedSection {
  return { role, heightFeet, hasBottomKey: role === "RISER", hasTopKey: true };
}

function opening(
  holeDiameterInches: number,
  bottomOfOpeningFeet: number | null,
): ComputedOpening {
  return {
    label: "A",
    pipeMaterial: "PVC",
    pipeSizeInches: 12,
    pipeType: "",
    invertElevation: bottomOfOpeningFeet,
    angleDegrees: 0,
    connectionType: "KOR_N_SEAL",
    holeDiameterInches,
    bootModel: null,
    pricePerBoot: null,
    hasBoot: true,
    pipeWallThicknessInches: null,
    isLowInvert: false,
    topOfPipeFeet: null,
    bottomOfOpeningFeet,
    topOfOpeningFeet:
      bottomOfOpeningFeet != null
        ? bottomOfOpeningFeet + holeDiameterInches / 12
        : null,
    baseTopToOpeningBottomInches: null,
    containingSectionRole: null,
    sectionBottomToOpeningBottomInches: null,
  };
}

/** Geometry the implementation must reproduce, written out independently. */
function ringAreaSqFt(insideFeet: number, wallInches: number): number {
  const outside = insideFeet + (2 * wallInches) / 12;
  return (Math.PI / 4) * (outside ** 2 - insideFeet ** 2);
}

function discAreaSqFt(insideFeet: number, wallInches: number): number {
  const outside = insideFeet + (2 * wallInches) / 12;
  return (Math.PI / 4) * outside ** 2;
}

describe("computeWeights", () => {
  it("weighs a base piece as wall ring plus the monolithic floor slab", () => {
    const weights = computeWeights(
      [section("BASE", 4)],
      [],
      diameterConfig(),
      templateConfig(),
      16 / 12,
      0,
    );

    const ring = ringAreaSqFt(4, 4);
    const disc = discAreaSqFt(4, 4);
    const expectedBase = Math.round(
      (ring * 4 + disc * (8 / 12)) * density,
    );
    const expectedTop = Math.round(disc * (16 / 12) * density);

    expect(weights.sectionWeightsLb).toEqual([expectedBase]);
    expect(weights.topSlabWeightLb).toBe(expectedTop);
    expect(weights.totalWeightLb).toBe(expectedBase + expectedTop);
  });

  it("deducts each opening from its containing piece as a flat-wall core", () => {
    // Base 0'–4', riser 4'–8'; the 24" hole sits at 5' — in the riser.
    const weights = computeWeights(
      [section("BASE", 4), section("RISER", 4)],
      [opening(24, 5)],
      diameterConfig(),
      templateConfig(),
      16 / 12,
      0,
    );

    const ring = ringAreaSqFt(4, 4);
    const disc = discAreaSqFt(4, 4);
    const core = (Math.PI / 4) * 2 ** 2 * (4 / 12) * density;
    const expectedBase = Math.round((ring * 4 + disc * (8 / 12)) * density);
    const expectedRiser = Math.round(ring * 4 * density - core);

    expect(weights.sectionWeightsLb).toEqual([expectedBase, expectedRiser]);
  });

  it("falls back to the base piece when a hole cannot be located", () => {
    const weights = computeWeights(
      [section("BASE", 4), section("RISER", 4)],
      [opening(24, null)],
      diameterConfig(),
      templateConfig(),
      16 / 12,
      null,
    );

    const ring = ringAreaSqFt(4, 4);
    const disc = discAreaSqFt(4, 4);
    const core = (Math.PI / 4) * 2 ** 2 * (4 / 12) * density;
    const expectedBase = Math.round(
      (ring * 4 + disc * (8 / 12)) * density - core,
    );
    const expectedRiser = Math.round(ring * 4 * density);

    expect(weights.sectionWeightsLb).toEqual([expectedBase, expectedRiser]);
  });

  it("returns nulls when the mold has no wall thickness", () => {
    const weights = computeWeights(
      [section("BASE", 4)],
      [],
      diameterConfig({ wallThicknessInches: null }),
      templateConfig(),
      16 / 12,
      0,
    );

    expect(weights).toEqual({
      sectionWeightsLb: null,
      topSlabWeightLb: null,
      totalWeightLb: null,
    });
  });

  it("returns nulls when there are no sections yet", () => {
    const weights = computeWeights(
      [],
      [],
      diameterConfig(),
      templateConfig(),
      16 / 12,
      0,
    );

    expect(weights.totalWeightLb).toBeNull();
  });

  it("matches the hand math for the 8' OD grease trap mold", () => {
    // 7.33' ID + 4" walls ≈ 8' OD; one 6' base with 8" slab, no risers.
    const weights = computeWeights(
      [section("BASE", 6)],
      [],
      diameterConfig({ insideDiameterFeet: 7.33 }),
      templateConfig(),
      16 / 12,
      0,
    );

    const ring = ringAreaSqFt(7.33, 4);
    const disc = discAreaSqFt(7.33, 4);
    const expectedBase = Math.round((ring * 6 + disc * (8 / 12)) * density);

    expect(weights.sectionWeightsLb).toEqual([expectedBase]);
    // ~8' OD grease trap base piece lands in a plausible range.
    expect(expectedBase).toBeGreaterThan(10_000);
    expect(expectedBase).toBeLessThan(20_000);
  });
});
