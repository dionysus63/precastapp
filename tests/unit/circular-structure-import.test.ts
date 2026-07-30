import path from "node:path";
import { describe, expect, it } from "vitest";
import xlsx from "xlsx";
import {
  circularGridFromTsv,
  parseCircularStructureImport,
} from "@/lib/quotes/circular-structure-import";
import type { StructureWorkbookOptions } from "@/lib/quotes/structure-workbook";

const options: StructureWorkbookOptions = {
  templates: [
    {
      id: "tpl-sewer",
      name: "SC Sewer",
      agencyStandard: null,
      wallThicknessInches: 8,
      baseSlabThicknessInches: 8,
      topSlabThicknessInches: 16,
      minimumBrickInches: 4,
      connectionType: "KOR_N_SEAL",
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      openingToJointMinTopInches: 4,
      openingToJointMinBottomInches: 4,
      topSlabOpeningInches: null,
      defaultCastingProductId: "cast-default",
      defaultCastingHeightFeet: 0.25,
      diameters: [
        { id: "d4", insideDiameterFeet: 4 },
        { id: "d5", insideDiameterFeet: 5 },
      ],
    },
  ],
  castings: [
    { id: "cast-default", name: "Default Frame", heightFeet: 0.25 },
    { id: "cast-solid", name: "Solid Cover", heightFeet: 0.25 },
  ],
  pipeOpeningSizes: [],
  diameterConfigs: [
    {
      label: null,
      insideDiameterFeet: 4,
      wallThicknessInches: 4,
      maxBaseHeightFeet: 4.5,
      maxRiserHeightFeet: 5,
      keyHeightFeet: 0.42,
      wallPricePerFoot: 135,
      basePrice: 530,
    },
  ],
};

const HEADER = [
  "Structure #",
  "Template",
  "Diameter (ft)",
  "Rim Elev",
  "Low Invert (quote-only)",
  "Casting",
  "Opening 1 Material",
  "Opening 1 Size (in)",
  "Opening 1 Invert",
  "Opening 1 Angle (deg)",
  "Opening 2 Material",
  "Opening 2 Size (in)",
  "Opening 2 Invert",
  "Opening 2 Angle (deg)",
];

describe("parseCircularStructureImport", () => {
  it("imports a quote-only manhole with penetrations", () => {
    const result = parseCircularStructureImport(
      [
        HEADER,
        ["MH-1", "SC Sewer", 4, 100.25, 92.5, "", "PVC SDR35", 8, "", "", "PVC SDR35", 8, "", ""],
      ],
      options,
    );

    expect(result.errors).toEqual([]);
    const structure = result.structures[0];
    expect(structure).toMatchObject({
      detailLevel: "QUOTE",
      pipeCount: 2,
      diameterFeet: 4,
    });
    expect(structure.row).toMatchObject({
      structureNumber: "MH-1",
      templateId: "tpl-sewer",
      diameterFeet: "4",
      rimElevation: "100.25",
      lowInvertElevation: "92.5",
      castingProductId: "cast-default",
      pipeMaterial: "PVC SDR35",
      bootCount: "2",
      qty: "1",
    });
    expect(structure.row.penetrations).toHaveLength(2);
  });

  it("imports full drill-sheet openings with angles", () => {
    const result = parseCircularStructureImport(
      [
        HEADER,
        ["MH-2", "sc sewer", 5, 101.4, "", "Solid Cover", "PVC SDR35", 8, 93.1, 0, "RCP", 12, 93.2, 180],
      ],
      options,
    );

    expect(result.errors).toEqual([]);
    const structure = result.structures[0];
    expect(structure.detailLevel).toBe("FULL");
    expect(structure.row.castingProductId).toBe("cast-solid");
    expect(structure.row.openings).toHaveLength(2);
    expect(structure.row.openings[0]).toMatchObject({
      label: "A",
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: "8",
      invertElevation: "93.1",
      angleDegrees: "0",
    });
    expect(structure.row.openings[1]).toMatchObject({
      label: "B",
      angleDegrees: "180",
    });
  });

  it("rejects diameters the template does not offer", () => {
    const result = parseCircularStructureImport(
      [HEADER, ["MH-3", "SC Sewer", 6, 100, 95, "", "", "", "", ""]],
      options,
    );
    expect(result.structures).toHaveLength(0);
    expect(result.errors[0].message).toContain("does not offer a 6' diameter");
    expect(result.errors[0].message).toContain("4', 5'");
  });

  it("rejects mixed full and quote-only pipes on one structure", () => {
    const result = parseCircularStructureImport(
      [
        HEADER,
        ["MH-4", "SC Sewer", 4, 100, "", "", "PVC SDR35", 8, 93.1, "", "RCP", 12, "", ""],
      ],
      options,
    );
    expect(result.errors[0].message).toContain("Mixes full openings");
  });

  it("rejects unknown templates and duplicate numbers", () => {
    const result = parseCircularStructureImport(
      [
        HEADER,
        ["MH-5", "Nope", 4, 100, 95, "", "", "", "", ""],
        ["MH-6", "SC Sewer", 4, 100, 95, "", "", "", "", ""],
        ["MH-6", "SC Sewer", 4, 100, 95, "", "", "", "", ""],
      ],
      options,
    );
    expect(result.structures.map((s) => s.structureNumber)).toEqual(["MH-6"]);
    expect(result.errors.map((e) => e.message.split(" ")[0])).toEqual([
      "No",
      "Duplicate",
    ]);
  });

  it("reports when no header row exists", () => {
    const result = parseCircularStructureImport(
      circularGridFromTsv("just\tsome\tcells"),
      options,
    );
    expect(result.headerFound).toBe(false);
  });

  it("parses the shipped template's Example sheet end to end", () => {
    // Guards the generator (scripts/generate-circular-import-template.mjs)
    // and the parser against drifting apart.
    const workbook = xlsx.readFile(
      path.resolve("public", "templates", "circular-structure-import.xlsx"),
    );
    const grid = xlsx.utils.sheet_to_json<(string | number | null)[]>(
      workbook.Sheets["Example"],
      { header: 1, defval: "" },
    );

    const result = parseCircularStructureImport(grid, options);

    expect(result.headerFound).toBe(true);
    expect(result.errors).toEqual([]);
    expect(
      result.structures.map((structure) => ({
        number: structure.structureNumber,
        detail: structure.detailLevel,
        pipes: structure.pipeCount,
      })),
    ).toEqual([
      { number: "MH-1", detail: "QUOTE", pipes: 2 },
      { number: "MH-2", detail: "FULL", pipes: 3 },
      { number: "DMH-1", detail: "QUOTE", pipes: 0 },
    ]);
    expect(
      result.structures[1].row.openings.map(
        (opening) => opening.angleDegrees,
      ),
    ).toEqual(["0", "180", "90"]);
  });
});
