import { describe, expect, it } from "vitest";
import {
  computeDrillSheet,
  formatWallHeightAdjust,
  normalizeWallHeightAdjustInches,
  type DrillSheetInput,
} from "@/lib/drill-sheet";
import {
  computeRectStructure,
  type RectStructureInput,
} from "@/lib/rect-structure";
import { parseDrillSheetPayloadData } from "@/lib/drill-sheet-persistence";
import { parseRectSheetPayloadData } from "@/lib/rect-sheet-persistence";
import { parseOneOffRow } from "@/lib/quotes/one-off-draft";
import {
  buildRowsFromSetup,
  circularRowFromSheet,
  computeCircularOneOffRow,
  createEmptySetup,
  isRowChanged,
  mergeCircularRow,
  stepRowWallHeight,
  wallHeightArrowState,
  type OneOffCircularOptions,
  type OneOffRow,
} from "@/lib/quotes/one-off-drill-sheets";
import { parseStructureConfigJson } from "@/lib/quotes/structure-workbook";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";
import {
  circularPayloadFromValues,
  rectPayloadFromValues,
} from "@/components/jobs/bulk-edit/bulk-edit-payloads";
import type { RectSheetFormValues } from "@/components/drill-sheets/rect-sheet-form";

// The up/down arrows between Wall Ht and Status in the Quick Build grid move
// a structure's wall 6" at a time by hand. The change rides on top of the
// calculated wall and comes out of (or goes back into) the brick.

// 4' manhole: rim 100, 8" PVC at invert 94 in a 14" hole (3" sump), 6" casting,
// 8" top slab. 6 - 0.5 - 0.6667 + 0.25 = 5.0833' to split: 4.5' wall + 7" brick.
function circularInput(
  overrides: Partial<DrillSheetInput> = {},
): DrillSheetInput {
  return {
    rimElevation: 100,
    castingHeightFeet: 0.5,
    diameter: {
      insideDiameterFeet: 4,
      maxBaseHeightFeet: 8,
      maxRiserHeightFeet: 4,
      keyHeightFeet: 0.33,
      wallPricePerFoot: 100,
      basePrice: 500,
      wallThicknessInches: 5,
    },
    template: {
      wallThicknessInches: 5,
      baseSlabThicknessInches: 8,
      topSlabThicknessInches: 8,
      minimumBrickInches: 4,
      connectionType: "KOR_N_SEAL",
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      openingToJointMinTopInches: 4,
      openingToJointMinBottomInches: 4,
    },
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
    openings: [
      {
        label: "A",
        pipeMaterial: "PVC SDR35",
        pipeSizeInches: 8,
        invertElevation: 94,
        angleDegrees: 0,
      },
    ],
    ...overrides,
  };
}

describe("manual wall height change: circular", () => {
  it("leaves the calculated wall alone when there is no change", () => {
    const auto = computeDrillSheet(circularInput());
    expect(auto.wallHeightFeet).toBe(4.5);
    expect(auto.brickFeet).toBeCloseTo(0.5833, 3);
    expect(auto.wallHeightAdjustInches).toBe(0);
    expect(computeDrillSheet(circularInput({ wallHeightAdjustInches: 0 }))).toEqual(
      auto,
    );
  });

  it("raises the wall 6\" and takes it out of the brick, without a brick warning", () => {
    const raised = computeDrillSheet(circularInput({ wallHeightAdjustInches: 6 }));
    expect(raised.wallHeightFeet).toBe(5);
    expect(raised.brickFeet).toBeCloseTo(0.0833, 3);
    expect(raised.wallHeightAdjustInches).toBe(6);
    expect(raised.errorMessage).toBeNull();
    // 1" of brick is under the 4" minimum, but that was the user's choice.
    expect(raised.warnings.join(" ")).not.toMatch(/minimum/);
    // The price follows the taller wall.
    expect(raised.wallPrice).toBe(500 + 5 * 100);
  });

  it("lowers the wall 6\" and gives it back to the brick", () => {
    const lowered = computeDrillSheet(
      circularInput({ wallHeightAdjustInches: -6 }),
    );
    expect(lowered.wallHeightFeet).toBe(4);
    expect(lowered.brickFeet).toBeCloseTo(1.0833, 3);
    expect(lowered.errorMessage).toBeNull();
    const total = lowered.sections.reduce((sum, s) => sum + s.heightFeet, 0);
    expect(total).toBe(4);
  });

  it("errors when the raised wall is taller than the rim allows", () => {
    const tooTall = computeDrillSheet(
      circularInput({ wallHeightAdjustInches: 12 }),
    );
    expect(tooTall.brickFeet).toBe(0);
    expect(tooTall.errorMessage).toMatch(/Wall raised 12" by hand is 5" too tall/);
  });

  it("snaps stray values to whole 6\" steps", () => {
    expect(normalizeWallHeightAdjustInches(6)).toBe(6);
    expect(normalizeWallHeightAdjustInches("-12")).toBe(-12);
    expect(normalizeWallHeightAdjustInches(7)).toBe(6);
    expect(normalizeWallHeightAdjustInches(2)).toBe(0);
    expect(Object.is(normalizeWallHeightAdjustInches(-2), 0)).toBe(true);
    expect(normalizeWallHeightAdjustInches("")).toBe(0);
    expect(normalizeWallHeightAdjustInches(undefined)).toBe(0);
    expect(normalizeWallHeightAdjustInches("abc")).toBe(0);
  });

  it("labels the change for the grid", () => {
    expect(formatWallHeightAdjust(0)).toBe("");
    expect(formatWallHeightAdjust(6)).toBe('+6"');
    expect(formatWallHeightAdjust(-12)).toBe('−12"');
  });
});

