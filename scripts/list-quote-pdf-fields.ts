import { readFileSync } from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";

const templates = [
  { label: "MAIN", file: "quote-template.pdf" },
  { label: "CONTINUATION", file: "quote-template-continuation.pdf" },
];

async function main() {
  for (const { label, file } of templates) {
    const templatePath = path.join(process.cwd(), "assets", "templates", file);
    const bytes = readFileSync(templatePath);
    const doc = await PDFDocument.load(bytes);
    const fields = doc.getForm().getFields().map((field) => field.getName());
    console.log(`=== ${label} (${fields.length} fields) ===\n`);
    for (const name of fields) {
      console.log(`  - ${name}`);
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
