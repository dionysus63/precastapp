import type { RectSheetPreviewMeta } from "@/components/drill-sheets/rect-sheet-preview";
import { flattenPdfForms } from "@/lib/drill-sheet-pdf-generate";
import {
  buildRectSheetFormValues,
  rectPayloadFromFormValues,
  type RectSheetWithDetail,
} from "@/lib/rect-sheet-detail";
import { loadAndComputeRectSheet } from "@/lib/rect-sheet-persistence";
import { readRectPdfSetFileBytes } from "@/lib/rect-pdf-set-service";
import {
  buildRectSheetFieldMap,
  fillRectSheetTemplatePdf,
  selectRectTemplateVariant,
} from "@/lib/rect-template-pdf";
import type { RectStructureResult } from "@/lib/rect-structure";
import { rectTemplateVariantKey } from "@/lib/structure-template-pdf-service";
import { getPriceListIdForStructure } from "@/lib/structure-pricing";

export type RectSheetPdfBuildResult =
  | {
      ok: true;
      bytes: Uint8Array;
      meta: RectSheetPreviewMeta;
      variantKey: string;
      originalName: string;
    }
  | { ok: false; error: string };

/**
 * Recomputes the sheet from its stored inputs and fills the PDF-set variant
 * matching its slab configuration. Rect sheets have no generated-HTML
 * fallback: the template needs a PDF set with the matching variant uploaded.
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

  return fillRectSheetPdf(meta, result, sheet.structureTemplate?.rectPdfSet ?? null, {
    date: sheet.calc?.sheetDate
      ? new Intl.DateTimeFormat("en-US").format(sheet.calc.sheetDate)
      : "",
  });
}

/** The PDF set fields the rect fill needs (a template's `rectPdfSet`). */
export type RectSheetPdfSet = {
  name: string;
  files: {
    setId: string;
    hasTopSlab: boolean;
    hasBaseSlab: boolean;
    filePath: string;
    originalName: string;
  }[];
};

/**
 * Fills the PDF-set variant matching an already-computed rect sheet. Shared
 * by saved sheets and the One-Off live preview of rows not yet created.
 */
export async function fillRectSheetPdf(
  meta: RectSheetPreviewMeta,
  result: RectStructureResult,
  pdfSet: RectSheetPdfSet | null,
  extras: { date?: string } = {},
): Promise<RectSheetPdfBuildResult> {
  if (!pdfSet) {
    return {
      ok: false,
      error:
        "This template has no sheet PDF set assigned. Pick one on the structure template (Structures → template → Sheet PDF Set).",
    };
  }
  const variant = selectRectTemplateVariant(pdfSet.files, result);
  if (!variant) {
    const wanted = rectTemplateVariantKey(result.hasTopSlab, result.hasBaseSlab);
    return {
      ok: false,
      error: `The "${pdfSet.name}" PDF set has no ${wanted} variant. Upload it in Structures → Sheet PDF Sets.`,
    };
  }

  const templateBytes = await readRectPdfSetFileBytes(variant);
  const fieldMap = buildRectSheetFieldMap(meta, result, extras);
  const filled = await fillRectSheetTemplatePdf(templateBytes, fieldMap, result);
  const bytes = await flattenPdfForms(filled);

  return {
    ok: true,
    bytes,
    meta,
    variantKey: rectTemplateVariantKey(variant.hasTopSlab, variant.hasBaseSlab),
    originalName: variant.originalName,
  };
}
