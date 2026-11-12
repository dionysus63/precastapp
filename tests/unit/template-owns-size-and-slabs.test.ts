import { describe, expect, it } from "vitest";
import {
  computeRectStructure,
  rectTemplateSlabs,
  type RectStructureInput,
  type RectTemplateConfig,
} from "@/lib/rect-structure";
import {
  commitWorkbookRowPrice,
  computeWorkbookRowPrice,
  createDefaultWorkbookRow,
  templateDiameterFeet,
  type StructureWorkbookOptions,
} from "@/lib/quotes/structure-workbook";
import {
  computeRectWorkbookRow,
  createDefaultRectDefaults,
  createDefaultRectRow,
  type RectWorkbookOptions,
} from "@/lib/quotes/rect-structure-workbook";
import {
  getImportTypeDefinition,
  parseStructureImportText,
} from "@/lib/structure-import";

// The structure template decides the inside size (round: its one mold's
// diameter; rectangular: its length x width) and which slabs exist. A
// structure can no longer pick another diameter or switch a slab off.

const RECT_TEMPLATE: RectTemplateConfig = {
  wallThicknessInches: 6,
  baseSlabThicknessInches: 8,
  topSlabThicknessInches: 8,
  minimumBrickInches: 4,
  sumpMode: "DEFAULT",
  sumpFixedInches: null,
  wallPricePerFoot: 100,
  minPricingHeightFeet: 0,
  topSlabPrice: 300,
  baseSlabPrice: 200,
};

function rectInput(template: RectTemplateConfig): RectStructureInput {
  return {
    rimElevation: 100,
    castingHeightFeet: 0.5,
    insideLengthFeet: 6,
    insideWidthFeet: 4,
    baseAttached: true,
    template,
    openingSizes: [],
    openings: [],
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: null,
  };
}

describe("rectangular slabs come from the template", () => {
  it("reads a slab as present when its thickness is above 0", () => {
    expect(rectTemplateSlabs(RECT_TEMPLATE)).toEqual({
      hasTopSlab: true,
      hasBaseSlab: true,
    });
    expect(
      rectTemplateSlabs({ ...RECT_TEMPLATE, baseSlabThicknessInches: 0 }),
    ).toEqual({ hasTopSlab: true, hasBaseSlab: false });
  });

  it("builds and prices exactly the template's slabs", () => {
    const both = computeRectStructure(rectInput(RECT_TEMPLATE));
    expect(both.hasTopSlab).toBe(true);
    expect(both.hasBaseSlab).toBe(true);
    expect(both.topSlabPrice).toBe(300);
    expect(both.baseSlabPrice).toBe(200);

    const openBottom = computeRectStructure(
      rectInput({ ...RECT_TEMPLATE, baseSlabThicknessInches: 0 }),
    );
    expect(openBottom.hasTopSlab).toBe(true);
    expect(openBottom.hasBaseSlab).toBe(false);
    expect(openBottom.baseSlabPrice).toBe(0);
    expect(openBottom.baseSlabThicknessFeet).toBe(0);
  });
});

const rectOptions: RectWorkbookOptions = {
  templates: [
    {
      id: "tpl-box",
      name: "4x6 Box",
      agencyStandard: null,
      ...RECT_TEMPLATE,
      wallPricePerFoot: 100,
      minPricingHeightFeet: 0,
      topSlabPrice: 300,
      baseSlabPrice: 200,
      defaultCastingProductId: null,
      defaultCastingHeightFeet: 0.5,
      presetSizes: [{ id: "s1", insideLengthFeet: 6, insideWidthFeet: 4 }],
    },
    {
      id: "tpl-box-open",
      name: "4x6 Box - No Base Slab",
      agencyStandard: null,
      ...RECT_TEMPLATE,
      baseSlabThicknessInches: 0,
      wallPricePerFoot: 100,
      minPricingHeightFeet: 0,
      topSlabPrice: 300,
      baseSlabPrice: 200,
      defaultCastingProductId: null,
      defaultCastingHeightFeet: 0.5,
      presetSizes: [{ id: "s2", insideLengthFeet: 6, insideWidthFeet: 4 }],
    },
  ],
  castings: [],
  openingSizes: [],
};

