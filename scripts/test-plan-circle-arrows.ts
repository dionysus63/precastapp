import { writeFileSync } from "fs";
import { PDFDocument, PDFName } from "pdf-lib";
import { fillDrillSheetTemplatePdf } from "@/lib/drill-sheet-template-pdf";
import type { ComputedOpening } from "@/lib/drill-sheet";

async function buildTemplateWithMarker(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();

  // Visible reference circle so the output can be eyeballed.
  page.drawCircle({
    x: 306,
    y: 450,
    size: 100,
    borderWidth: 1.5,
  });

  const contractor = form.createTextField("contractor");
  contractor.addToPage(page, { x: 40, y: 720, width: 200, height: 16 });

  const marker = form.createTextField("plan_circle");
  marker.addToPage(page, { x: 206, y: 350, width: 200, height: 200 });

  // Strip the appearance streams pdf-lib generated, mimicking a field
  // authored in AutoCAD/Bluebeam (this is what triggered "Unexpected N type").
  for (const widget of marker.acroField.getWidgets()) {
    widget.dict.delete(PDFName.of("AP"));
  }

  return doc.save({ updateFieldAppearances: false });
}

async function main() {
  const templateBytes = await buildTemplateWithMarker();

  const openings = [
    {
      label: "A",
      isLowInvert: true,
      angleDegrees: 0,
    },
    {
      label: "B",
      isLowInvert: false,
      angleDegrees: 90,
    },
    {
      label: "C",
      isLowInvert: false,
      angleDegrees: 180,
    },
    {
      label: "D",
      isLowInvert: false,
      angleDegrees: 245,
    },
  ] as unknown as ComputedOpening[];

  const out = await fillDrillSheetTemplatePdf(
    templateBytes,
    { contractor: "ABC Contracting" },
    openings,
  );

  const check = await PDFDocument.load(out);
  const fieldNames = check
    .getForm()
    .getFields()
    .map((field) => field.getName());

  console.log("pages:", check.getPageCount());
  console.log("remaining fields:", fieldNames.join(", ") || "(none)");
  if (fieldNames.includes("plan_circle")) {
    throw new Error("plan_circle marker was not removed");
  }

  const outPath = "test-plan-circle-arrows.pdf";
  writeFileSync(outPath, out);
  console.log("wrote", outPath);
  console.log("OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
