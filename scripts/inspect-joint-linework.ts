import { readFileSync, writeFileSync } from "fs";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from "pdf-lib";

async function main() {
  const bytes = readFileSync(process.argv[2] ?? "example-t3.pdf");
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  console.log("page:", page.getWidth(), "x", page.getHeight());

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
  writeFileSync("template-content.txt", full);
  console.log("chars:", full.length, "-> template-content.txt");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
