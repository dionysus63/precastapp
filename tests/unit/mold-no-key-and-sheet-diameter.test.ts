import { describe, expect, it } from "vitest";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  computeDrillSheet,
  type DiameterConfig,
  type DrillSheetInput,
  type TemplateConfig,
} from "@/lib/drill-sheet";
import {
  buildDrillSheetDetail,
  type DrillSheetWithDetail,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetFieldMap } from "@/lib/drill-sheet-template-pdf";
import {
  moldOutsideDiameterFeet,
  resolveSheetDiameter,
  type MoldSheetSettings,
} from "@/lib/mold-sheet-settings";

const template: TemplateConfig = {
  wallThicknessInches: 5,
  baseSlabThicknessInches: 8,
  topSlabThicknessInches: 8,
  minimumBrickInches: 4,
  connectionType: "KOR_N_SEAL",
  sumpMode: "DEFAULT",
  sumpFixedInches: null,
  openingToJointMinTopInches: 4,
  openingToJointMinBottomInches: 4,
};

const keyedMold: DiameterConfig = {
  insideDiameterFeet: 4,
  wallThicknessInches: 5,
  maxBaseHeightFeet: 4,
  maxRiserHeightFeet: 4,
  keyHeightFeet: 4 / 12,
  wallPricePerFoot: 135,
  basePrice: 530,
};

/** Same mold with the key switched off (key height left as it was typed). */
const keylessMold: DiameterConfig = { ...keyedMold, hasKey: false };

const pipeOpeningSizes: DrillSheetInput["pipeOpeningSizes"] = [
  {
    pipeMaterial: "PVC SDR35",
    pipeSizeInches: 8,
    pipeType: "",
    hasBoot: true,
    holeDiameterInches: 14,
    pipeWallThicknessInches: 0.25,
    bootModel: "KNS-14",
    pricePerBoot: 50,
  },
];

function input(
  diameter: DiameterConfig,
  rimElevation: number,
  inverts: number[],
): DrillSheetInput {
  return {
    rimElevation,
    castingHeightFeet: 0.5,
    diameter,
    template,
    pipeOpeningSizes,
    openings: inverts.map((invertElevation, index) => ({
      label: String.fromCharCode(65 + index),
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: 8,
      invertElevation,
      angleDegrees: index * 90,
    })),
  };
}

describe("keyless molds (Structure Molds → Key = No)", () => {
  // Tall enough for a base and a riser, so there is a joint to key.
  const tall = (diameter: DiameterConfig) =>
    computeDrillSheet(input(diameter, 110, [100]));

  it("a keyed mold keys the top slab and every joint, as before", () => {
    const result = tall(keyedMold);
    expect(result.sections.length).toBeGreaterThan(1);
    expect(result.hasKey).toBe(true);
    expect(result.moldHasKey).toBe(true);
    expect(result.sections.at(-1)?.hasTopKey).toBe(true);
    expect(result.sections[1].hasBottomKey).toBe(true);
  });

  it("a keyless mold has no key in the top slab or at any joint", () => {
    const result = tall(keylessMold);
    expect(result.sections.length).toBeGreaterThan(1);
    expect(result.hasKey).toBe(false);
    expect(result.moldHasKey).toBe(false);
    expect(result.keyHeightFeet).toBe(0);
    for (const section of result.sections) {
      expect(section.hasTopKey).toBe(false);
      expect(section.hasBottomKey).toBe(false);
    }
    expect(result.errorMessage).toBeNull();
    // Nothing was "removed" — a missing key is this mold's normal state.
    expect(result.warnings.join(" ")).not.toMatch(/key/i);
  });

  it("takes nothing off the top slab for a key the mold never had", () => {
    const keyed = tall(keyedMold);
    const keyless = tall(keylessMold);
    // Template says 8": a keyless mold's flat slab is the full 8", not 8"
    // less a key height.
    expect(keyless.topSlabThicknessFeet).toBeCloseTo(8 / 12, 4);
    expect(keyless.topSlabThicknessFeet).toBe(keyed.topSlabThicknessFeet);
    expect(keyless.wallHeightFeet).toBe(keyed.wallHeightFeet);
    expect(keyless.totalHeightFeet).toBe(keyed.totalHeightFeet);
  });

  it("treats the stored key height as zero, whatever was typed", () => {
    const zeroKey = tall({ ...keylessMold, keyHeightFeet: 0 });
    const staleKey = tall({ ...keylessMold, keyHeightFeet: 1 });
    expect(staleKey.sections).toEqual(zeroKey.sections);
    expect(staleKey.topSlabThicknessFeet).toBe(zeroKey.topSlabThicknessFeet);
  });

  it("prints Key = No on the sheet", () => {
    const fieldMap = buildDrillSheetFieldMap(meta(), tall(keylessMold));
    expect(fieldMap.key).toBe("No");
  });
});

function meta(overrides: Partial<DrillSheetPreviewMeta> = {}): DrillSheetPreviewMeta {
  return {
    templateName: "Grease Trap",
    manholeNumber: "GT-1",
    contractor: "",
    project: "",
    date: "",
    castingName: "",
    insideDiameterFeet: 7.33,
    hasSteps: false,
    inspection: "",
    approvedBy: "",
    useBase: "",
    useRiser: "",
    brickAdjustment: "",
    topSlabOpeningInches: null,
    ...overrides,
  };
}

