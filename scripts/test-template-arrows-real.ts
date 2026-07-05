import { readFileSync, writeFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { fillDrillSheetTemplatePdf } from "@/lib/drill-sheet-template-pdf";
import type { ComputedOpening } from "@/lib/drill-sheet";

const TEMPLATE =
  "assets/templates/structure-template-pdfs/cmqvrsqff001enkv8u20nfsn0/norisers-key.pdf";

async function main() {
  const templateBytes = new Uint8Array(readFileSync(TEMPLATE));

  const openings = [
    {
      label: "A",
      isLowInvert: true,
      angleDegrees: 0,
      holeDiameterInches: 18,
      baseTopToOpeningBottomInches: 0,
    },
    {
      label: "B",
      isLowInvert: false,
      angleDegrees: 90,
      holeDiameterInches: 12,
      baseTopToOpeningBottomInches: 5,
    },
    {
      label: "C",
      isLowInvert: false,
      angleDegrees: 180,
      holeDiameterInches: 18,
      baseTopToOpeningBottomInches: 8,
    },
    {
      label: "D",
      isLowInvert: false,
      angleDegrees: 245,
      holeDiameterInches: 24,
      baseTopToOpeningBottomInches: 2,
    },
  ] as unknown as ComputedOpening[];

  const out = await fillDrillSheetTemplatePdf(
    templateBytes,
    { contractor: "ABC Contracting", project: "Arrow Style Test" },
    openings,
  );

  const check = await PDFDocument.load(out);
  const fieldNames = check
    .getForm()
    .getFields()
    .map((field) => field.getName());
  if (fieldNames.includes("plan_circle")) {
    throw new Error("plan_circle marker was not removed");
  }

  const outPath = "test-template-arrows.pdf";
  writeFileSync(outPath, out);
  console.log("wrote", outPath);
  console.log("OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
