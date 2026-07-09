import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  buildDrillSheetFieldMap,
  fillDrillSheetTemplatePdf,
} from "@/lib/drill-sheet-template-pdf";
import { flattenPdfForms } from "@/lib/drill-sheet-pdf-generate";
import type { ComputedOpening, DrillSheetResult } from "@/lib/drill-sheet";

const TEMPLATE =
  "c:\\Users\\Nick\\OneDrive - Long Island Precast\\Desktop\\0-Norms Net Files\\Fillable Form for Manholes - T8.pdf";

async function main() {
  const templateBytes = new Uint8Array(readFileSync(TEMPLATE));

  const openings = [
    {
      label: "A",
      isLowInvert: true,
      angleDegrees: 0,
      pipeSizeInches: 12,
      pipeType: null,
      pipeMaterial: "HDPE",
      invertElevation: 140.53,
      holeDiameterInches: 18,
      bootModel: "PSX-D18",
      hasBoot: true,
      containingSectionRole: "BASE",
      sectionBottomToOpeningBottomInches: 0,
    },
    {
      label: "B",
      isLowInvert: false,
      angleDegrees: 135,
      pipeSizeInches: 12,
      pipeType: null,
      pipeMaterial: "HDPE",
      invertElevation: 144.98,
      holeDiameterInches: 18,
      bootModel: "PSX-D18",
      hasBoot: true,
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
      { role: "BASE", heightFeet: 2.5, hasBottomKey: false, hasTopKey: true },
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
    manholeNumber: "MH 8",
    contractor: "Darr Construction",
    project: "Northport VA",
    date: "07/03/2026",
    castingName: "Campbell 1012",
    insideDiameterFeet: 4,
    hasSteps: false,
    inspection: "Suffolk County",
    approvedBy: "",
    useBase: "2'-6\"",
    useRiser: "4'-0\"",
    brickAdjustment: '2"',
  } as DrillSheetPreviewMeta;

  const fieldMap = buildDrillSheetFieldMap(meta, result);
  console.log("base_height_feet_and_inches =", JSON.stringify(fieldMap.base_height_feet_and_inches));
  console.log("total_riser_height_feet_and_inches =", JSON.stringify(fieldMap.total_riser_height_feet_and_inches));
  console.log("casting_thickness_inches =", JSON.stringify(fieldMap.casting_thickness_inches));
  console.log("brick_thickness_inches =", JSON.stringify(fieldMap.brick_thickness_inches));
  console.log("diameter_feet_only =", JSON.stringify(fieldMap.diameter_feet_only));

  const filled = await fillDrillSheetTemplatePdf(
    templateBytes,
    fieldMap,
    openings,
    result,
  );
  const flat = await flattenPdfForms(filled);

  const check = await PDFDocument.load(flat);
  console.log("fields remaining after flatten:", check.getForm().getFields().length);

  writeFileSync("test-t8-filled.pdf", flat);
  console.log("wrote test-t8-filled.pdf");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
