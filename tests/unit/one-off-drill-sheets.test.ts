import { describe, expect, it } from "vitest";
import {
  buildRowsFromSetup,
  circularPipeTypeChoices,
  computeCircularOneOffRow,
  computeRectOneOffRow,
  circularRowFromSheet,
  createEmptySetup,
  findDuplicateStructureNumbers,
  isRowChanged,
  mergeCircularRow,
  mergeRectRow,
  missingSetupFields,
  withTemplateDiameter,
  nextFreeStructureNumber,
  rectRowFromSheet,
  resizeRowOpenings,
  setOpeningPipeType,
  setOpeningSpecial,
  setOpeningWall,
  type OneOffCircularOptions,
  type OneOffRectOptions,
  type OneOffSetup,
} from "@/lib/quotes/one-off-drill-sheets";
import type { RectSheetFormValues } from "@/components/drill-sheets/rect-sheet-form";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";
import {
  parseStructureConfigJson,
  templateDiameterFeet,
} from "@/lib/quotes/structure-workbook";
import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";

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
    {
      pipeMaterial: "PVC",
      pipeSizeInches: 12,
      pipeType: "SDR35",
      hasBoot: true,
      holeDiameterInches: 18,
      pipeWallThicknessInches: 0.4,
      bootModel: "B",
      pricePerBoot: 70,
    },
    {
      pipeMaterial: "RCP",
      pipeSizeInches: 15,
      pipeType: "",
      hasBoot: false,
      holeDiameterInches: 24,
      pipeWallThicknessInches: 2.25,
      bootModel: null,
      pricePerBoot: null,
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

const rectOptions: OneOffRectOptions = {
  templates: [
    {
      id: "tpl-cb",
      name: "Type C Inlet",
      agencyStandard: null,
      wallThicknessInches: 6,
      baseSlabThicknessInches: 8,
      topSlabThicknessInches: 8,
      minimumBrickInches: 4,
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      wallPricePerFoot: 300,
      minPricingHeightFeet: 0,
      topSlabPrice: 200,
      baseSlabPrice: 200,
      defaultCastingProductId: "cast-grate",
      defaultCastingHeightFeet: 0.5,
      presetSizes: [{ id: "s1", insideLengthFeet: 4, insideWidthFeet: 3 }],
    },
  ],
  castings: [{ id: "cast-grate", name: "Grate", heightFeet: 0.5 }],
  openingSizes: [
    {
      pipeMaterial: "RCP",
      pipeSizeInches: 15,
      openingWidthInches: 24,
      openingHeightInches: 24,
      pipeWallThicknessInches: 2.25,
      pricePerOpening: 40,
    },
  ],
};

function filledSetup(patch: Partial<OneOffSetup> = {}): OneOffSetup {
  return {
    ...createEmptySetup("CIRCULAR"),
    templateId: "tpl-sewer",
    diameterFeet: "4",
    castingProductId: "cast-frame",
    pipeType: "PVC SDR35",
    pipeSize: "8",
    quantity: "3",
    ...patch,
  };
}

describe("one-off setup", () => {
  it("requires template, diameter, casting, pipe type, size and quantity", () => {
    expect(missingSetupFields("CIRCULAR", createEmptySetup("CIRCULAR"))).toEqual([
      "template",
      "diameter",
      "casting",
      "pipe type",
      "pipe size",
      "quantity",
    ]);
    expect(missingSetupFields("CIRCULAR", filledSetup())).toEqual([]);
    // Rect templates carry their own size: no diameter pick.
    expect(
      missingSetupFields("RECTANGULAR", filledSetup({ diameterFeet: "" })),
    ).toEqual([]);
    expect(missingSetupFields("CIRCULAR", filledSetup({ quantity: "0" }))).toEqual([
      "quantity",
    ]);
  });

  it("takes the diameter from the template's one mold", () => {
    // Nothing to pick: a blank or stale diameter follows the template.
    expect(
      withTemplateDiameter(filledSetup({ diameterFeet: "" }), circularOptions.templates)
        .diameterFeet,
    ).toBe("4");
    expect(
      withTemplateDiameter(filledSetup({ diameterFeet: "6" }), circularOptions.templates)
        .diameterFeet,
    ).toBe("4");
    // A legacy template that still lists several keeps the user's pick.
    const legacy = [
      {
        ...circularOptions.templates[0],
        diameters: [
          { id: "d4", insideDiameterFeet: 4 },
          { id: "d5", insideDiameterFeet: 5 },
        ],
      },
    ];
    expect(
      withTemplateDiameter(filledSetup({ diameterFeet: "5" }), legacy).diameterFeet,
    ).toBe("5");
    expect(templateDiameterFeet(legacy[0])).toBeNull();
    expect(templateDiameterFeet(circularOptions.templates[0])).toBe(4);
  });

  it("builds one numbered row per quantity with the setup picks", () => {
    const rows = buildRowsFromSetup(filledSetup({ startNumber: "4" }), 2);
    expect(rows.map((row) => row.structureNumber)).toEqual(["MH-4", "MH-5", "MH-6"]);
    expect(rows[0]).toMatchObject({
      templateId: "tpl-sewer",
      castingProductId: "cast-frame",
      pipeType: "PVC SDR35",
      pipeSize: "8",
    });
    expect(rows[0].openings).toHaveLength(2);
    // Every inlet starts at the setup's pipe and can be changed alone.
    expect(rows[0].openings.map((cell) => [cell.pipeType, cell.pipeSize])).toEqual([
      ["PVC SDR35", "8"],
      ["PVC SDR35", "8"],
    ]);
  });

  it("changes one inlet's pipe type and clears a size it doesn't come in", () => {
    const [row] = buildRowsFromSetup(filledSetup({ quantity: "1" }), 2);
    const choices = circularPipeTypeChoices(circularOptions.pipeOpeningSizes);
    const retyped = setOpeningPipeType(row, 1, "RCP", choices);
    expect(retyped.openings[0]).toMatchObject({ pipeType: "PVC SDR35", pipeSize: "8" });
    expect(retyped.openings[1]).toMatchObject({ pipeType: "RCP", pipeSize: "" });
    expect(computeCircularOneOffRow(retyped, circularOptions).status).toBe(
      "Enter rim and inverts",
    );
    // Back to a type that comes in 8": the size stays.
    const sized = { ...retyped, openings: [retyped.openings[0], { ...retyped.openings[1], pipeSize: "15" }] };
    expect(setOpeningPipeType(sized, 1, "PVC SDR35", choices).openings[1]).toMatchObject({
      pipeType: "PVC SDR35",
      pipeSize: "",
    });
    expect(setOpeningPipeType(row, 0, "PVC SDR35", choices).openings[0].pipeSize).toBe("8");
  });

  it("numbers after structures already taken with the same prefix", () => {
    expect(nextFreeStructureNumber("MH-", ["MH-1", "mh-7", "CB-9", "MH-2A"])).toBe(8);
    expect(nextFreeStructureNumber("MH-", [])).toBe(1);
  });

  it("starts inlet A's angle typed in as 0 and leaves the others blank", () => {
    const [row] = buildRowsFromSetup(filledSetup({ quantity: "1" }), 3);
    expect(row.openings.map((cell) => cell.angle)).toEqual(["0", "", ""]);
    // An inlet column added later starts blank, and A keeps what was typed.
    row.openings[0].angle = "45";
    const [wider] = resizeRowOpenings([row], 4);
    expect(wider.openings.map((cell) => cell.angle)).toEqual(["45", "", "", ""]);
  });

  it("starts rect inlets on the Down, Up, Left and Right walls in turn", () => {
    const [row] = buildRowsFromSetup(
      { ...createEmptySetup("RECTANGULAR"), quantity: "1" },
      5,
    );
    expect(row.openings.map((cell) => cell.wall)).toEqual([
      "DOWN",
      "UP",
      "LEFT",
      "RIGHT",
      "DOWN",
    ]);
  });

  it("pads and trims opening columns", () => {
    const rows = buildRowsFromSetup(filledSetup({ quantity: "1" }), 2);
    rows[0].openings[0].invert = "90";
    const wider = resizeRowOpenings(rows, 4);
    expect(wider[0].openings).toHaveLength(4);
    expect(wider[0].openings[0].invert).toBe("90");
    // A new inlet column starts at the row's default pipe.
    expect(wider[0].openings[3]).toMatchObject({ pipeType: "PVC SDR35", pipeSize: "8" });
    expect(resizeRowOpenings(wider, 1)[0].openings).toHaveLength(1);
  });

  it("labels circular pipe types as material plus type", () => {
    expect(circularPipeTypeChoices(circularOptions.pipeOpeningSizes)).toEqual([
      { label: "PVC SDR35", sizes: [8, 12] },
      { label: "RCP", sizes: [15] },
    ]);
  });

  it("flags structure numbers used twice", () => {
    expect(findDuplicateStructureNumbers(["MH-1", "mh-1 ", "MH-2", ""])).toEqual([
      "MH-1",
    ]);
  });
});

describe("one-off row calculation", () => {
  it("makes a circular row ready once rim and an invert are in", () => {
    const [row] = buildRowsFromSetup(filledSetup({ quantity: "1" }), 2);
    expect(computeCircularOneOffRow(row, circularOptions).ready).toBe(false);

    row.rimElevation = "100";
    row.openings[0].invert = "92";
    row.openings[1] = { ...row.openings[1], invert: "92.5", angle: "180" };
    const result = computeCircularOneOffRow(row, circularOptions);
    expect(result.ready).toBe(true);
    expect(result.wallHeightFeet).toBeGreaterThan(0);

    // The saved config must survive the server's reparse unchanged in shape.
    const parsed = parseStructureConfigJson(
      JSON.parse(JSON.stringify(result.config)),
    );
    expect(parsed?.detailLevel).toBe("DRILL_SHEET");
    expect(parsed?.openings?.map((opening) => opening.label)).toEqual(["A", "B"]);
    expect(parsed?.openings?.[1]).toMatchObject({
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: 8,
      angleDegrees: 180,
    });
  });

  it("gives each inlet its own pipe type and size on the saved sheet", () => {
    const [row] = buildRowsFromSetup(filledSetup({ quantity: "1" }), 2);
    row.rimElevation = "100";
    row.openings[0].invert = "92";
    row.openings[1] = {
      ...row.openings[1],
      invert: "92.5",
      pipeType: "RCP",
      pipeSize: "15",
    };
    const result = computeCircularOneOffRow(row, circularOptions);
    expect(result.ready).toBe(true);
    const parsed = parseStructureConfigJson(JSON.parse(JSON.stringify(result.config)));
    expect(
      parsed?.openings?.map((opening) => [opening.pipeMaterial, opening.pipeSizeInches]),
    ).toEqual([
      ["PVC SDR35", 8],
      ["RCP", 15],
    ]);

    // A blank inlet pipe falls back to the row's default.
    row.openings[1] = { ...row.openings[1], pipeType: "", pipeSize: "" };
    const fallback = parseStructureConfigJson(
      computeCircularOneOffRow(row, circularOptions).config,
    );
    expect(
      fallback?.openings?.map((opening) => [opening.pipeMaterial, opening.pipeSizeInches]),
    ).toEqual([
      ["PVC SDR35", 8],
      ["PVC SDR35", 8],
    ]);
  });

  it("keeps the column letter when an earlier invert is blank", () => {
    const [row] = buildRowsFromSetup(filledSetup({ quantity: "1" }), 2);
    row.rimElevation = "100";
    row.openings[1].invert = "92";
    const result = computeCircularOneOffRow(row, circularOptions);
    const parsed = parseStructureConfigJson(result.config);
    expect(parsed?.openings?.map((opening) => opening.label)).toEqual(["B"]);
  });

  it("makes a rectangular row ready with walls from the grid", () => {
    const [row] = buildRowsFromSetup(
      {
        ...createEmptySetup("RECTANGULAR"),
        templateId: "tpl-cb",
        castingProductId: "cast-grate",
        pipeType: "RCP",
        pipeSize: "15",
        quantity: "1",
      },
      2,
    );
    // Inlet A starts on the Down wall and B on the Up wall.
    expect(row.openings.map((cell) => cell.wall)).toEqual(["DOWN", "UP"]);
    row.rimElevation = "100";
    row.openings[0].invert = "95";
    row.openings[1].invert = "95.5";
    const result = computeRectOneOffRow(row, rectOptions);
    expect(result.ready).toBe(true);

    const parsed = parseRectStructureConfigJson(
      JSON.parse(JSON.stringify(result.config)),
    );
    expect(parsed?.detailLevel).toBe("FULL");
    expect(parsed?.insideLengthFeet).toBe(4);
    expect(parsed?.openings.map((opening) => opening.wall)).toEqual(["DOWN", "UP"]);
  });

  it("asks for the missing pick instead of calculating", () => {
    const [row] = buildRowsFromSetup(filledSetup({ quantity: "1" }), 2);
    row.rimElevation = "100";
    row.openings[0].invert = "92";
    row.openings[1].invert = "93";
    row.openings[1].pipeSize = "";
    // Inlet B still has the row default to fall back on.
    expect(computeCircularOneOffRow(row, circularOptions).ready).toBe(true);

    row.pipeSize = "";
    expect(computeCircularOneOffRow(row, circularOptions)).toMatchObject({
      ready: false,
      status: "Pick a pipe for inlet B",
    });
    row.openings[0].pipeType = "";
    row.pipeType = "";
    expect(computeCircularOneOffRow(row, circularOptions)).toMatchObject({
      ready: false,
      status: "Pick a pipe for inlets A, B",
    });
  });
});

const savedCircular: DrillSheetFormValues = {
  templateId: "tpl-sewer",
  diameterId: "d4",
  unmatchedDiameterFeet: null,
  castingProductId: "cast-frame",
  jobId: "job-1",
  manholeNumber: "MH-1",
  contractor: "Acme",
  project: "Main St",
  date: "",
  hasSteps: true,
  inspection: "Town",
  approvedBy: "",
  useBase: "",
  useRiser: "",
  brickAdjustment: "",
  rimElevation: "100",
  openings: [
    {
      label: "A",
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: "8",
      invertElevation: "92",
      angle: "0",
      connectionType: "KOR_N_SEAL",
    },
    {
      label: "B",
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: "12",
      invertElevation: "92.5",
      angle: "180",
      connectionType: "KOR_N_SEAL",
    },
  ],
};

describe("editing saved sheets", () => {
  it("loads a circular sheet into a grid row", () => {
    const row = circularRowFromSheet("js-1", savedCircular, circularOptions.templates);
    expect(row).toMatchObject({
      id: "js-1",
      structureNumber: "MH-1",
      diameterFeet: "4",
      pipeType: "PVC SDR35",
      pipeSize: "8",
      rimElevation: "100",
    });
    expect(
      row.openings.map((cell) => [cell.invert, cell.pipeType, cell.pipeSize, cell.angle]),
    ).toEqual([
      ["92", "PVC SDR35", "8", "0"],
      ["92.5", "PVC SDR35", "12", "180"],
    ]);
    expect(isRowChanged(row, row)).toBe(false);
  });

  it("keeps what the grid doesn't show and each opening's own pipe", () => {
    const loaded = circularRowFromSheet("js-1", savedCircular, circularOptions.templates);
    const edited = {
      ...loaded,
      rimElevation: "101",
      openings: loaded.openings.map((cell, index) =>
        index === 1 ? { ...cell, invert: "93" } : cell,
      ),
    };
    expect(isRowChanged(edited, loaded)).toBe(true);

    const merged = mergeCircularRow(
      savedCircular,
      edited,
      circularOptions.templates,
      "2026-10-19",
    );
    if ("error" in merged) throw new Error(merged.error);
    expect(merged.values).toMatchObject({
      rimElevation: "101",
      hasSteps: true,
      inspection: "Town",
      contractor: "Acme",
      date: "2026-10-19",
    });
    // B keeps its 12" pipe because the row's pipe pick didn't change.
    expect(merged.values.openings[1]).toMatchObject({
      label: "B",
      pipeSizeInches: "12",
      invertElevation: "93",
    });
  });

  it("fills a blank diameter from the template but never resizes a saved one", () => {
    const loaded = circularRowFromSheet("js-1", savedCircular, circularOptions.templates);
    const blank = mergeCircularRow(
      savedCircular,
      { ...loaded, diameterFeet: "" },
      circularOptions.templates,
      "2026-10-19",
    );
    if ("error" in blank) throw new Error(blank.error);
    expect(blank.values.diameterId).toBe("d4");
    // Saved at 6' on a template that is 4': the user must decide.
    expect(
      mergeCircularRow(
        savedCircular,
        { ...loaded, diameterFeet: "6" },
        circularOptions.templates,
        "2026-10-19",
      ),
    ).toEqual({ error: "Select a diameter" });
  });

  it("saves an inlet's changed pipe and drops cleared inlets", () => {
    const loaded = circularRowFromSheet("js-1", savedCircular, circularOptions.templates);
    const edited = {
      ...loaded,
      openings: loaded.openings.map((cell, index) =>
        index === 0
          ? { ...cell, invert: "" }
          : { ...cell, pipeType: "RCP", pipeSize: "15" },
      ),
    };
    expect(isRowChanged(edited, loaded)).toBe(true);
    const merged = mergeCircularRow(
      { ...savedCircular, date: "2026-01-02" },
      edited,
      circularOptions.templates,
      "2026-10-19",
    );
    if ("error" in merged) throw new Error(merged.error);
    expect(merged.values.date).toBe("2026-01-02");
    expect(merged.values.openings).toHaveLength(1);
    expect(merged.values.openings[0]).toMatchObject({
      label: "B",
      pipeMaterial: "RCP",
      pipeSizeInches: "15",
      connectionType: "KOR_N_SEAL",
    });
  });

  it("keeps a rect sheet's own size, placements and splits", () => {
    const saved: RectSheetFormValues = {
      templateId: "tpl-cb",
      castingProductId: "cast-grate",
      jobId: "job-1",
      structureNumber: "CB-1",
      contractor: "Acme",
      project: "Main St",
      date: "2026-01-02",
      inspection: "",
      approvedBy: "",
      rimElevation: "100",
      brickTargetInches: "",
      insideLengthFeet: "5",
      insideWidthFeet: "4",
      hasTopSlab: true,
      hasBaseSlab: true,
      baseAttached: true,
      topSlabOpeningLengthInches: "",
      topSlabOpeningWidthInches: "",
      topSlabOpeningSide: "UP",
      maxPickWeightLbs: "",
      sections: [
        { id: "s1", heightFeet: "2", topKey: true },
        { id: "s2", heightFeet: "3", topKey: false },
      ],
      openings: [
        {
          id: "o1",
          label: "A",
          wall: "LEFT",
          pipeMaterial: "RCP",
          pipeSizeInches: "15",
          invertElevation: "95",
          angle: "",
          placement: "FROM_LEFT",
          offsetInches: "6",
          widthOverrideInches: "26",
        },
      ],
    };
    const loaded = rectRowFromSheet("js-2", saved, rectOptions.openingSizes);
    expect(loaded).toMatchObject({ insideLengthFeet: "5", pipeType: "RCP" });
    expect(loaded.openings[0].wall).toBe("LEFT");
    // 26" saved against a 24" standard opening shows up as Widen.
    expect(loaded.openings[0]).toMatchObject({ special: "WIDEN", widenInches: "26" });
    expect(computeRectOneOffRow(loaded, rectOptions).ready).toBe(true);

    const edited = {
      ...loaded,
      openings: [{ ...loaded.openings[0], invert: "95.25" }],
    };
    const merged = mergeRectRow(saved, edited, loaded, rectOptions.templates, "2026-10-19");
    if ("error" in merged) throw new Error(merged.error);
    expect(merged.values.insideLengthFeet).toBe("5");
    expect(merged.values.sections).toHaveLength(2);
    expect(merged.values.openings[0]).toMatchObject({
      wall: "LEFT",
      placement: "FROM_LEFT",
      offsetInches: "6",
      widthOverrideInches: "26",
      invertElevation: "95.25",
    });

    // Clearing Special puts the opening back to the catalog width; the
    // placement stays.
    const cleared = setOpeningSpecial(loaded, 0, "");
    expect(cleared.openings[0]).toMatchObject({ special: "", widenInches: "" });
    expect(isRowChanged(cleared, loaded)).toBe(true);
    const remerged = mergeRectRow(saved, cleared, loaded, rectOptions.templates, "2026-10-19");
    if ("error" in remerged) throw new Error(remerged.error);
    expect(remerged.values.openings[0]).toMatchObject({
      widthOverrideInches: "",
      placement: "FROM_LEFT",
    });

    // A wider Widen is a change and is what gets saved.
    const wider = {
      ...loaded,
      openings: [{ ...loaded.openings[0], widenInches: "30" }],
    };
    expect(isRowChanged(wider, loaded)).toBe(true);
    const widened = mergeRectRow(saved, wider, loaded, rectOptions.templates, "2026-10-19");
    if ("error" in widened) throw new Error(widened.error);
    expect(widened.values.openings[0].widthOverrideInches).toBe("30");
  });

  it("loads a saved width at the catalog size as no special", () => {
    const loaded = rectRowFromSheet(
      "js-3",
      {
        ...rectSheetValues(),
        openings: [{ ...rectSheetValues().openings[0], widthOverrideInches: "24" }],
      },
      rectOptions.openingSizes,
    );
    expect(loaded.openings[0]).toMatchObject({ special: "", widenInches: "" });
  });
});

function rectSheetValues(): RectSheetFormValues {
  return {
    templateId: "tpl-cb",
    castingProductId: "cast-grate",
    jobId: "job-1",
    structureNumber: "CB-3",
    contractor: "Acme",
    project: "Main St",
    date: "2026-01-02",
    inspection: "",
    approvedBy: "",
    rimElevation: "100",
    brickTargetInches: "",
    insideLengthFeet: "4",
    insideWidthFeet: "3",
    hasTopSlab: true,
    hasBaseSlab: true,
    baseAttached: true,
    topSlabOpeningLengthInches: "",
    topSlabOpeningWidthInches: "",
    topSlabOpeningSide: "UP",
    maxPickWeightLbs: "",
    sections: [],
    openings: [
      {
        id: "o1",
        label: "A",
        wall: "UP",
        pipeMaterial: "RCP",
        pipeSizeInches: "15",
        invertElevation: "95",
        angle: "",
        placement: "CENTERED",
        offsetInches: "",
        widthOverrideInches: "",
      },
    ],
  };
}

describe("Quick Build rect opening specials", () => {
  function rectRow() {
    const [row] = buildRowsFromSetup(
      {
        ...createEmptySetup("RECTANGULAR"),
        templateId: "tpl-cb",
        castingProductId: "cast-grate",
        pipeType: "RCP",
        pipeSize: "15",
        quantity: "1",
      },
      2,
    );
    row.rimElevation = "100";
    row.openings[0].invert = "95";
    row.openings[1].invert = "95.5";
    return row;
  }

  it("widens one opening and leaves the other at the catalog width", () => {
    const row = {
      ...setOpeningSpecial(rectRow(), 0, "WIDEN"),
    };
    row.openings[0].widenInches = "36";
    const result = computeRectOneOffRow(row, rectOptions);
    expect(result.ready).toBe(true);

    const widths = result.rectSheet?.openings.map((opening) => [
      opening.openingWidthInches,
      opening.openingHeightInches,
    ]);
    expect(widths).toEqual([
      [36, 24],
      [24, 24],
    ]);
    const parsed = parseRectStructureConfigJson(
      JSON.parse(JSON.stringify(result.config)),
    );
    expect(parsed?.openings.map((opening) => opening.widthOverrideInches ?? null)).toEqual([
      36,
      null,
    ]);
  });

  it("asks for the width, a whole number, wider than standard", () => {
    const row = setOpeningSpecial(rectRow(), 1, "WIDEN");
    const status = (widenInches: string) =>
      computeRectOneOffRow(
        {
          ...row,
          openings: [row.openings[0], { ...row.openings[1], widenInches }],
        },
        rectOptions,
      );

    expect(status("")).toMatchObject({
      ready: false,
      status: "Enter the Widen width for inlet B",
    });
    expect(status("30.5")).toMatchObject({
      ready: false,
      status: "Widen B: width must be a whole number of inches",
    });
    expect(status("31").ready).toBe(true);
    expect(status("24")).toMatchObject({
      ready: false,
      status: 'Widen B: enter more than the standard 24" width',
    });
    expect(status("30").ready).toBe(true);
  });

  it("ignores a special on an inlet with no invert", () => {
    const row = setOpeningSpecial(rectRow(), 1, "WIDEN");
    row.openings[1].invert = "";
    expect(computeRectOneOffRow(row, rectOptions).ready).toBe(true);
  });
});

// Move slides an opening off the middle of its wall. The template here is
// 4' x 3' inside, so the Up and Down walls are 48" long and the side walls
// 36"; a 15" RCP takes a 24" opening.
describe("Quick Build rect opening Move", () => {
  function rectRow() {
    const [row] = buildRowsFromSetup(
      {
        ...createEmptySetup("RECTANGULAR"),
        templateId: "tpl-cb",
        castingProductId: "cast-grate",
        pipeType: "RCP",
        pipeSize: "15",
        quantity: "1",
      },
      2,
    );
    row.rimElevation = "100";
    row.openings[0].invert = "95";
    row.openings[1].invert = "95.5";
    // These tests read the sheet from the Up wall, whatever a new row starts at.
    row.openings[0].wall = "UP";
    row.openings[1].wall = "DOWN";
    return row;
  }

  function moved(
    index: number,
    patch: { moveDirection?: "LEFT" | "RIGHT" | "UP" | "DOWN" | ""; moveInches?: string },
    from = rectRow(),
  ) {
    const row = setOpeningSpecial(from, index, "MOVE");
    return {
      ...row,
      openings: row.openings.map((cell, cellIndex) =>
        cellIndex === index ? { ...cell, ...patch } : cell,
      ),
    };
  }

  it("moves one opening and leaves the other in the middle", () => {
    // Inlet A is on the Up wall.
    const result = computeRectOneOffRow(
      moved(0, { moveDirection: "LEFT", moveInches: "6" }),
      rectOptions,
    );
    expect(result.ready).toBe(true);
    expect(
      result.rectSheet?.openings.map((opening) => [
        opening.placement,
        opening.offsetInches,
        opening.leftEdgeInches,
        opening.rightEdgeInches,
      ]),
    ).toEqual([
      ["FROM_LEFT", 18, 6, 30],
      ["CENTERED", null, 12, 36],
    ]);
    // The sheet that gets created carries the same place.
    const parsed = parseRectStructureConfigJson(
      JSON.parse(JSON.stringify(result.config)),
    );
    expect(parsed?.openings[0]).toMatchObject({
      placement: "FROM_LEFT",
      offsetInches: 18,
    });
    // The width stays the catalog's.
    expect(parsed?.openings[0].widthOverrideInches ?? null).toBeNull();
  });

  it("asks for the direction, then the inches", () => {
    expect(computeRectOneOffRow(moved(0, {}), rectOptions)).toMatchObject({
      ready: false,
      status: "Pick which way to move inlet A",
    });
    expect(
      computeRectOneOffRow(moved(0, { moveDirection: "RIGHT" }), rectOptions),
    ).toMatchObject({
      ready: false,
      status: "Enter how many inches to move inlet A",
    });
    for (const moveInches of ["0", "-3", "six"]) {
      expect(
        computeRectOneOffRow(
          moved(0, { moveDirection: "RIGHT", moveInches }),
          rectOptions,
        ),
      ).toMatchObject({
        ready: false,
        status: "Move A: enter the inches as a number above 0",
      });
    }
  });

  it("stops the opening at the end of the wall", () => {
    // 48" wall, 24" opening: 12" each way.
    const atEnd = computeRectOneOffRow(
      moved(0, { moveDirection: "RIGHT", moveInches: "12" }),
      rectOptions,
    );
    expect(atEnd.ready).toBe(true);
    expect(atEnd.rectSheet?.openings[0]).toMatchObject({
      leftEdgeInches: 24,
      rightEdgeInches: 48,
    });
    expect(
      computeRectOneOffRow(
        moved(0, { moveDirection: "RIGHT", moveInches: "13" }),
        rectOptions,
      ),
    ).toMatchObject({
      ready: false,
      status: 'Move A: 12" is the most it can move before the end of the wall',
    });
  });

  it("offers up and down on a side wall, and drops a direction the new wall lacks", () => {
    const onUp = moved(0, { moveDirection: "LEFT", moveInches: "4" });
    const onLeft = setOpeningWall(onUp, 0, "LEFT");
    expect(onLeft.openings[0]).toMatchObject({
      wall: "LEFT",
      special: "MOVE",
      moveDirection: "",
      moveInches: "4",
    });
    expect(computeRectOneOffRow(onLeft, rectOptions)).toMatchObject({
      ready: false,
      status: "Pick which way to move inlet A",
    });
    // Up to Down keeps Left: both walls have it.
    expect(setOpeningWall(onUp, 0, "DOWN").openings[0].moveDirection).toBe("LEFT");

    // The side walls are 36" long: 4" up from the middle is 14" from the top.
    const up = computeRectOneOffRow(
      moved(0, { moveDirection: "UP", moveInches: "4" }, setOpeningWall(rectRow(), 0, "RIGHT")),
      rectOptions,
    );
    expect(up.ready).toBe(true);
    expect(up.rectSheet?.openings[0]).toMatchObject({
      placement: "FROM_LEFT",
      offsetInches: 14,
    });
  });

  it("clears the Move inputs when another special is picked", () => {
    const row = moved(0, { moveDirection: "LEFT", moveInches: "6" });
    expect(setOpeningSpecial(row, 0, "WIDEN").openings[0]).toMatchObject({
      special: "WIDEN",
      moveDirection: "",
      moveInches: "",
    });
    expect(setOpeningSpecial(row, 0, "").openings[0]).toMatchObject({
      special: "",
      moveDirection: "",
      moveInches: "",
    });
  });

  it("shows a saved sheet's off-center opening as a Move and saves it back", () => {
    // Down wall, 18" from its left face as seen from inside the box: on the
    // sheet that is 6" right of the middle.
    const saved: RectSheetFormValues = {
      ...rectSheetValues(),
      openings: [
        {
          ...rectSheetValues().openings[0],
          wall: "DOWN",
          placement: "FROM_LEFT",
          offsetInches: "18",
        },
      ],
    };
    const loaded = rectRowFromSheet("js-4", saved, rectOptions.openingSizes);
    expect(loaded.openings[0]).toMatchObject({
      special: "MOVE",
      moveDirection: "RIGHT",
      moveInches: "6",
    });
    const preview = computeRectOneOffRow(loaded, rectOptions);
    expect(preview.ready).toBe(true);
    expect(preview.rectSheet?.openings[0]).toMatchObject({
      placement: "FROM_LEFT",
      offsetInches: 18,
    });

    // Unchanged, it merges back exactly as saved.
    expect(isRowChanged(loaded, loaded)).toBe(false);
    const same = mergeRectRow(saved, loaded, loaded, rectOptions.templates, "2026-11-20");
    if ("error" in same) throw new Error(same.error);
    expect(same.values.openings[0]).toMatchObject({
      placement: "FROM_LEFT",
      offsetInches: "18",
    });

    // A longer move, the other way.
    const edited = {
      ...loaded,
      openings: [
        { ...loaded.openings[0], moveDirection: "LEFT" as const, moveInches: "8" },
      ],
    };
    expect(isRowChanged(edited, loaded)).toBe(true);
    const merged = mergeRectRow(saved, edited, loaded, rectOptions.templates, "2026-11-20");
    if ("error" in merged) throw new Error(merged.error);
    expect(merged.values.openings[0]).toMatchObject({
      wall: "DOWN",
      placement: "FROM_RIGHT",
      offsetInches: "16",
      widthOverrideInches: "",
    });

    // Taking the Move off puts the opening back in the middle.
    const cleared = setOpeningSpecial(loaded, 0, "");
    expect(isRowChanged(cleared, loaded)).toBe(true);
    const centered = mergeRectRow(saved, cleared, loaded, rectOptions.templates, "2026-11-20");
    if ("error" in centered) throw new Error(centered.error);
    expect(centered.values.openings[0]).toMatchObject({
      placement: "CENTERED",
      offsetInches: "",
    });
  });

  it("adds a Move to a saved sheet's centered opening", () => {
    const saved = rectSheetValues();
    const loaded = rectRowFromSheet("js-5", saved, rectOptions.openingSizes);
    expect(loaded.openings[0]).toMatchObject({ special: "", moveDirection: "" });
    const edited = moved(0, { moveDirection: "RIGHT", moveInches: "5" }, loaded);
    const merged = mergeRectRow(saved, edited, loaded, rectOptions.templates, "2026-11-20");
    if ("error" in merged) throw new Error(merged.error);
    expect(merged.values.openings[0]).toMatchObject({
      placement: "FROM_RIGHT",
      offsetInches: "19",
    });
  });

  it("leaves an opening against a wall end where it was saved", () => {
    const saved: RectSheetFormValues = {
      ...rectSheetValues(),
      openings: [{ ...rectSheetValues().openings[0], placement: "TOUCH_RIGHT" }],
    };
    const loaded = rectRowFromSheet("js-6", saved, rectOptions.openingSizes);
    expect(loaded.openings[0]).toMatchObject({ special: "", moveDirection: "" });
    const edited = {
      ...loaded,
      openings: [{ ...loaded.openings[0], invert: "95.25" }],
    };
    const merged = mergeRectRow(saved, edited, loaded, rectOptions.templates, "2026-11-20");
    if ("error" in merged) throw new Error(merged.error);
    expect(merged.values.openings[0]).toMatchObject({
      placement: "TOUCH_RIGHT",
      invertElevation: "95.25",
    });
  });
});

describe("Quick Build rect opening Widen + Move", () => {
  function rectRow() {
    const [row] = buildRowsFromSetup(
      {
        ...createEmptySetup("RECTANGULAR"),
        templateId: "tpl-cb",
        castingProductId: "cast-grate",
        pipeType: "RCP",
        pipeSize: "15",
        quantity: "1",
      },
      2,
    );
    row.rimElevation = "100";
    row.openings[0].invert = "95";
    row.openings[1].invert = "95.5";
    // These tests read the sheet from the Up wall, whatever a new row starts at.
    row.openings[0].wall = "UP";
    row.openings[1].wall = "DOWN";
    return row;
  }

  function both(
    patch: {
      widenInches?: string;
      moveDirection?: "LEFT" | "RIGHT" | "UP" | "DOWN" | "";
      moveInches?: string;
    },
    from = rectRow(),
  ) {
    const row = setOpeningSpecial(from, 0, "WIDEN_MOVE");
    return {
      ...row,
      openings: row.openings.map((cell, cellIndex) =>
        cellIndex === 0 ? { ...cell, ...patch } : cell,
      ),
    };
  }

  it("widens the opening and moves it", () => {
    // Up wall, 48" long: a 30" opening 6" left of the middle.
    const result = computeRectOneOffRow(
      both({ widenInches: "30", moveDirection: "LEFT", moveInches: "6" }),
      rectOptions,
    );
    expect(result.ready).toBe(true);
    expect(result.rectSheet?.openings[0]).toMatchObject({
      placement: "FROM_LEFT",
      offsetInches: 18,
      leftEdgeInches: 3,
      rightEdgeInches: 33,
    });
    const parsed = parseRectStructureConfigJson(
      JSON.parse(JSON.stringify(result.config)),
    );
    expect(parsed?.openings[0]).toMatchObject({
      widthOverrideInches: 30,
      placement: "FROM_LEFT",
      offsetInches: 18,
    });
  });

  it("asks for the width first, then the direction and inches", () => {
    expect(computeRectOneOffRow(both({}), rectOptions)).toMatchObject({
      ready: false,
      status: "Enter the Widen width for inlet A",
    });
    expect(
      computeRectOneOffRow(both({ widenInches: "24" }), rectOptions),
    ).toMatchObject({
      ready: false,
      status: 'Widen A: enter more than the standard 24" width',
    });
    expect(
      computeRectOneOffRow(both({ widenInches: "30" }), rectOptions),
    ).toMatchObject({
      ready: false,
      status: "Pick which way to move inlet A",
    });
    expect(
      computeRectOneOffRow(
        both({ widenInches: "30", moveDirection: "LEFT" }),
        rectOptions,
      ),
    ).toMatchObject({
      ready: false,
      status: "Enter how many inches to move inlet A",
    });
  });

  it("counts the room to move from the wider opening", () => {
    // 48" wall, 30" opening: 9" each way, where the standard 24" had 12".
    expect(
      computeRectOneOffRow(
        both({ widenInches: "30", moveDirection: "RIGHT", moveInches: "9" }),
        rectOptions,
      ).ready,
    ).toBe(true);
    expect(
      computeRectOneOffRow(
        both({ widenInches: "30", moveDirection: "RIGHT", moveInches: "10" }),
        rectOptions,
      ),
    ).toMatchObject({
      ready: false,
      status: 'Move A: 9" is the most it can move before the end of the wall',
    });
    expect(
      computeRectOneOffRow(
        both({ widenInches: "48", moveDirection: "RIGHT", moveInches: "1" }),
        rectOptions,
      ),
    ).toMatchObject({
      ready: false,
      status: "Move A: the opening already fills the Up wall",
    });
  });

  it("keeps what carries over when the special changes", () => {
    const row = both({ widenInches: "30", moveDirection: "LEFT", moveInches: "6" });
    expect(setOpeningSpecial(row, 0, "WIDEN").openings[0]).toMatchObject({
      special: "WIDEN",
      widenInches: "30",
      moveDirection: "",
      moveInches: "",
    });
    expect(setOpeningSpecial(row, 0, "MOVE").openings[0]).toMatchObject({
      special: "MOVE",
      widenInches: "",
      moveDirection: "LEFT",
      moveInches: "6",
    });
    const moveOnly = setOpeningSpecial(row, 0, "MOVE");
    expect(setOpeningSpecial(moveOnly, 0, "WIDEN_MOVE").openings[0]).toMatchObject({
      special: "WIDEN_MOVE",
      widenInches: "",
      moveDirection: "LEFT",
      moveInches: "6",
    });
  });

  it("shows a saved wide, off-center opening as Widen + Move and saves it back", () => {
    const saved: RectSheetFormValues = {
      ...rectSheetValues(),
      openings: [
        {
          ...rectSheetValues().openings[0],
          wall: "UP",
          widthOverrideInches: "30",
          placement: "FROM_RIGHT",
          offsetInches: "19",
        },
      ],
    };
    const loaded = rectRowFromSheet("js-7", saved, rectOptions.openingSizes);
    expect(loaded.openings[0]).toMatchObject({
      special: "WIDEN_MOVE",
      widenInches: "30",
      moveDirection: "RIGHT",
      moveInches: "5",
    });
    expect(isRowChanged(loaded, loaded)).toBe(false);
    const same = mergeRectRow(saved, loaded, loaded, rectOptions.templates, "2026-11-20");
    if ("error" in same) throw new Error(same.error);
    expect(same.values.openings[0]).toMatchObject({
      widthOverrideInches: "30",
      placement: "FROM_RIGHT",
      offsetInches: "19",
    });

    // Down to plain Widen: the width stays, the opening goes back to the middle.
    const widenOnly = setOpeningSpecial(loaded, 0, "WIDEN");
    expect(isRowChanged(widenOnly, loaded)).toBe(true);
    const centered = mergeRectRow(saved, widenOnly, loaded, rectOptions.templates, "2026-11-20");
    if ("error" in centered) throw new Error(centered.error);
    expect(centered.values.openings[0]).toMatchObject({
      widthOverrideInches: "30",
      placement: "CENTERED",
      offsetInches: "",
    });

    // Down to plain Move: the place stays, the width goes back to the catalog's.
    const moveOnly = setOpeningSpecial(loaded, 0, "MOVE");
    const narrow = mergeRectRow(saved, moveOnly, loaded, rectOptions.templates, "2026-11-20");
    if ("error" in narrow) throw new Error(narrow.error);
    expect(narrow.values.openings[0]).toMatchObject({
      widthOverrideInches: "",
      placement: "FROM_RIGHT",
      offsetInches: "19",
    });
  });
});
