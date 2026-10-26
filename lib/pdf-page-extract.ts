import { PDFDocument } from "pdf-lib";

/**
 * A new PDF holding only `pages` (1-based, in the order given) of `source`.
 * Used to cut one structure's drill sheet or submittal out of a combined PDF.
 */
export async function extractPdfPages(
  source: PDFDocument,
  pages: number[],
): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  const copied = await output.copyPages(
    source,
    pages.map((page) => page - 1),
  );
  for (const page of copied) {
    output.addPage(page);
  }
  return output.save();
}