describe("rectangular quote workbook rows follow the template", () => {
  function row(templateId: string) {
    const defaults = {
      ...createDefaultRectDefaults(rectOptions.templates),
      templateId,
    };
    return {
      ...createDefaultRectRow(rectOptions.templates, [], defaults),
      rimElevation: "100",
      lowInvertElevation: "95",
    };
  }

  it("ignores a row that tries to drop a slab or change the size", () => {
    const computed = computeRectWorkbookRow(
      {
        ...row("tpl-box"),
        hasTopSlab: false,
        hasBaseSlab: false,
        insideLengthFeet: "9",
        insideWidthFeet: "9",
      },
      rectOptions,
      "QUOTE",
    );
    expect(computed.hasTopSlab).toBe(true);
    expect(computed.hasBaseSlab).toBe(true);
    expect(computed.insideLengthFeet).toBe("6");
    expect(computed.insideWidthFeet).toBe("4");
    expect(computed.config).toMatchObject({
      templateId: "tpl-box",
      hasTopSlab: true,
      hasBaseSlab: true,
      insideLengthFeet: 6,
      insideWidthFeet: 4,
    });
  });

  it("gets no base slab from the template that has none", () => {
    const created = row("tpl-box-open");
    expect(created.hasBaseSlab).toBe(false);
    expect(created.baseAttached).toBe(false);
    const computed = computeRectWorkbookRow(
      { ...created, hasBaseSlab: true, baseAttached: true },
      rectOptions,
      "QUOTE",
    );
    expect(computed.config).toMatchObject({
      hasTopSlab: true,
      hasBaseSlab: false,
      baseAttached: false,
      baseSlabPrice: 0,
    });
  });
});

const roundTemplate = {
  id: "tpl-mh4",
  name: "Standard Manhole 4'",
  agencyStandard: null,
  wallThicknessInches: 5,
  baseSlabThicknessInches: 8,
  topSlabThicknessInches: 8,
  minimumBrickInches: 4,
  connectionType: "KOR_N_SEAL" as const,
  sumpMode: "DEFAULT" as const,
  sumpFixedInches: null,
  openingToJointMinTopInches: 4,
  openingToJointMinBottomInches: 4,
  topSlabOpeningInches: null,
  defaultCastingProductId: null,
  defaultCastingHeightFeet: 0.5,
  diameters: [{ id: "d4", insideDiameterFeet: 4 }],
};

const roundOptions: StructureWorkbookOptions = {
  templates: [roundTemplate],
  castings: [],
  pipeOpeningSizes: [],
  diameterConfigs: [4, 5].map((feet) => ({
    label: null,
    insideDiameterFeet: feet,
    wallThicknessInches: 5,
    maxBaseHeightFeet: 4,
    maxRiserHeightFeet: 4,
    keyHeightFeet: 0.33,
    wallPricePerFoot: feet === 4 ? 135 : 180,
    basePrice: feet === 4 ? 530 : 700,
  })),
};

describe("round quote workbook rows follow the template's mold", () => {
  const base = {
    ...createDefaultWorkbookRow(roundOptions.templates),
    rimElevation: "100",
    lowInvertElevation: "94",
  };

  it("knows the one diameter a template dictates", () => {
    expect(templateDiameterFeet(roundTemplate)).toBe(4);
    expect(templateDiameterFeet(undefined)).toBeNull();
    expect(
      templateDiameterFeet({
        diameters: [{ insideDiameterFeet: 4 }, { insideDiameterFeet: 5 }],
      }),
    ).toBeNull();
  });

  it("prices at the template's diameter whatever the row says", () => {
    const asTemplate = computeWorkbookRowPrice(base, roundOptions);
    const typedFive = computeWorkbookRowPrice(
      { ...base, diameterFeet: "5" },
      roundOptions,
    );
    const blank = computeWorkbookRowPrice(
      { ...base, diameterFeet: "" },
      roundOptions,
    );
    expect(asTemplate.structureConfig?.diameterFeet).toBe(4);
    expect(typedFive.structureConfig?.diameterFeet).toBe(4);
    expect(blank.structureConfig?.diameterFeet).toBe(4);
    expect(typedFive.unitPrice).toBe(asTemplate.unitPrice);
    // The committed row shows the template's size.
    expect(
      commitWorkbookRowPrice({ ...base, diameterFeet: "5" }, roundOptions)
        .diameterFeet,
    ).toBe("4");
  });

  it("still lets a legacy template with several diameters pick one", () => {
    const legacy: StructureWorkbookOptions = {
      ...roundOptions,
      templates: [
        {
          ...roundTemplate,
          diameters: [
            { id: "d4", insideDiameterFeet: 4 },
            { id: "d5", insideDiameterFeet: 5 },
          ],
        },
      ],
    };
    expect(
      computeWorkbookRowPrice({ ...base, diameterFeet: "5" }, legacy)
        .structureConfig?.diameterFeet,
    ).toBe(5);
  });
});

describe("round template import: one diameter per template", () => {
  const columns = getImportTypeDefinition("circular-templates").columns.length;
  const line = (diameters: string) => {
    const cells = Array.from({ length: columns }, () => "");
    cells[0] = "SC Storm";
    cells[2] = "5";
    cells[3] = "8";
    cells[4] = "8";
    cells[5] = "2";
    cells[6] = "Kor-N-Seal";
    cells[7] = "Default";
    cells[9] = "6";
    cells[10] = "6";
    cells[11] = diameters;
    cells[13] = "Active";
    return cells.join("\t");
  };

  it("accepts one diameter and rejects a list", () => {
    const [one] = parseStructureImportText("circular-templates", line("4"));
    expect(one.issues).toEqual([]);
    const [many] = parseStructureImportText("circular-templates", line("4, 5"));
    expect(many.issues.join(" ")).toMatch(/one diameter \(one mold\)/);
  });
});