describe("diameter shown on drill sheets (Structure Molds → Sheet Shows)", () => {
  it("an 8' OD mold entered as 7.33' inside with 4\" walls is 8' outside", () => {
    expect(moldOutsideDiameterFeet(7.33, 4)).toBe(8);
    expect(moldOutsideDiameterFeet(4, 5)).toBe(4.83);
    expect(moldOutsideDiameterFeet(4, null)).toBeNull();
  });

  it("resolves to the inside diameter unless the mold is set to OD", () => {
    expect(resolveSheetDiameter(4, null)).toEqual({ feet: 4, basis: "INSIDE" });
    expect(
      resolveSheetDiameter(4, {
        wallThicknessInches: 5,
        sheetDiameterBasis: "INSIDE",
      }),
    ).toEqual({ feet: 4, basis: "INSIDE" });
    expect(
      resolveSheetDiameter(7.33, {
        wallThicknessInches: 4,
        sheetDiameterBasis: "OUTSIDE",
      }),
    ).toEqual({ feet: 8, basis: "OUTSIDE" });
  });

  it("falls back to the inside diameter when an OD mold has no wall thickness", () => {
    expect(
      resolveSheetDiameter(7.33, {
        wallThicknessInches: null,
        sheetDiameterBasis: "OUTSIDE",
      }),
    ).toEqual({ feet: 7.33, basis: "INSIDE" });
  });

  it("fills the sheet's diameter blanks with the outside diameter", () => {
    const result = computeDrillSheet(input(keyedMold, 110, [100]));
    const inside = buildDrillSheetFieldMap(meta(), result);
    expect(inside.diameter).toBe(`7'-4"`);
    expect(inside.diameter_feet_only).toBe("7.33");
    expect(inside["Manhole Diameter"]).toBe("7.33");

    const outside = buildDrillSheetFieldMap(
      meta({ sheetDiameter: { feet: 8, basis: "OUTSIDE" } }),
      result,
    );
    expect(outside.diameter).toBe(`8'-0"`);
    expect(outside.diameter_feet_only).toBe("8");
    expect(outside["Manhole Diameter"]).toBe("8");
  });
});

describe("saved sheets follow the mold registry as it is now", () => {
  // A sheet saved while the mold was still keyed and called by its ID.
  const sheet = {
    id: "s1",
    structureNumber: "GT-1",
    weight: null,
    structureTemplate: {
      name: "Grease Trap",
      agencyStandard: null,
      shape: "CIRCULAR",
      topSlabOpeningInches: null,
      rectPdfSet: null,
    },
    castings: [],
    openings: [],
    sections: [
      { role: "BASE", heightFeet: 4, label: null, hasBottomKey: false, hasTopKey: true },
      { role: "RISER", heightFeet: 3, label: null, hasBottomKey: true, hasTopKey: true },
    ],
    calc: {
      rimElevation: 110,
      lowestInvertFeet: 100,
      sumpFeet: 0.25,
      castingHeightFeet: 0.5,
      topSlabThicknessFeet: 0.6667,
      wallHeightFeet: 7,
      brickFeet: 0.33,
      hasKey: true,
      totalHeightFeet: 9,
      baseSlabThicknessFeet: 0.6667,
      wallPrice: 0,
      bootsPrice: 0,
      totalPrice: 0,
      errorMessage: null,
      contractorName: null,
      projectName: null,
      sheetDate: null,
      insideDiameterFeet: 7.33,
      hasSteps: false,
      inspection: null,
      approvedBy: null,
      useBase: null,
      useRiser: null,
      brickAdjustment: null,
    },
  } as unknown as DrillSheetWithDetail;

  const mold = (overrides: Partial<MoldSheetSettings>): MoldSheetSettings => ({
    insideDiameterFeet: 7.33,
    wallThicknessInches: 4,
    hasKey: true,
    sheetDiameterBasis: "INSIDE",
    ...overrides,
  });

  it("leaves the sheet as saved when its mold is unchanged or gone", () => {
    for (const molds of [[], [mold({})]]) {
      const detail = buildDrillSheetDetail(sheet, molds);
      expect(detail?.result.hasKey).toBe(true);
      expect(detail?.result.moldHasKey).toBe(true);
      expect(detail?.result.sections.map((s) => s.hasTopKey)).toEqual([true, true]);
      expect(detail?.meta.sheetDiameter).toEqual({ feet: 7.33, basis: "INSIDE" });
    }
  });

  it("drops every key once the mold is set to no key", () => {
    const detail = buildDrillSheetDetail(sheet, [mold({ hasKey: false })]);
    expect(detail?.result.hasKey).toBe(false);
    expect(detail?.result.moldHasKey).toBe(false);
    for (const section of detail?.result.sections ?? []) {
      expect(section.hasTopKey).toBe(false);
      expect(section.hasBottomKey).toBe(false);
    }
  });

  it("prints the outside diameter once the mold is set to OD", () => {
    const detail = buildDrillSheetDetail(sheet, [
      mold({ sheetDiameterBasis: "OUTSIDE" }),
    ]);
    expect(detail?.meta.insideDiameterFeet).toBe(7.33);
    expect(detail?.meta.sheetDiameter).toEqual({ feet: 8, basis: "OUTSIDE" });
  });

  it("only follows the mold matching the sheet's inside diameter", () => {
    const detail = buildDrillSheetDetail(sheet, [
      mold({ insideDiameterFeet: 4, hasKey: false, sheetDiameterBasis: "OUTSIDE" }),
    ]);
    expect(detail?.result.hasKey).toBe(true);
    expect(detail?.meta.sheetDiameter?.basis).toBe("INSIDE");
  });
});
