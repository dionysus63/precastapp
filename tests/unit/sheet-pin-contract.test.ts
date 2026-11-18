import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  buildDrillSheetFieldMap,
  fillDrillSheetTemplatePdf,
  listTemplatePdfFields,
} from "@/lib/drill-sheet-template-pdf";
import { buildDrillSheetPdfHtml } from "@/lib/drill-sheet-pdf-html";
import {
  buildRowsFromSetup,
  computeCircularOneOffRow,
  createEmptySetup,
  type OneOffCircularOptions,
} from "@/lib/quotes/one-off-drill-sheets";
import {
  computeRectStructure,
  type RectTemplateConfig,
} from "@/lib/rect-structure";
import {
  buildRectSheetFieldMap,
  fillRectSheetTemplatePdf,
} from "@/lib/rect-template-pdf";
import {
  PIN_CONTRACT_FIELD,
  sheetPinContractNumber,
} from "@/lib/sheet-pin-contract";

// The NYSDOT PIN / contract number lives on the job and prints in the
// "pin/project" blank of the Sheet PDFs that have one (the DOT catch basins).

const RECT_TEMPLATE: RectTemplateConfig = {
  wallThicknessInches: 8,
  baseSlabThicknessInches: 8,
  topSlabThicknessInches: 8,
  minimumBrickInches: 4,
  sumpMode: "FIXED",
  sumpFixedInches: 24,
  wallPricePerFoot: 0,
  minPricingHeightFeet: 0,
  topSlabPrice: 0,
  baseSlabPrice: 0,
  topSlabOpeningLengthInches: null,
  topSlabOpeningWidthInches: null,
  topSlabOpeningSide: null,
};

function rectResult() {
  return computeRectStructure({
    rimElevation: 103.4,
    castingHeightFeet: 0.42,
    insideLengthFeet: 4,
    insideWidthFeet: 3,
    baseAttached: true,
    template: RECT_TEMPLATE,
    openingSizes: [],
    openings: [],
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: null,
  });
}

const rectMeta = {
  structureNumber: "CB-12",
  contractor: "ABC Paving",
  project: "Route 25 Drainage",
  templateName: "DOT - Type G - F3",
  castingName: null,
};

