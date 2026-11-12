import { describe, expect, it } from "vitest";
import { findLowInvertOpeningIndex } from "@/lib/drill-sheet";
import {
  buildDrillSheetDetail,
  type DrillSheetWithDetail,
} from "@/lib/drill-sheet-detail";
import {
  buildRowsFromSetup,
  computeCircularOneOffRow,
  createEmptySetup,
  type OneOffCircularOptions,
} from "@/lib/quotes/one-off-drill-sheets";

const circularOptions: OneOffCircularOptions = {
  templates: [
    {
      id: "tpl-sewer",
      name: "SC Sewer 4'Ø MH",
      agencyStandard: null,
      wallThicknessInches: 5,
      baseSlabThicknessInches: 8,
      topSlabThicknessInches: 8,
      minimumBrickInches: 4,
      connectionType: "KOR_N_SEAL",
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      openingToJointMinTopInches: 4,
      openingToJointMinBottomInches: 4,
      topSlabOpeningInches: null,
      defaultCastingProductId: "cast-frame",
      defaultCastingHeightFeet: 0.5,
      diameters: [{ id: "d4", insideDiameterFeet: 4 }],
    },
  ],
  castings: [{ id: "cast-frame", name: "Frame & Cover", heightFeet: 0.5 }],
  pipeOpeningSizes: [
    {
      pipeMaterial: "PVC",
      pipeSizeInches: 8,
      pipeType: "SDR35",
      hasBoot: true,
      holeDiameterInches: 14,
      pipeWallThicknessInches: 0.25,
      bootModel: "A",
      pricePerBoot: 50,
    },
  ],
  diameterConfigs: [
    {
      label: null,
      insideDiameterFeet: 4,
      wallThicknessInches: 5,
      maxBaseHeightFeet: 4,
      maxRiserHeightFeet: 4,
      keyHeightFeet: 0.33,
      wallPricePerFoot: 135,
      basePrice: 530,
    },
  ],
};

function quickBuildRow(openings: { invert: string; angle: string }[]) {
  const [row] = buildRowsFromSetup(
    {
      ...createEmptySetup("CIRCULAR"),
      templateId: "tpl-sewer",
      diameterFeet: "4",
      castingProductId: "cast-frame",
      pipeType: "PVC SDR35",
      pipeSize: "8",
      quantity: "1",
    },
    openings.length,
  );
  row.rimElevation = "100";
  openings.forEach((opening, index) => {
    row.openings[index] = { ...row.openings[index], ...opening };
  });
  return row;
}

describe("findLowInvertOpeningIndex", () => {
  it("picks the lowest invert", () => {
    expect(
      findLowInvertOpeningIndex([
        { invertElevation: 92.5, angleDegrees: 90 },
        { invertElevation: 92, angleDegrees: null },
        { invertElevation: null },
      ]),
    ).toBe(1);
  });

  it("picks exactly one opening when two inverts tie", () => {
    // Angle 0 / blank marks the outlet; the inlet keeps its own angle.
    expect(
      findLowInvertOpeningIndex([
        { invertElevation: 92, angleDegrees: 0 },
        { invertElevation: 92, angleDegrees: 90 },
      ]),
    ).toBe(0);
    expect(
      findLowInvertOpeningIndex([
        { invertElevation: 92, angleDegrees: 180 },
        { invertElevation: 92, angleDegrees: null },
      ]),
    ).toBe(1);
    // Nothing marks either one: the first wins.
    expect(
      findLowInvertOpeningIndex([
        { invertElevation: 92, angleDegrees: 90 },
        { invertElevation: 92, angleDegrees: 270 },
      ]),
    ).toBe(0);
  });

  it("returns -1 without any invert", () => {
    expect(findLowInvertOpeningIndex([{ invertElevation: null }])).toBe(-1);
    expect(findLowInvertOpeningIndex([])).toBe(-1);
  });
});

describe("drill sheet with two pipes at the same elevation", () => {
  it("keeps invert B as its own inlet on a Quick Build row", () => {
    const row = quickBuildRow([
      { invert: "92", angle: "" },
      { invert: "92", angle: "90" },
    ]);
    const result = computeCircularOneOffRow(row, circularOptions);
    expect(result.ready).toBe(true);

    const openings = result.circularSheet?.openings ?? [];
    expect(openings.map((opening) => opening.label)).toEqual(["A", "B"]);
    expect(openings.map((opening) => opening.isLowInvert)).toEqual([true, false]);
    expect(openings[1]).toMatchObject({ invertElevation: 92, angleDegrees: 90 });
    expect(result.circularSheet?.lowInvertElevation).toBe(92);
  });

  it("flags only the single outlet on a saved sheet", () => {
    const sheet = {
      structureNumber: "MH-1",
      jobId: "job-1",
      structureTemplateId: "tpl-sewer",
      weight: null,
      structureTemplate: {
        name: "SC Sewer 4'Ø MH",
        agencyStandard: null,
        shape: "CIRCULAR",
        topSlabOpeningInches: null,
        sheetPdf: null,
      },
      castings: [],
      sections: [
        {
          role: "BASE",
          heightFeet: 4,
          label: null,
          hasBottomKey: false,
          hasTopKey: false,
        },
      ],
      openings: [
        {
          label: "A",
          pipeMaterial: "PVC",
          pipeType: "SDR35",
          pipeSizeInches: 8,
          invertElevation: 92,
          angle: 0,
          connectionType: "KOR_N_SEAL",
          holeDiameterInches: 14,
          bootModel: "A",
          pricePerBoot: 50,
          topOfPipeFeet: null,
          bottomOfOpeningFeet: null,
          topOfOpeningFeet: null,
        },
        {
          label: "B",
          pipeMaterial: "PVC",
          pipeType: "SDR35",
          pipeSizeInches: 8,
          invertElevation: 92,
          angle: 90,
          connectionType: "KOR_N_SEAL",
          holeDiameterInches: 14,
          bootModel: "A",
          pricePerBoot: 50,
          topOfPipeFeet: null,
          bottomOfOpeningFeet: null,
          topOfOpeningFeet: null,
        },
      ],
      calc: {
        lowestInvertFeet: 92,
        sumpFeet: 0,
        rimElevation: 100,
        castingHeightFeet: 0.5,
        topSlabThicknessFeet: 8 / 12,
        wallHeightFeet: 4,
        brickFeet: 4 / 12,
        hasKey: false,
        totalHeightFeet: null,
        baseSlabThicknessFeet: 8 / 12,
        wallPrice: 0,
        bootsPrice: 0,
        totalPrice: 0,
        errorMessage: null,
        contractorName: null,
        projectName: null,
        sheetDate: null,
        insideDiameterFeet: 4,
        hasSteps: false,
        inspection: null,
        approvedBy: null,
        useBase: null,
        useRiser: null,
        brickAdjustment: null,
      },
    } as unknown as DrillSheetWithDetail;

    const detail = buildDrillSheetDetail(sheet, []);
    expect(detail).not.toBeNull();
    expect(detail?.result.openings.map((opening) => opening.isLowInvert)).toEqual([
      true,
      false,
    ]);
    expect(detail?.result.openings[1].angleDegrees).toBe(90);
  });
});