// Open-top box from the brick-target tests: 6.3333' to split, 6" minimum
// brick, so 5.5' of wall and 10" of brick when left alone.
function rectInput(overrides: Partial<RectStructureInput> = {}): RectStructureInput {
  return {
    rimElevation: 110,
    castingHeightFeet: 0,
    insideLengthFeet: 4,
    insideWidthFeet: 4,
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
    openingSizes: [
      {
        pipeMaterial: "RCP",
        pipeSizeInches: 12,
        openingWidthInches: 20,
        openingHeightInches: 20,
        pipeWallThicknessInches: 2,
        pricePerOpening: null,
      },
    ],
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

describe("manual wall height change: rectangular", () => {
  it("moves the wall 6\" either way against the brick", () => {
    const auto = computeRectStructure(rectInput());
    expect(auto.wallHeightFeet).toBe(5.5);
    expect(auto.brickFeet).toBeCloseTo(0.8333, 3);

    const raised = computeRectStructure(rectInput({ wallHeightAdjustInches: 6 }));
    expect(raised.wallHeightFeet).toBe(6);
    expect(raised.brickFeet).toBeCloseTo(0.3333, 3);
    expect(raised.wallHeightAdjustInches).toBe(6);
    expect(raised.errorMessage).toBeNull();
    expect(raised.sections.map((section) => section.heightFeet)).toEqual([6]);

    const lowered = computeRectStructure(
      rectInput({ wallHeightAdjustInches: -6 }),
    );
    expect(lowered.wallHeightFeet).toBe(5);
    expect(lowered.brickFeet).toBeCloseTo(1.3333, 3);
  });

  it("stacks on a manual brick target", () => {
    // 12" brick target alone drops the wall to 5'; +6" brings it back to 5.5'.
    const result = computeRectStructure(
      rectInput({ brickTargetInches: 12, wallHeightAdjustInches: 6 }),
    );
    expect(result.wallHeightFeet).toBe(5.5);
  });

  it("errors when the raised wall is taller than the rim allows", () => {
    const tooTall = computeRectStructure(
      rectInput({ wallHeightAdjustInches: 12 }),
    );
    expect(tooTall.errorMessage).toMatch(/Wall raised 12" by hand is 2" too tall/);
    expect(tooTall.brickFeet).toBe(0);
  });
});

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
  pipeOpeningSizes: circularInput().pipeOpeningSizes,
  diameterConfigs: [
    {
      label: null,
      insideDiameterFeet: 4,
      wallThicknessInches: 5,
      maxBaseHeightFeet: 8,
      maxRiserHeightFeet: 4,
      keyHeightFeet: 0.33,
      wallPricePerFoot: 100,
      basePrice: 500,
    },
  ],
};

function gridRow(): OneOffRow {
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
    2,
  );
  return {
    ...row,
    rimElevation: "100",
    openings: [{ ...row.openings[0], invert: "94" }, row.openings[1]],
  };
}

