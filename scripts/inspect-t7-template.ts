import { readFileSync, writeFileSync } from "fs";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
  PDFHexString,
} from "pdf-lib";
import { DRILL_SHEET_TEMPLATE_FIELD_NAMES } from "@/lib/drill-sheet-template-pdf";

const TEMPLATE =
  process.argv[2] ??
  "c:\\Users\\Nick\\OneDrive - Long Island Precast\\Desktop\\0-Norms Net Files\\Fillable Form for Manholes - T7.pdf";

async function main() {
  const bytes = readFileSync(TEMPLATE);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  console.log("pages:", doc.getPageCount());
  const page = doc.getPage(0);
  console.log("page size:", page.getWidth(), "x", page.getHeight());

  // AcroForm default DA + font resources
  const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const formDA = acroForm?.lookupMaybe(PDFName.of("DA"), PDFString, PDFHexString);
  console.log("\nAcroForm /DA:", formDA?.decodeText?.() ?? String(formDA));
  const dr = acroForm?.lookupMaybe(PDFName.of("DR"), PDFDict);
  const drFonts = dr?.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (drFonts) {
    console.log("AcroForm /DR fonts:");
    for (const [key, value] of drFonts.entries()) {
      let baseFont = "";
      try {
        const fontDict = doc.context.lookup(value);
        if (fontDict instanceof PDFDict) {
          baseFont = String(fontDict.get(PDFName.of("BaseFont")) ?? "");
        }
      } catch {}
      console.log(`  ${key.toString()} -> ${baseFont}`);
    }
  }

  const expected = new Set<string>(DRILL_SHEET_TEMPLATE_FIELD_NAMES);
  console.log("\n=== Form fields ===");
  for (const field of form.getFields()) {
    const name = field.getName();
    const isNew = !expected.has(name);
    const widget = field.acroField.getWidgets()[0];
    const rect = widget?.getRectangle();
    const daRaw = field.acroField.dict.lookupMaybe(
      PDFName.of("DA"),
      PDFString,
      PDFHexString,
    );
    const da = daRaw?.decodeText?.() ?? "";
    console.log(
      `${isNew ? "[NEW] " : ""}${name} | type=${field.constructor.name}` +
        ` | rect=${rect ? `${rect.x.toFixed(0)},${rect.y.toFixed(0)} ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}` : "?"}` +
        ` | DA="${da}"`,
    );
  }

  console.log("\n=== Missing expected fields ===");
  const pdfNames = new Set(form.getFields().map((f) => f.getName()));
  for (const name of DRILL_SHEET_TEMPLATE_FIELD_NAMES) {
    if (!pdfNames.has(name)) {
      console.log("  missing:", name);
    }
  }

  // Dump page content streams so we can find text + fonts near fields.
  const contents = page.node.get(PDFName.of("Contents"));
  const streams: string[] = [];
  const collect = (ref: unknown) => {
    if (!(ref instanceof PDFRef)) return;
    const stream = doc.context.lookup(ref);
    if (stream instanceof PDFRawStream) {
      streams.push(
        Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1"),
      );
    }
  };
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) collect(contents.get(i));
  } else {
    collect(contents);
  }
  const full = streams.join("\n");
  writeFileSync("t7-content-dump.txt", full);
  console.log("\ncontent stream chars:", full.length, "-> t7-content-dump.txt");

  // Page font resources
  const resources = page.node.lookupMaybe(PDFName.of("Resources"), PDFDict);
  const pageFonts = resources?.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (pageFonts) {
    console.log("\nPage font resources:");
    for (const [key, value] of pageFonts.entries()) {
      let baseFont = "";
      let subtype = "";
      try {
        const fontDict = doc.context.lookup(value);
        if (fontDict instanceof PDFDict) {
          baseFont = String(fontDict.get(PDFName.of("BaseFont")) ?? "");
          subtype = String(fontDict.get(PDFName.of("Subtype")) ?? "");
        }
      } catch {}
      console.log(`  ${key.toString()} -> ${baseFont} (${subtype})`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
