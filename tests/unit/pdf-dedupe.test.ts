import { describe, expect, it } from "vitest";
import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from "pdf-lib";
import { dedupeSharedPdfObjects } from "@/lib/pdf-dedupe";

/**
 * Builds a source doc whose page carries a large payload stream plus a dict
 * referencing it — a miniature of a template's font graph (FontFile stream
 * + FontDescriptor dict). copyPages clones the whole graph per source.
 */
async function sourceDocWithPayload(payload: Uint8Array): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const stream = PDFRawStream.of(
    doc.context.obj({ Length: payload.length }),
    payload,
  );
  const streamRef = doc.context.register(stream);
  const descriptor = doc.context.obj({ TestPayload: streamRef, Flag: 4 });
  const descriptorRef = doc.context.register(descriptor);
  page.node.set(PDFName.of("PrecastTest"), descriptorRef);
  return doc;
}

async function mergeDocs(sources: PDFDocument[]): Promise<PDFDocument> {
  const merged = await PDFDocument.create();
  for (const source of sources) {
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }
  return merged;
}

function payloadStreamCount(doc: PDFDocument, size: number): number {
  let count = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.getContents().length === size) {
      count += 1;
    }
  }
  return count;
}

describe("dedupeSharedPdfObjects", () => {
  it("collapses identical resource graphs copied from multiple sources", async () => {
    const payload = new Uint8Array(50_000).fill(7);
    const merged = await mergeDocs([
      await sourceDocWithPayload(payload),
      await sourceDocWithPayload(payload),
      await sourceDocWithPayload(payload),
    ]);
    expect(payloadStreamCount(merged, payload.length)).toBe(3);

    const undedupedSize = (await merged.save()).length;
    const removed = dedupeSharedPdfObjects(merged);

    // Streams AND the dicts referencing them collapse (fixpoint).
    expect(removed).toBeGreaterThanOrEqual(4);
    expect(payloadStreamCount(merged, payload.length)).toBe(1);

    const bytes = await merged.save();
    expect(bytes.length).toBeLessThan(undedupedSize - 90_000);

    // The saved file stays loadable and every page still reaches a live
    // payload graph through its re-pointed reference.
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(3);
    for (const page of reloaded.getPages()) {
      const descriptorRef = page.node.get(PDFName.of("PrecastTest"));
      expect(descriptorRef).toBeInstanceOf(PDFRef);
      const descriptor = reloaded.context.lookup(descriptorRef as PDFRef);
      expect(descriptor).toBeDefined();
    }
    expect(payloadStreamCount(reloaded, payload.length)).toBe(1);
  });

  it("leaves distinct payloads alone", async () => {
    const merged = await mergeDocs([
      await sourceDocWithPayload(new Uint8Array(20_000).fill(1)),
      await sourceDocWithPayload(new Uint8Array(20_000).fill(2)),
    ]);

    dedupeSharedPdfObjects(merged);

    expect(payloadStreamCount(merged, 20_000)).toBe(2);
    const reloaded = await PDFDocument.load(await merged.save());
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("never merges page nodes", async () => {
    // Two byte-identical blank pages: page dicts must survive as two pages.
    const doc1 = await PDFDocument.create();
    doc1.addPage([100, 100]);
    const doc2 = await PDFDocument.create();
    doc2.addPage([100, 100]);
    const merged = await mergeDocs([doc1, doc2]);

    dedupeSharedPdfObjects(merged);

    const reloaded = await PDFDocument.load(await merged.save());
    expect(reloaded.getPageCount()).toBe(2);
  });
});