describe("Quick Build wall height arrows", () => {
  it("steps the row 6\" a click and recalculates", () => {
    const row = gridRow();
    expect(computeCircularOneOffRow(row, circularOptions)).toMatchObject({
      wallHeightFeet: 4.5,
      ready: true,
      status: "Ready",
    });

    const up = stepRowWallHeight(row, 1);
    expect(up.wallHeightAdjustInches).toBe(6);
    const raised = computeCircularOneOffRow(up, circularOptions);
    expect(raised).toMatchObject({ wallHeightFeet: 5, ready: true, status: "Ready" });
    expect(raised.brickFeet).toBeCloseTo(0.0833, 3);

    const down = stepRowWallHeight(stepRowWallHeight(up, -1), -1);
    expect(down.wallHeightAdjustInches).toBe(-6);
    expect(computeCircularOneOffRow(down, circularOptions).wallHeightFeet).toBe(4);
  });

  it("carries the change into the sheet that gets created", () => {
    const result = computeCircularOneOffRow(
      stepRowWallHeight(gridRow(), 1),
      circularOptions,
    );
    expect(result.config).toMatchObject({ wallHeightAdjustInches: 6 });
    // The config crosses to the server as JSON and must survive the parse.
    const parsed = parseStructureConfigJson(
      JSON.parse(JSON.stringify(result.config)),
    );
    expect(parsed?.wallHeightAdjustInches).toBe(6);
    // An untouched row stores nothing extra.
    const plain = computeCircularOneOffRow(gridRow(), circularOptions);
    expect(plain.config).not.toHaveProperty("wallHeightAdjustInches");
  });

  it("greys out an arrow that has nowhere to go", () => {
    const row = gridRow();
    // 7" of brick: one step up fits, a second does not.
    expect(
      wallHeightArrowState(row, computeCircularOneOffRow(row, circularOptions)),
    ).toEqual({ canRaise: true, canLower: true });
    const up = stepRowWallHeight(row, 1);
    expect(
      wallHeightArrowState(up, computeCircularOneOffRow(up, circularOptions)),
    ).toEqual({ canRaise: false, canLower: true });

    // Nothing calculated yet: nothing to move...
    const blank = { ...row, rimElevation: "" };
    expect(
      wallHeightArrowState(blank, computeCircularOneOffRow(blank, circularOptions)),
    ).toEqual({ canRaise: false, canLower: false });
    // ...but a change already made can always be backed out.
    expect(
      wallHeightArrowState(
        { ...blank, wallHeightAdjustInches: 6 },
        computeCircularOneOffRow(blank, circularOptions),
      ),
    ).toEqual({ canRaise: false, canLower: true });
  });

  it("keeps the change in a saved draft", () => {
    const row = stepRowWallHeight(gridRow(), -1);
    const restored = parseOneOffRow(JSON.parse(JSON.stringify(row)), 2);
    expect(restored?.wallHeightAdjustInches).toBe(-6);
    // Drafts from before the arrows have none.
    expect(
      parseOneOffRow(JSON.parse(JSON.stringify(gridRow())), 2),
    ).not.toHaveProperty("wallHeightAdjustInches");
  });
});

const savedCircular: DrillSheetFormValues = {
  templateId: "tpl-sewer",
  diameterId: "d4",
  castingProductId: "cast-frame",
  jobId: "job-1",
  manholeNumber: "MH-1",
  contractor: "Acme",
  project: "Main St",
  date: "2026-11-01",
  hasSteps: true,
  inspection: "",
  approvedBy: "",
  useBase: "",
  useRiser: "",
  brickAdjustment: "",
  rimElevation: "100",
  wallHeightAdjustInches: 6,
  openings: [
    {
      label: "A",
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: "8",
      invertElevation: "94",
      angle: "0",
      connectionType: "KOR_N_SEAL",
    },
  ],
};

describe("wall height change on saved sheets", () => {
  it("loads into the grid row and saves back", () => {
    const loaded = circularRowFromSheet(
      "js-1",
      savedCircular,
      circularOptions.templates,
    );
    expect(loaded.wallHeightAdjustInches).toBe(6);
    expect(isRowChanged(loaded, loaded)).toBe(false);

    const lowered = stepRowWallHeight(loaded, -1);
    expect(isRowChanged(lowered, loaded)).toBe(true);
    const merged = mergeCircularRow(
      savedCircular,
      lowered,
      circularOptions.templates,
      "2026-11-11",
    );
    expect("values" in merged && merged.values.wallHeightAdjustInches).toBe(0);
    // The rest of the sheet is untouched.
    expect("values" in merged && merged.values.hasSteps).toBe(true);
  });

  it("travels in the payloads the save actions read", () => {
    const circular = parseDrillSheetPayloadData(
      JSON.parse(JSON.stringify(circularPayloadFromValues(savedCircular))),
    );
    expect(circular.wallHeightAdjustInches).toBe(6);
    // A payload from before the arrows means no change.
    const { wallHeightAdjustInches: _dropped, ...older } = savedCircular;
    void _dropped;
    expect(
      parseDrillSheetPayloadData(circularPayloadFromValues(older))
        .wallHeightAdjustInches,
    ).toBe(0);

    const rectValues: RectSheetFormValues = {
      templateId: "tpl-cb",
      castingProductId: "",
      jobId: "",
      structureNumber: "CB-1",
      contractor: "",
      project: "",
      date: "2026-11-01",
      inspection: "",
      approvedBy: "",
      rimElevation: "110",
      brickTargetInches: "",
      wallHeightAdjustInches: -6,
      insideLengthFeet: "4",
      insideWidthFeet: "4",
      hasTopSlab: false,
      hasBaseSlab: true,
      baseAttached: true,
      topSlabOpeningLengthInches: "",
      topSlabOpeningWidthInches: "",
      topSlabOpeningSide: "UP",
      maxPickWeightLbs: "",
      sections: [],
      openings: [],
    };
    const rect = parseRectSheetPayloadData(
      JSON.parse(JSON.stringify(rectPayloadFromValues(rectValues))),
    );
    expect(rect.wallHeightAdjustInches).toBe(-6);
  });
});
