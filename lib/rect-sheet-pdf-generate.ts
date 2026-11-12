import type { RectSheetPreviewMeta } from "@/components/drill-sheets/rect-sheet-preview";
import { formatSheetDate } from "@/lib/date-only";
import { flattenPdfForms } from "@/lib/drill-sheet-pdf-generate";
import {
  buildRectSheetFormValues,
  rectPayloadFromFormValues,
  type RectSheetWithDetail,
} from "@/lib/rect-sheet-detail";
import { loadAndComputeRectSheet } from "@/lib/rect-sheet-persistence";
import {
  buildRectSheetFieldMap,
  fillRectSheetTemplatePdf,
} from "@/lib/rect-template-pdf";
import { sheetPdfSlabLabel } from "@/lib/sheet-pdf";
import { readSheetPdfBytes } from "@/lib/sheet-pdf-service";
import type { RectStructureResult } from "@/lib/rect-structure";
import { rectTemplateVariantKey } from "@/lib/structure-template-pdf-service";
import { getPriceListIdForStructure } from "@/lib/structure-pricing";

export type RectSheetPdfBuildResult =
  | {
      ok: true;
      bytes: Uint8Array;
      meta: RectSheetPreviewMeta;
      variantKey: string;
      /** The Sheet PDF the sheet was filled on. */
      sheetPdfName: string;
    }
  | { ok: false; error: string };

/**
 * Recomputes the sheet from its stored inputs and fills its template's Sheet
 * PDF. Rect sheets have no generated-HTML fallback: the template needs a
 * Sheet PDF picked.
 */
export async function buildRectSheetPdfBytes(
  sheet: RectSheetWithDetail,
): Promise<RectSheetPdfBuildResult> {
  const formValues = buildRectSheetFormValues(sheet);
  const { result, casting } = await loadAndComputeRectSheet(
    rectPayloadFromFormValues(formValues),
    // Same list the sheet was saved and quoted on.
    { priceListId: await getPriceListIdForStructure(sheet.id) },
  );

  const meta: RectSheetPreviewMeta = {
    structureNumber: sheet.structureNumber ?? "",
    contractor: sheet.calc?.contractorName ?? "",
    project: sheet.calc?.projectName ?? "",
    templateName: sheet.structureTemplate?.name ?? "",
    castingName: casting?.name ?? null,
  };

  return fillRectSheetPdf(meta, result, sheet.structureTemplate?.sheetPdf ?? null, {
    date: sheet.calc?.sheetDate ? formatSheetDate(sheet.calc.sheetDate) : "",
  });
}

/** The Sheet PDF fields the rect fill needs (a template's `sheetPdf`). */
export type RectSheetPdf = {
  name: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  filePath: string;
};

/**
 * Fills the template's Sheet PDF from an already-computed rect sheet. Shared
 * by saved sheets and the Quick Build live preview of rows not yet created.
 */
export async function fillRectSheetPdf(
  meta: RectSheetPreviewMeta,
  result: RectStructureResult,
  sheetPdf: RectSheetPdf | null,
  extras: { date?: string } = {},
): Promise<RectSheetPdfBuildResult> {
  if (!sheetPdf) {
    return {
      ok: false,
      error:
        "This template has no Sheet PDF picked. Pick one on the structure template (Structures → template → Sheet PDF).",
    };
  }
  // The template editor only offers sheets drawn for the template's slabs,
  // so this guards rows saved some other way.
  if (
    sheetPdf.hasTopSlab !== result.hasTopSlab ||
    sheetPdf.hasBaseSlab !== result.hasBaseSlab
  ) {
    return {
      ok: false,
      error: `The Sheet PDF "${sheetPdf.name}" is drawn for ${sheetPdfSlabLabel(sheetPdf.hasTopSlab, sheetPdf.hasBaseSlab)}, but this structure has ${sheetPdfSlabLabel(result.hasTopSlab, result.hasBaseSlab)}. Pick a matching one on the structure template (Structures → template → Sheet PDF).`,
    };
  }

  let templateBytes: Uint8Array;
  try {
    templateBytes = await readSheetPdfBytes(sheetPdf);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {
        ok: false,
        error: `The file for the Sheet PDF "${sheetPdf.name}" is missing from the server. Upload it again with Replace in Structures → Sheet PDFs.`,
      };
    }
    throw error;
  }
  const fieldMap = buildRectSheetFieldMap(meta, result, extras);
  const filled = await fillRectSheetTemplatePdf(templateBytes, fieldMap, result);
  const bytes = await flattenPdfForms(filled);

  return {
    ok: true,
    bytes,
    meta,
    variantKey: rectTemplateVariantKey(sheetPdf.hasTopSlab, sheetPdf.hasBaseSlab),
    sheetPdfName: sheetPdf.name,
  };
}
