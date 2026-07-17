import path from "node:path";
import { describe, expect, it } from "vitest";
import xlsx from "xlsx";
import {
  gridFromTsv,
  parseRectStructureImport,
} from "@/lib/quotes/rect-structure-import";
import type { RectWorkbookOptions } from "@/lib/quotes/rect-structure-workbook";

const options: RectWorkbookOptions = {
  templates: [
    {
      id: "tpl-4x4",
      name: "4' x 4' Standard CB",
      agencyStandard: null,
      wallThicknessInches: 6,
      baseSlabThicknessInches: 8,
      topSlabThicknessInches: 8,
      minimumBrickInches: 4,
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      wallPricePerFoot: 250,
      minPricingHeightFeet: 4,
      topSlabPrice: 300,
      baseSlabPrice: 200,
      defaultCastingProductId: "cast-default",
      defaultCastingHeightFeet: 0.25,
      presetSizes: [{ id: "s1", insideLengthFeet: 4, insideWidthFeet: 4 }],
    },
    {
      id: "tpl-open",
      name: "4'x2.5' CB - No Top or Bottom",
      agencyStandard: null,
      wallThicknessInches: 6,
      baseSlabThicknessInches: 0,
      topSlabThicknessInches: 0,
      minimumBrickInches: 4,
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      wallPricePerFoot: 250,
      minPricingHeightFeet: 4,
      topSlabPrice: 0,
      baseSlabPrice: 0,
      defaultCastingProductId: null,
      defaultCastingHeightFeet: null,
      presetSizes: [{ id: "s2", insideLengthFeet: 4, insideWidthFeet: 2.5 }],
    },
  ],
  castings: [
    { id: "cast-default", name: "Default Frame", heightFeet: 0.25 },
    { id: "cast-grate", name: "24x24 Grate", heightFeet: 0.25 },
  ],
  openingSizes: [
    {
      pipeMaterial: "RCP",
      pipeSizeInches: 15,
      openingWidthInches: 22,
      openingHeightInches: 22,
      pipeWallThicknessInches: null,
      pricePerOpening: 50,
    },
  ],
};

const HEADER = [
  "Structure #",
  "Template",
  "Rim Elev",
  "Low Invert (quote-only)",
  "Casting",
  "Opening 1 Wall",
  "Opening 1 Material",
  "Opening 1 Size (in)",
  "Opening 1 Invert",
  "Opening 1 Offset from Left (in)",
  "Opening 2 Wall",
  "Opening 2 Material",
  "Opening 2 Size (in)",
  "Opening 2 Invert",
  "Opening 2 Offset from Left (in)",
];

