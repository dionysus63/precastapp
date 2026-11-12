// Sheet PDFs: one blank fillable drill sheet drawing per row, picked by the
// structure templates of its shape. Names, labels and the "does this sheet
// fit this template" rule live here.
//
// Safe to import from both server and client modules.

export type SheetPdfShape = "CIRCULAR" | "RECTANGULAR";

/** What decides whether a Sheet PDF fits a template. */
export type SheetPdfKind = {
  shape: SheetPdfShape;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
};

export const SHEET_PDF_SHAPE_LABELS: Record<SheetPdfShape, string> = {
  CIRCULAR: "Round",
  RECTANGULAR: "Rectangular",
};

/** The slab combination in words, e.g. "top slab, no base". */
export function sheetPdfSlabLabel(
  hasTopSlab: boolean,
  hasBaseSlab: boolean,
): string {
  return `${hasTopSlab ? "top slab" : "no top slab"}${hasBaseSlab ? " + base" : ", no base"}`;
}

/**
 * The name a rectangular sheet gets when it is one of a family of slab
 * variants: "CB Standard - Top Slab, No Base". Matches the names the old
 * Sheet PDF Sets were converted to.
 */
export function rectSheetPdfSlotName(
  familyName: string,
  hasTopSlab: boolean,
  hasBaseSlab: boolean,
): string {
  return `${familyName.trim()} - ${hasTopSlab ? "Top Slab" : "No Top Slab"}${hasBaseSlab ? " + Base" : ", No Base"}`;
}

/** e.g. "round" or "rectangular, top slab + base". */
export function sheetPdfKindLabel(kind: SheetPdfKind): string {
  return kind.shape === "CIRCULAR"
    ? "round"
    : `rectangular, ${sheetPdfSlabLabel(kind.hasTopSlab, kind.hasBaseSlab)}`;
}

/**
 * A template prints on a Sheet PDF of its own shape. A rectangular sheet is
 * drawn for one slab combination, so it must also match the template's slabs;
 * a round sheet covers every round template.
 */
export function sheetPdfFitsTemplate(
  sheetPdf: SheetPdfKind,
  template: SheetPdfKind,
): boolean {
  if (sheetPdf.shape !== template.shape) {
    return false;
  }
  if (template.shape === "CIRCULAR") {
    return true;
  }
  return (
    sheetPdf.hasTopSlab === template.hasTopSlab &&
    sheetPdf.hasBaseSlab === template.hasBaseSlab
  );
}

function safeFilePart(value: string, maxLength: number): string {
  return value
    .replace(/[\\/:*?"<>|\r\n]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
    // No stray dash or space where a replaced character ended the name.
    .replace(/^[-\s]+|[-\s]+$/g, "");
}

/**
 * The saved file's name: the Sheet PDF's own name rather than whatever the
 * PDF was called when it was uploaded, so a folder of saved sheets reads the
 * same as the Sheet PDFs list.
 */
export function sheetPdfDownloadName(name: string): string {
  return `${safeFilePart(name ?? "", 120) || "Sheet PDF"}.pdf`;
}

/** Where a Sheet PDF's blank file is served as a file to save. */
export function sheetPdfDownloadHref(id: string): string {
  return `/api/sheet-pdfs/${encodeURIComponent(id)}/download`;
}

/** Where a Sheet PDF's field check is served. */
export function sheetPdfCoverageHref(id: string): string {
  return `/api/sheet-pdfs/${encodeURIComponent(id)}/coverage`;
}
