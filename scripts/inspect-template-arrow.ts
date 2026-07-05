import { readFileSync, writeFileSync } from "fs";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from "pdf-lib";

const TEMPLATE =
  "assets/templates/structure-template-pdfs/cmqvrsqff001enkv8u20nfsn0/norisers-key.pdf";

async function main() {
  const bytes = readFileSync(TEMPLATE);
  const doc = await PDFDocument.load(bytes);

  // Locate the plan_circle marker so we know where the circle is.
  try {
    const marker = doc.getForm().getTextField("plan_circle");
    const rect = marker.acroField.getWidgets()[0]?.getRectangle();
    console.log("plan_circle rect:", JSON.stringify(rect));
  } catch {
    console.log("no plan_circle field found");
  }

  const page = doc.getPage(0);
  console.log("page size:", page.getWidth(), "x", page.getHeight());

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
  writeFileSync("template-content-dump.txt", full);
  console.log(
    "streams:",
    streams.length,
    "total chars:",
    full.length,
    "-> template-content-dump.txt",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
