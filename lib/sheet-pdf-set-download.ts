// Links and file names for saving a Sheet PDF Set's blank PDF out of the app
// (served by /api/rect-pdf-set-files/<id>/download) so it can be edited and
// uploaded again.
//
// Safe to import from both server and client modules.

function safeFilePart(value: string, maxLength: number): string {
  return value
    .replace(/[\\/:*?"<>|\r\n]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
    // No stray dash or space where a replaced character ended the name.
    .replace(/^[-\s]+|[-\s]+$/g, "");
}

/** The slab variant as it reads in a file name, e.g. "Top Slab + No Base". */
export function rectSheetVariantFileLabel(
  hasTopSlab: boolean,
  hasBaseSlab: boolean,
): string {
  return `${hasTopSlab ? "Top Slab" : "No Top Slab"} + ${hasBaseSlab ? "Base Slab" : "No Base"}`;
}

/**
 * The saved file's name. It is built from the set and the slot rather than
 * the name the PDF was uploaded with, so the four PDFs of a rectangular set
 * can sit in one folder and still say which slot each belongs in:
 * "CB Standard - Top Slab + Base Slab.pdf". A circular set holds one sheet,
 * so its file is just the set name.
 */
export function sheetPdfSetFileDownloadName(
  setName: string,
  shape: "CIRCULAR" | "RECTANGULAR",
  variant: { hasTopSlab: boolean; hasBaseSlab: boolean },
): string {
  const parts = [safeFilePart(setName ?? "", 80) || "Sheet PDF Set"];
  if (shape !== "CIRCULAR") {
    parts.push(rectSheetVariantFileLabel(variant.hasTopSlab, variant.hasBaseSlab));
  }
  return `${parts.join(" - ")}.pdf`;
}

/** Where one slot's PDF is served as a file to save. */
export function sheetPdfSetFileDownloadHref(fileId: string): string {
  return `/api/rect-pdf-set-files/${encodeURIComponent(fileId)}/download`;
}
