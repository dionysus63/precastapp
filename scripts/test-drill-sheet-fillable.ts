import { writeFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { appendDrillSheetFillablePage } from "@/lib/drill-sheet-pdf-fillable";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import type { DrillSheetResult } from "@/lib/drill-sheet";

async function main() {
  // A stand-in for the Chromium-rendered computed page.
  const base = await PDFDocument.create();
  base.addPage([612, 792]);
  const baseBytes = await base.save();

  const meta: DrillSheetPreviewMeta = {
    templateName: "NYSDOT 48 Manhole",
    manholeNumber: "MH-12",
    contractor: "ABC Contracting",
    project: "Main St Reconstruction",
    date: "6/27/2026",
    castingName: "Campbell 1012",
    insideDiameterFeet: 4,
    hasSteps: true,
    inspection: "",
    approvedBy: "",
    useBase: "Sanitary",
    useRiser: "Sanitary",
    brickAdjustment: '8"',
  };

  const result = {
    wallHeightFeet: 6.5,
    errorMessage: null,
    openings: [
      {
        label: "A",
        invertElevation: 92.34,
        pipeSizeInches: 12,
        pipeType: "PVC",
        bootModel: "406",
      },
      {
        label: "B",
        invertElevation: 93.1,
        pipeSizeInches: 8,
        pipeType: "DI",
        bootModel: "306",
      },
    ],
  } as unknown as DrillSheetResult;

  const out = await appendDrillSheetFillablePage(baseBytes, meta, result);
  const outPath =
    "C:/Users/Nick/AppData/Local/Temp/claude/C--Projects-precastapp/24b54ea7-52ae-4226-b48f-f962add5327f/scratchpad/fillable_test.pdf";
  writeFileSync(outPath, out);

  const check = await PDFDocument.load(out);
  const fields = check.getForm().getFields();
  console.log("pages:", check.getPageCount());
  console.log("form fields:", fields.length);
  console.log(fields.map((f) => f.getName()).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
