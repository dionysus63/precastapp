import { PDFArray, PDFDict, PDFName, PDFRef, type PDFDocument } from "pdf-lib";

/**
 * Call right after form.flatten(): flattening (and the widget removal the
 * fill pipelines do) leaves per-page /Annots arrays holding dangling
 * references to the deleted widgets, plus a gutted /AcroForm in the catalog.
 * Acrobat's "Save As" (which optimizes for Fast Web View by default) refuses
 * documents carrying those — "The document could not be saved. There was a
 * problem reading this document (14)". Prune anything in /Annots that no
 * longer resolves to an annotation dict, drop the array once it is empty,
 * and drop the AcroForm once no fields remain. Real annotations (links,
 * markups) and live forms are left alone.
 */
export function removeFlattenLeftovers(doc: PDFDocument): void {
  for (const page of doc.getPages()) {
    const annotsKey = PDFName.of("Annots");
    const annots = page.node.lookup(annotsKey);
    if (annots instanceof PDFArray) {
      const surviving = annots
        .asArray()
        .filter((entry) =>
          entry instanceof PDFRef
            ? doc.context.lookup(entry) instanceof PDFDict
            : entry instanceof PDFDict,
        );
      if (surviving.length === 0) {
        page.node.delete(annotsKey);
      } else if (surviving.length !== annots.size()) {
        const pruned = PDFArray.withContext(doc.context);
        for (const entry of surviving) {
          pruned.push(entry);
        }
        page.node.set(annotsKey, pruned);
      }
    } else if (annots === undefined) {
      page.node.delete(annotsKey);
    }
  }
  if (doc.getForm().getFields().length === 0) {
    doc.catalog.delete(PDFName.of("AcroForm"));
  }
}
