import { describe, expect, it } from "vitest";
import {
  mapCircularSheetToWorkbookRow,
  mapRectSheetToWorkbookRow,
  type StoredSheetForImport,
} from "@/lib/quotes/job-sheet-import";
import { computeRectWorkbookRow } from "@/lib/quotes/rect-structure-workbook";

// Stored drill-sheet shape as the server action fetches it. Numbers stand in
// for Prisma Decimals (both satisfy `{ toString(): string }`).
function rectSheet(): StoredSheetForImport {
  return {
    structureTemplateId: "tmpl-rect",
    structureNumber: "STR-212",
    calc: {
      rimElevation: 164.03,
      lowestInvertFeet: 161.62,
      insideDiameterFeet: null,
      insideLengthFeet: 4,
      insideWidthFeet: 4,
    },
    dimensions: {
      insideLength: 4,
      insideWidth: 4,
      hasTopSlab: false,
      hasBaseSlab: true,
      baseAttached: true,
      topSlabOpeningLengthInches: null,
      topSlabOpeningWidthInches: null,
      topSlabOpeningSide: null,
    },
    castings: [{ castingProductId: "cast-1" }],
    openings: [
      {
        label: "A",
        wall: "UP",
        pipeMaterial: "RCP",
        pipeType: null,
        pipeSizeInches: 18,
        invertElevation: 161.62,
        angle: null,
        connectionType: null,
        horizontalPlacement: "FROM_LEFT",
        offsetInches: 20,
        openingWidthInches: 28,
      },
    ],
  };
}

describe("mapRectSheetToWorkbookRow", () => {
  it("carries every stored input into the workbook row", () => {
    const row = mapRectSheetToWorkbookRow(rectSheet());

    expect(row.structureNumber).toBe("STR-212");
    expect(row.templateId).toBe("tmpl-rect");
    expect(row.castingProductId).toBe("cast-1");
    expect(row.rimElevation).toBe("164.03");
    expect(row.lowInvertElevation).toBe("161.62");
    expect(row.insideLengthFeet).toBe("4");
    expect(row.hasTopSlab).toBe(false);
    expect(row.baseAttached).toBe(true);
    expect(row.qty).toBe("1");
    expect(row.openings).toHaveLength(1);
    const opening = row.openings[0];
    expect(opening.wall).toBe("UP");
    expect(opening.pipeMaterial).toBe("RCP");
    expect(opening.pipeSizeInches).toBe("18");
    expect(opening.invertElevation).toBe("161.62");
    expect(opening.placement).toBe("FROM_LEFT");
    expect(opening.offsetInches).toBe("20");
    // Stored width re-enters as the override so the saved width sticks.
    expect(opening.widthOverrideInches).toBe("28");
  });

  it("prices as a full-detail row through the workbook calculator", () => {
    const row = mapRectSheetToWorkbookRow(rectSheet());
    const computed = computeRectWorkbookRow(
      row,
      {
        templates: [
          {
            id: "tmpl-rect",
            name: "4x4 CB",
            agencyStandard: null,
            wallThicknessInches: 8,
            baseSlabThicknessInches: 8,
            topSlabThicknessInches: 0,
            minimumBrickInches: 4,
            sumpMode: "DEFAULT",
            sumpFixedInches: null,
            wallPricePerFoot: 100,
            minPricingHeightFeet: 0,
            topSlabPrice: 0,
            baseSlabPrice: 250,
            defaultCastingProductId: null,
            defaultCastingHeightFeet: null,
            presetSizes: [
              { id: "s1", insideLengthFeet: 4, insideWidthFeet: 4 },
            ],
          },
        ],
        castings: [{ id: "cast-1", name: "Frame", heightFeet: 0.75 }],
        openingSizes: [
          {
            pipeMaterial: "RCP",
            pipeSizeInches: 18,
            openingWidthInches: 28,
            openingHeightInches: 28,
            pipeWallThicknessInches: 2.5,
            pricePerOpening: 55,
          },
        ],
      },
      "FULL",
    );

    expect(computed.unitPrice).not.toBeNull();
    expect(computed.config?.detailLevel).toBe("FULL");
    expect(computed.config?.openings).toHaveLength(1);
  });
});

describe("mapCircularSheetToWorkbookRow", () => {
  it("carries stored openings with combined pipe descriptions", () => {
    const row = mapCircularSheetToWorkbookRow({
      structureTemplateId: "tmpl-circ",
      structureNumber: "MH-4",
      calc: {
        rimElevation: 120.5,
        lowestInvertFeet: 114.2,
        insideDiameterFeet: 4,
        insideLengthFeet: null,
        insideWidthFeet: null,
      },
      dimensions: null,
      castings: [{ castingProductId: "cast-2" }],
      openings: [
        {
          label: "A",
          wall: null,
          // Legacy split material/type recombines for the workbook.
          pipeMaterial: "PVC",
          pipeType: "SDR35",
          pipeSizeInches: 8,
          invertElevation: 114.2,
          angle: 45,
          connectionType: "KOR_N_SEAL",
          horizontalPlacement: null,
          offsetInches: null,
          openingWidthInches: null,
        },
      ],
    });

    expect(row.structureNumber).toBe("MH-4");
    expect(row.templateId).toBe("tmpl-circ");
    expect(row.diameterFeet).toBe("4");
    expect(row.rimElevation).toBe("120.5");
    expect(row.lowInvertElevation).toBe("114.2");
    expect(row.openings).toHaveLength(1);
    const opening = row.openings[0];
    expect(opening.pipeMaterial).toBe("PVC SDR35");
    expect(opening.pipeSizeInches).toBe("8");
    expect(opening.invertElevation).toBe("114.2");
    expect(opening.angleDegrees).toBe("45");
    expect(opening.connectionType).toBe("KOR_N_SEAL");
  });
});
