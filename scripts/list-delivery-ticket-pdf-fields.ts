import { readFileSync } from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";

const templatePath = path.join(
  process.cwd(),
  "assets",
  "templates",
  "delivery-ticket-template.pdf",
);

async function main() {
  const bytes = readFileSync(templatePath);
  const doc = await PDFDocument.load(bytes);
  const fields = doc.getForm().getFields().map((field) => field.getName());
  console.log(`Found ${fields.length} form field(s):\n`);
  for (const name of fields) {
    console.log(`  - ${name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
