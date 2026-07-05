import { readFileSync } from "fs";

async function dump(label: string, file: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(file));
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const tc = await page.getTextContent();
  console.log(`\n=== ${label} ===`);
  for (const item of tc.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const size = Math.hypot(item.transform[2], item.transform[3]);
    console.log(
      `${x.toFixed(1)},${y.toFixed(1)} size=${size.toFixed(2)} ${JSON.stringify(item.str)}`,
    );
  }
}

async function main() {
  const file = process.argv[2] ?? "test-t7-filled.pdf";
  await dump(file, file);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
