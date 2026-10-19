import { describe, expect, it } from "vitest";
import {
  buildRowsFromSetup,
  circularPipeTypeChoices,
  computeCircularOneOffRow,
  computeRectOneOffRow,
  createEmptySetup,
  findDuplicateStructureNumbers,
  missingSetupFields,
  nextFreeStructureNumber,
  resizeRowOpenings,
  type OneOffCircularOptions,
  type OneOffRectOptions,
  type OneOffSetup,
} from "@/lib/quotes/one-off-drill-sheets";
import { parseStructureConfigJson } from "@/lib/quotes/structure-workbook";
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
  });

  it("numbers after structures already taken with the same prefix", () => {
    expect(nextFreeStructureNumber("MH-", ["MH-1", "mh-7", "CB-9", "MH-2A"])).toBe(8);
    expect(nextFreeStructureNumber("MH-", [])).toBe(1);
  });

  it("pads and trims opening columns", () => {
    const rows = buildRowsFromSetup(filledSetup({ quantity: "1" }), 2);
    rows[0].openings[0].invert = "90";
    const wider = resizeRowOpenings(rows, 4);
    expect(wider[0].openings).toHaveLength(4);
    expect(wider[0].openings[0].invert).toBe("90");
    expect(resizeRowOpenings(wider, 1)[0].openings).toHaveLength(1);
  });

  it("labels circular pipe types as material plus type", () => {
    expect(circularPipeTypeChoices(circularOptions.pipeOpeningSizes)).toEqual([
      { label: "PVC SDR35", sizes: [8, 12] },
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
    expect(row.openings.map((cell) => cell.wall)).toEqual(["UP", "DOWN"]);
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
    expect(parsed?.openings.map((opening) => opening.wall)).toEqual(["UP", "DOWN"]);
  });

  it("asks for the missing pick instead of calculating", () => {
    const [row] = buildRowsFromSetup(filledSetup({ quantity: "1" }), 1);
    row.pipeSize = "";
    row.rimElevation = "100";
    row.openings[0].invert = "92";
    expect(computeCircularOneOffRow(row, circularOptions)).toMatchObject({
      ready: false,
      status: "Select a pipe type and size",
    });
  });
});
