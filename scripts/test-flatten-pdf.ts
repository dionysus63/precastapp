import "dotenv/config";
import { PDFDocument } from "pdf-lib";
import { flattenPdfForms } from "@/lib/drill-sheet-pdf-generate";

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  const field = form.createTextField("test_field");
  field.setText("Hello 12.34");
  field.addToPage(page, { x: 50, y: 700, width: 200, height: 18 });
  const bytes = await doc.save();

  const beforeDoc = await PDFDocument.load(bytes);
  console.log("fields before:", beforeDoc.getForm().getFields().length);

  const flattened = await flattenPdfForms(bytes);
  const afterDoc = await PDFDocument.load(flattened);
  console.log("fields after:", afterDoc.getForm().getFields().length);

  if (afterDoc.getForm().getFields().length !== 0) {
    throw new Error("FAIL: fields remain after flatten");
  }
  console.log("PASS: PDF flattened, no editable fields remain");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
