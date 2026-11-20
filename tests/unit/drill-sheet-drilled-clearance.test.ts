import { describe, expect, it } from "vitest";
import {
  computeDrillSheet,
  drilledOpeningSpanFeet,
  type DiameterConfig,
  type DrillSheetInput,
  type PipeOpeningSizeEntry,
  type TemplateConfig,
} from "@/lib/drill-sheet";

// The sheet prints an opening's rise in whole inches (`@ +2"`), and that is
// where the shop drills. The clearance checks judge that drilled hole, not
// the exact pipe-centered elevation, which can sit up to 1/2" off it.

const template: TemplateConfig = {
  wallThicknessInches: 5,
  baseSlabThicknessInches: 8,
  topSlabThicknessInches: 12,
  minimumBrickInches: 1,
  connectionType: "KOR_N_SEAL",
  sumpMode: "DEFAULT",
  sumpFixedInches: null,
  openingToJointMinTopInches: 4,
  openingToJointMinBottomInches: 4,
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

// 4" pipe in a 12" booted hole (4" of sump under the lowest invert), and
// 8" pipe in a 14" booted hole (3" of sump).
const pipeOpeningSizes: PipeOpeningSizeEntry[] = [
  {
    pipeMaterial: "PVC",
    pipeSizeInches: 8,
    pipeType: "SDR35",
    hasBoot: true,
    holeDiameterInches: 14,
    pipeWallThicknessInches: 0.25,
    bootModel: "S106-14",
    pricePerBoot: 60,
  },
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
];

function sheet(
  rimElevation: number,
  inverts: number[],
  pipeSizeInches = 4,
): ReturnType<typeof computeDrillSheet> {
  const input: DrillSheetInput = {
    rimElevation,
    castingHeightFeet: 4 / 12,
    diameter,
    template,
    pipeOpeningSizes,
    openings: inverts.map((invertElevation, index) => ({
      label: String.fromCharCode(65 + index),
      pipeMaterial: "PVC SDR35",
      pipeSizeInches,
      invertElevation,
      angleDegrees: index * 90,
    })),
  };
  return computeDrillSheet(input);
}

describe("drilledOpeningSpanFeet", () => {
  it("puts the hole on the whole inch the sheet prints", () => {
    // Centered bottom is 2.4" above the floor; the sheet prints @ +2".
    const span = drilledOpeningSpanFeet(
      {
        bottomOfOpeningFeet: -0.1333,
        holeDiameterInches: 12,
        pipeSizeInches: 4,
      },
      -0.3333,
    );
    expect(span).not.toBeNull();
    expect((span!.lo - -0.3333) * 12).toBeCloseTo(2, 6);
    expect((span!.hi - -0.3333) * 12).toBeCloseTo(14, 6);
  });

  it("has no span without an opening elevation", () => {
    expect(
      drilledOpeningSpanFeet(
        { bottomOfOpeningFeet: null, holeDiameterInches: 12, pipeSizeInches: 4 },
        0,
      ),
    ).toBeNull();
  });
});

describe("top-of-wall clearance uses the drilled hole", () => {
  // Nick's MH-91 (2026-11-20): rim 2.25, inverts 0.00 and 0.20, 18" wall.
  // B centers 2.4" above the floor (top 14.4", 3.6" under the wall top) but
  // prints and drills @ +2": top at 14", exactly the 4" minimum.
  it("passes a hole the sheet drills 4\" under the wall top", () => {
    const result = sheet(2.25, [0, 0.2]);
    expect(result.wallHeightFeet).toBe(1.5);
    expect(result.hasKey).toBe(false);
    expect(result.errorMessage).toBeNull();
    expect(result.openings[1].sectionBottomToOpeningBottomInches).toBe(2);
    expect(result.sections.map((s) => s.heightFeet)).toEqual([1.5]);
  });

  it("still fails once the printed rise leaves less than the minimum", () => {
    // Invert 0.21 centers 2.52" up and prints @ +3": top at 15", 3" clear.
    const result = sheet(2.25, [0, 0.21]);
    expect(result.openings[1].baseTopToOpeningBottomInches).toBe(3);
    expect(result.errorMessage).toMatch(/too close to the top of the wall/);
    // The message quotes the drilled top: floor -0.33' + 15".
    expect(result.errorMessage).toContain("(0.92')");
  });

  it("keeps the key at exactly the minimum when nothing rounds", () => {
    // 8" pipes in 14" holes, keyed 2' wall. B (invert 0.50) sits 6" to 20"
    // above the floor: exactly 4" under the wall top, so the key stays.
    const result = sheet(3.34, [0, 0.5], 8);
    expect(result.wallHeightFeet).toBe(2);
    expect(result.openings[1].baseTopToOpeningBottomInches).toBe(6);
    expect(result.hasKey).toBe(true);
    expect(result.errorMessage).toBeNull();
  });
});

describe("joint clearance uses the drilled hole", () => {
  it("keeps the tall base when the drilled hole clears the joint by 4\"", () => {
    // 5' wall. B (invert 2.70) centers 32.4" above the floor: top 44.4",
    // 3.6" under a 4' base joint. Drilled @ +32" its top is 44", 4" clear,
    // so the 4' base + 1' riser stands instead of a 2' base + 3' riser.
    const result = sheet(6.5, [0, 2.7]);
    expect(result.wallHeightFeet).toBe(5);
    expect(result.errorMessage).toBeNull();
    expect(result.sections.map((s) => [s.role, s.heightFeet])).toEqual([
      ["BASE", 4],
      ["RISER", 1],
    ]);
    expect(result.openings[1].containingSectionRole).toBe("BASE");
    expect(result.openings[1].sectionBottomToOpeningBottomInches).toBe(32);
    expect(result.warnings).toEqual([]);
  });

  it("accepts a hole that sits on the floor over a 4\" sump", () => {
    // MH-92 on the same screen: a 4" sump is 0.3333' once rounded, which put
    // the exact hole bottom a hair below the floor and failed every split
    // ("No base/riser combination clears every pipe opening").
    const result = sheet(2.25, [0, 0.1]);
    expect(result.errorMessage).toBeNull();
    expect(
      result.openings.map((o) => o.sectionBottomToOpeningBottomInches),
    ).toEqual([0, 1]);
    expect(result.sections.map((s) => s.heightFeet)).toEqual([1.5]);
  });

  it("still moves the joint when the drilled hole is too close", () => {
    // Invert 2.71 centers 32.52" up and prints @ +33": top 45", 3" clear.
    const result = sheet(6.5, [0, 2.71]);
    expect(result.errorMessage).toBeNull();
    expect(result.sections.map((s) => [s.role, s.heightFeet])).toEqual([
      ["BASE", 2],
      ["RISER", 3],
    ]);
  });
});
