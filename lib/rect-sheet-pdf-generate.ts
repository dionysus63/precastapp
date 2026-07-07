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
import { rectTemplateVariantKey } from "@/lib/structure-template-pdf-service";

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
  );

  const meta: RectSheetPreviewMeta = {
    structureNumber: sheet.structureNumber ?? "",
    contractor: sheet.calc?.contractorName ?? "",
    project: sheet.calc?.projectName ?? "",
    templateName: sheet.structureTemplate?.name ?? "",
    castingName: casting?.name ?? null,
  };

  const pdfSet = sheet.structureTemplate?.rectPdfSet ?? null;
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
      error: `The "${pdfSet.name}" PDF set has no ${wanted} variant. Upload it in Structures → Rect PDF Sets.`,
    };
  }

  const templateBytes = await readRectPdfSetFileBytes(variant);
  const fieldMap = buildRectSheetFieldMap(meta, result, {
    date: sheet.calc?.sheetDate
      ? new Intl.DateTimeFormat("en-US").format(sheet.calc.sheetDate)
      : "",
  });
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