const circularOptions: OneOffCircularOptions = {
  templates: [
    {
      id: "tpl-storm",
      name: "Storm 4'Ø MH",
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
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: 8,
      pipeType: "",
      hasBoot: true,
      holeDiameterInches: 14,
      pipeWallThicknessInches: 0.25,
      bootModel: "KNS-14",
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

const circularMeta: DrillSheetPreviewMeta = {
  templateName: "Storm 4'Ø MH",
  manholeNumber: "MH-1",
  contractor: "ABC Paving",
  project: "Route 25 Drainage",
  date: "11-18-2026",
  castingName: "Frame & Cover",
  insideDiameterFeet: 4,
  hasSteps: false,
  inspection: "",
  approvedBy: "",
  useBase: "",
  useRiser: "",
  brickAdjustment: "",
  topSlabOpeningInches: null,
};

function circularResult() {
  const [row] = buildRowsFromSetup(
    {
      ...createEmptySetup("CIRCULAR"),
      templateId: "tpl-storm",
      diameterFeet: "4",
      castingProductId: "cast-frame",
      pipeType: "PVC SDR35",
      pipeSize: "8",
      quantity: "1",
    },
    1,
  );
  row.rimElevation = "100";
  row.openings[0] = { ...row.openings[0], invert: "92", angle: "" };
  const sheet = computeCircularOneOffRow(row, circularOptions).circularSheet;
  if (!sheet) {
    throw new Error("The test manhole did not compute.");
  }
  return sheet;
}

/** A one-page PDF with the given blank text fields. */
async function pdfWithFields(names: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([792, 612]);
  const form = doc.getForm();
  names.forEach((name, index) => {
    form
      .createTextField(name)
      .addToPage(page, { x: 100, y: 500 - index * 24, width: 160, height: 16 });
  });
  return doc.save();
}

async function readField(bytes: Uint8Array, name: string) {
  const doc = await PDFDocument.load(bytes);
  return doc.getForm().getTextField(name).getText() ?? "";
}

describe("sheetPinContractNumber", () => {
  it("reads the number from the sheet's job", () => {
    expect(
      sheetPinContractNumber({ job: { nysdotContractNumber: " D265123 " } }),
    ).toBe("D265123");
  });

  it("falls back to the quote's job for a sheet that only has a quote", () => {
    expect(
      sheetPinContractNumber({
        job: null,
        quote: { job: { nysdotContractNumber: "D265123" } },
      }),
    ).toBe("D265123");
  });

  it("is blank for a job that is not DOT work, or a sheet with no job", () => {
    expect(sheetPinContractNumber({ job: { nysdotContractNumber: null } })).toBe("");
    expect(sheetPinContractNumber({ job: null, quote: null })).toBe("");
    expect(sheetPinContractNumber({})).toBe("");
  });
});

describe("the pin/project blank on a rectangular sheet", () => {
  it("is filled with the job's contract number", async () => {
    const result = rectResult();
    const map = buildRectSheetFieldMap(
      { ...rectMeta, pinContractNumber: "D265123" },
      result,
    );
    expect(map[PIN_CONTRACT_FIELD]).toBe("D265123");

    const filled = await fillRectSheetTemplatePdf(
      await pdfWithFields(["project", PIN_CONTRACT_FIELD]),
      map,
      result,
    );
    expect(await readField(filled, PIN_CONTRACT_FIELD)).toBe("D265123");
    expect(await readField(filled, "project")).toBe("Route 25 Drainage");
  });

  it("stays blank on a job without a contract number", async () => {
    const result = rectResult();
    const map = buildRectSheetFieldMap(rectMeta, result);
    expect(map[PIN_CONTRACT_FIELD]).toBe("");

    const filled = await fillRectSheetTemplatePdf(
      await pdfWithFields(["project", PIN_CONTRACT_FIELD]),
      map,
      result,
    );
    expect(await readField(filled, PIN_CONTRACT_FIELD)).toBe("");
  });

  it("fills a drawing that has no such blank as before", async () => {
    const result = rectResult();
    const filled = await fillRectSheetTemplatePdf(
      await pdfWithFields(["project"]),
      buildRectSheetFieldMap({ ...rectMeta, pinContractNumber: "D265123" }, result),
      result,
    );
    expect(await readField(filled, "project")).toBe("Route 25 Drainage");
  });
});

describe("the pin/project blank on a round sheet", () => {
  it("is filled with the job's contract number", async () => {
    const result = circularResult();
    const map = buildDrillSheetFieldMap(
      { ...circularMeta, pinContractNumber: "D265123" },
      result,
    );
    expect(map[PIN_CONTRACT_FIELD]).toBe("D265123");

    const filled = await fillDrillSheetTemplatePdf(
      await pdfWithFields(["project", PIN_CONTRACT_FIELD]),
      map,
      result.openings,
      result,
    );
    expect(await readField(filled, PIN_CONTRACT_FIELD)).toBe("D265123");
  });

  it("stays blank on a job without a contract number", () => {
    expect(
      buildDrillSheetFieldMap(circularMeta, circularResult())[PIN_CONTRACT_FIELD],
    ).toBe("");
  });

  it("adds a PIN row to the generated sheet only when the job has a number", async () => {
    const result = circularResult();
    const without = await buildDrillSheetPdfHtml(circularMeta, result);
    expect(without).not.toContain("PIN / Contract #");

    const withNumber = await buildDrillSheetPdfHtml(
      { ...circularMeta, pinContractNumber: "D265123" },
      result,
    );
    expect(withNumber).toContain("PIN / Contract #");
    expect(withNumber).toContain("D265123");
  });
});

describe("Sheet PDF field check", () => {
  it("counts pin/project as a known field, and never as a missing one", async () => {
    const expected = ["contractor", "project"];

    const withPin = await listTemplatePdfFields(
      await pdfWithFields(["contractor", "project", PIN_CONTRACT_FIELD, "mystery"]),
      expected,
    );
    expect(withPin.matched).toEqual(["contractor", "project", PIN_CONTRACT_FIELD]);
    expect(withPin.unmatched).toEqual(["mystery"]);
    expect(withPin.missingFromPdf).toEqual([]);

    const withoutPin = await listTemplatePdfFields(
      await pdfWithFields(["contractor"]),
      expected,
    );
    expect(withoutPin.matched).toEqual(["contractor"]);
    expect(withoutPin.missingFromPdf).toEqual(["project"]);
  });
});
