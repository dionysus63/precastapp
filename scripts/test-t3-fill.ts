import { readFileSync, writeFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  buildDrillSheetFieldMap,
  fillDrillSheetTemplatePdf,
} from "@/lib/drill-sheet-template-pdf";
import type { ComputedOpening, DrillSheetResult } from "@/lib/drill-sheet";

async function main() {
  // Inject a section_stack marker over the cross-section cavity (T3 doesn't
  // carry one yet); mirrors what the user will add in Acrobat.
  const original = await PDFDocument.load(
    new Uint8Array(readFileSync("scripts/fixtures/example-t3.pdf")),
  );
  const stackField = original.getForm().createTextField("section_stack");
  stackField.addToPage(original.getPage(0), {
    x: 386,
    y: 84,
    width: 103,
    height: 164,
    borderWidth: 0,
  });
  const templateBytes = await original.save();

  // Mirrors the MH 2 example: base 2'-6", riser 4'-0", outlet A in the base,
  // pipe B penetrating the riser at 135 degrees.
  const openings = [
    {
      label: "A",
      isLowInvert: true,
      angleDegrees: 0,
      pipeSizeInches: 12,
      pipeType: "HDPE",
      invertElevation: 140.53,
      holeDiameterInches: 18,
      bootModel: null,
      hasBoot: false,
      containingSectionRole: "BASE",
      sectionBottomToOpeningBottomInches: 0,
    },
    {
      label: "B",
      isLowInvert: false,
      angleDegrees: 135,
      pipeSizeInches: 12,
      pipeType: "HDPE",
      invertElevation: 144.98,
      holeDiameterInches: 18,
      bootModel: null,
      hasBoot: false,
      containingSectionRole: "RISER",
      sectionBottomToOpeningBottomInches: 23,
    },
  ] as unknown as ComputedOpening[];

  const result = {
    rimElevation: 147.98,
    lowInvertElevation: 140.53,
    invertToTopFeet: 7.45,
    castingHeightFeet: 0.33,
    topSlabThicknessFeet: 0.67,
    sumpFeet: 0.25,
    rawAvailableFeet: 7.7,
    wallHeightFeet: 7.5,
    brickFeet: 0.2,
    hasKey: true,
    keyHeightFeet: 4 / 12,
    totalHeightFeet: 10.17,
    baseSlabThicknessFeet: 0.6667,
    sections: [
      {
        role: "BASE",
        heightFeet: 2.5,
        hasBottomKey: false,
        hasTopKey: true,
      },
      { role: "RISER", heightFeet: 4, hasBottomKey: true, hasTopKey: true },
      { role: "RISER", heightFeet: 1, hasBottomKey: true, hasTopKey: true },
    ],
    openings,
    wallPrice: 0,
    bootsPrice: 0,
    totalPrice: 0,
    errorMessage: null,
    warnings: [],
  } as unknown as DrillSheetResult;

  const meta = {
    templateName: "Manhole",
    manholeNumber: "MH 2",
    contractor: "Darr",
    project: "Northport VA",
    date: "07/01/2026",
    castingName: "Campbell 1012",
    insideDiameterFeet: 4,
    hasSteps: false,
    inspection: "",
    approvedBy: "",
    useBase: "2'-6\"",
    useRiser: "4'-0\"",
    brickAdjustment: '2"',
  } as DrillSheetPreviewMeta;

  const fieldMap = buildDrillSheetFieldMap(meta, result);
  const out = await fillDrillSheetTemplatePdf(
    templateBytes,
    fieldMap,
    openings,
    result,
  );

  const check = await PDFDocument.load(out);
  const names = check.getForm().getFields().map((f) => f.getName());
  for (const marker of ["plan_circle", "riser_circle", "section_stack"]) {
    if (names.includes(marker)) {
      throw new Error(`${marker} was not removed`);
    }
  }

  writeFileSync("test-t3-filled.pdf", out);
  console.log("wrote test-t3-filled.pdf");
  console.log("OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