describe("parseRectStructureImport", () => {
  it("imports a quote-only structure with penetrations", () => {
    const result = parseRectStructureImport(
      [
        HEADER,
        ["CB-1", "4' x 4' Standard CB", 100.25, 96.5, "", "", "RCP", 15, "", "", "", "PVC", 6, "", ""],
      ],
      options,
    );

    expect(result.errors).toEqual([]);
    expect(result.structures).toHaveLength(1);
    const structure = result.structures[0];
    expect(structure.detailLevel).toBe("QUOTE");
    expect(structure.pipeCount).toBe(2);
    expect(structure.row).toMatchObject({
      structureNumber: "CB-1",
      templateId: "tpl-4x4",
      insideLengthFeet: "4",
      insideWidthFeet: "4",
      rimElevation: "100.25",
      lowInvertElevation: "96.5",
      hasTopSlab: true,
      hasBaseSlab: true,
      baseAttached: true,
      castingProductId: "cast-default",
      qty: "1",
    });
    expect(structure.row.penetrations).toHaveLength(2);
    expect(structure.row.penetrations[0]).toMatchObject({
      pipeMaterial: "RCP",
      pipeSizeInches: "15",
      qty: "1",
    });
    // PVC 6" isn't in the block-out catalog — warn, don't block.
    expect(structure.warnings.join(" ")).toContain('6" PVC');
  });

  it("imports a full drill-sheet structure with walls, inverts, and offsets", () => {
    const result = parseRectStructureImport(
      [
        HEADER,
        ["CB-2", "4' x 4' standard cb", 101.1, "", "24x24 Grate", "Up", "RCP", 15, 96.8, "", "S", "RCP", 15, 96.9, 18],
      ],
      options,
    );

    expect(result.errors).toEqual([]);
    const structure = result.structures[0];
    expect(structure.detailLevel).toBe("FULL");
    expect(structure.pipeCount).toBe(2);
    expect(structure.row.castingProductId).toBe("cast-grate");
    expect(structure.row.openings).toHaveLength(2);
    expect(structure.row.openings[0]).toMatchObject({
      label: "A",
      wall: "UP",
      pipeMaterial: "RCP",
      pipeSizeInches: "15",
      invertElevation: "96.8",
      placement: "CENTERED",
      offsetInches: "",
    });
    // "S" compass alias maps to the Down wall; offset switches placement.
    expect(structure.row.openings[1]).toMatchObject({
      wall: "DOWN",
      placement: "FROM_LEFT",
      offsetInches: "18",
    });
  });

  it("takes slab presence from the template", () => {
    const result = parseRectStructureImport(
      [HEADER, ["DB-1", "4'x2.5' CB - No Top or Bottom", 98, 95, "", "", "", "", "", ""]],
      options,
    );
    expect(result.structures[0].row).toMatchObject({
      hasTopSlab: false,
      hasBaseSlab: false,
      baseAttached: false,
      castingProductId: "",
    });
  });

  it("rejects unknown templates, duplicate numbers, and bad walls", () => {
    const result = parseRectStructureImport(
      [
        HEADER,
        ["CB-1", "No Such Template", 100, 96, "", "", "", "", "", ""],
        ["CB-2", "4' x 4' Standard CB", 100, 96, "", "", "", "", "", ""],
        ["CB-2", "4' x 4' Standard CB", 100, 96, "", "", "", "", "", ""],
        ["CB-3", "4' x 4' Standard CB", 100, "", "", "Sideways", "RCP", 15, 96, ""],
      ],
      options,
    );

    expect(result.structures.map((s) => s.structureNumber)).toEqual(["CB-2"]);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].message).toContain("No rectangular template");
    expect(result.errors[1].message).toContain("Duplicate");
    expect(result.errors[2].message).toContain('unknown wall "Sideways"');
  });

  it("rejects structures that mix full openings with quote-only pipes", () => {
    const result = parseRectStructureImport(
      [
        HEADER,
        ["CB-4", "4' x 4' Standard CB", 100, "", "", "Up", "RCP", 15, 96.5, "", "", "PVC", 6, "", ""],
      ],
      options,
    );
    expect(result.structures).toHaveLength(0);
    expect(result.errors[0].message).toContain("Mixes full openings");
  });

  it("survives reordered and extra columns and blank rows", () => {
    const result = parseRectStructureImport(
      [
        ["ignore me"],
        ["Notes", "Template", "Structure #", "Rim Elev", "Opening 1 Material", "Opening 1 Size (in)", "Low Invert (quote-only)"],
        ["engineer says hi", "4' x 4' Standard CB", "CB-9", 100, "RCP", 15, 96],
        [],
      ],
      options,
    );
    expect(result.headerFound).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.structures[0]).toMatchObject({
      structureNumber: "CB-9",
      detailLevel: "QUOTE",
      pipeCount: 1,
    });
  });

  it("reports when no header row exists", () => {
    const result = parseRectStructureImport(
      gridFromTsv("just\tsome\tcells"),
      options,
    );
    expect(result.headerFound).toBe(false);
  });

  it("parses the shipped template's Example sheet end to end", () => {
    // Guards the generator (scripts/generate-rect-import-template.mjs) and
    // the parser against drifting apart.
    const workbook = xlsx.readFile(
      path.resolve("public", "templates", "rect-structure-import.xlsx"),
    );
    const grid = xlsx.utils.sheet_to_json<(string | number | null)[]>(
      workbook.Sheets["Example"],
      { header: 1, defval: "" },
    );

    const result = parseRectStructureImport(grid, options);

    expect(result.headerFound).toBe(true);
    expect(result.errors).toEqual([]);
    expect(
      result.structures.map((structure) => ({
        number: structure.structureNumber,
        detail: structure.detailLevel,
        pipes: structure.pipeCount,
      })),
    ).toEqual([
      { number: "CB-1", detail: "QUOTE", pipes: 3 },
      { number: "CB-2", detail: "FULL", pipes: 3 },
      { number: "DB-1", detail: "QUOTE", pipes: 0 },
    ]);
    const cb2 = result.structures[1];
    expect(cb2.row.openings.map((opening) => opening.wall)).toEqual([
      "UP",
      "DOWN",
      "LEFT",
    ]);
    expect(cb2.row.openings[2]).toMatchObject({
      placement: "FROM_LEFT",
      offsetInches: "18",
    });
  });
});
