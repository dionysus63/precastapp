// Structural deduplication for merged PDFs.
//
// pdf-lib's copyPages clones each source document's whole resource graph, so
// a packet of N sheets generated from the same template carries N identical
// copies of its embedded fonts, logo image, and ICC profiles (~300 KB per
// sheet for the rect templates — a 53-sheet packet was 20 MB of which ~19 MB
// was the same bytes repeated). This pass hash-conses the object graph:
// identical indirect objects collapse to one, and every reference is
// re-pointed at the survivor. Appearance is untouched — it is the same
// bytes, referenced once.
//
// Runs to a fixpoint: leaf objects (font programs, ICC profiles) merge
// first, which then makes their referencing dicts (font descriptors, image
// XObjects) structurally identical, and so on up the graph. Page-tree and
// document-level nodes are never merged.

import { createHash } from "node:crypto";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFObject,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from "pdf-lib";

/** Never merge document-structure nodes, even when structurally identical. */
const SKIP_TYPES = new Set(["/Page", "/Pages", "/Catalog", "/Annot"]);

const TYPE_KEY = PDFName.of("Type");

/**
 * Stable structural key for an object. References serialize by identity, so
 * two objects only share a key once everything they point at has already
 * been merged — the caller iterates to a fixpoint. Returns null for objects
 * that must not be merged (non-raw streams pdf-lib may still mutate).
 */
function structuralKey(obj: PDFObject): string | null {
  if (obj instanceof PDFRef) {
    return `R${obj.toString()}`;
  }
  if (obj instanceof PDFRawStream) {
    const dictKey = structuralKey(obj.dict);
    if (dictKey == null) {
      return null;
    }
    const digest = createHash("sha256").update(obj.getContents()).digest("hex");
    return `S${dictKey}#${digest}`;
  }
  if (obj instanceof PDFStream) {
    return null;
  }
  if (obj instanceof PDFDict) {
    const parts: string[] = [];
    for (const [key, value] of obj.entries()) {
      const valueKey = structuralKey(value);
      if (valueKey == null) {
        return null;
      }
      parts.push(`${key.toString()}:${valueKey}`);
    }
    parts.sort();
    return `D{${parts.join(",")}}`;
  }
  if (obj instanceof PDFArray) {
    const parts: string[] = [];
    for (const value of obj.asArray()) {
      const valueKey = structuralKey(value);
      if (valueKey == null) {
        return null;
      }
      parts.push(valueKey);
    }
    return `A[${parts.join(",")}]`;
  }
  return `P${obj.toString()}`;
}

/** Re-points every reference inside obj according to remap (in place). */
function rewriteRefs(obj: PDFObject, remap: Map<PDFRef, PDFRef>): void {
  if (obj instanceof PDFDict) {
    for (const [key, value] of obj.entries()) {
      if (value instanceof PDFRef) {
        const target = remap.get(value);
        if (target) {
          obj.set(key, target);
        }
      } else {
        rewriteRefs(value, remap);
      }
    }
  } else if (obj instanceof PDFArray) {
    const values = obj.asArray();
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (value instanceof PDFRef) {
        const target = remap.get(value);
        if (target) {
          obj.set(index, target);
        }
      } else {
        rewriteRefs(value, remap);
      }
    }
  } else if (obj instanceof PDFStream) {
    rewriteRefs(obj.dict, remap);
  }
}

function isSkipped(obj: PDFObject): boolean {
  const dict =
    obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : null;
  if (!dict) {
    return false;
  }
  const type = dict.get(TYPE_KEY);
  return type instanceof PDFName && SKIP_TYPES.has(type.toString());
}

/**
 * Collapses structurally identical indirect objects in a document. Call
 * right before save() — merged objects are shared, so nothing may mutate
 * the document afterwards. Returns how many duplicates were removed.
 */
export function dedupeSharedPdfObjects(doc: PDFDocument): number {
  const context = doc.context;
  let removed = 0;

  for (let pass = 0; pass < 10; pass += 1) {
    const canonicalByKey = new Map<string, PDFRef>();
    const remap = new Map<PDFRef, PDFRef>();

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      if (isSkipped(obj)) {
        continue;
      }
      const key = structuralKey(obj);
      if (key == null) {
        continue;
      }
      const canonical = canonicalByKey.get(key);
      if (canonical) {
        remap.set(ref, canonical);
      } else {
        canonicalByKey.set(key, ref);
      }
    }

    if (remap.size === 0) {
      break;
    }
    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      if (!remap.has(ref)) {
        rewriteRefs(obj, remap);
      }
    }
    for (const duplicate of remap.keys()) {
      context.delete(duplicate);
    }
    removed += remap.size;
  }

  return removed;
}
