import type { DrillSheetWithDetail } from "@/lib/drill-sheet-detail";
import {
  buildDrillSheetDetail,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetPdfHtml } from "@/lib/drill-sheet-pdf-html";
import { appendDrillSheetFillablePage } from "@/lib/drill-sheet-pdf-fillable";
import {
  buildDrillSheetFieldMap,
  fillDrillSheetTemplatePdf,
  selectTemplateVariant,
  templateVariantKey,
} from "@/lib/drill-sheet-template-pdf";
import { readTemplatePdfBytes } from "@/lib/structure-template-pdf-service";
import { renderPdfBytesFromHtml } from "@/lib/quote-pdf";

export type DrillSheetPdfSource = "template" | "generated";

export type DrillSheetPdfBuildResult = {
  bytes: Uint8Array;
  source: DrillSheetPdfSource;
  computedVariant: { hasRiser: boolean; hasKey: boolean; key: string };
  templateVariant: {
    hasRiser: boolean;
    hasKey: boolean;
    key: string;
    originalName: string;
  } | null;
};

export async function buildDrillSheetPdfBytes(
  sheet: DrillSheetWithDetail,
): Promise<DrillSheetPdfBuildResult | null> {
  const detail = buildDrillSheetDetail(sheet);
  if (!detail) {
    return null;
  }

  const hasRiser = detail.result.sections.some(
    (section) => section.role === "RISER",
  );
  const hasKey = detail.result.hasKey;
  const computedVariant = {
    hasRiser,
    hasKey,
    key: templateVariantKey(hasRiser, hasKey),
  };

  const templatePdfs = sheet.structureTemplate?.templatePdfs ?? [];
  const templateVariant = selectTemplateVariant(templatePdfs, detail.result);

  if (templateVariant) {
    const templateBytes = await readTemplatePdfBytes(templateVariant);
    const fieldMap = buildDrillSheetFieldMap(detail.meta, detail.result);
    const bytes = await fillDrillSheetTemplatePdf(templateBytes, fieldMap);

    return {
      bytes,
      source: "template",
      computedVariant,
      templateVariant: {
        hasRiser: templateVariant.hasRiser,
        hasKey: templateVariant.hasKey,
        key: templateVariantKey(
          templateVariant.hasRiser,
          templateVariant.hasKey,
        ),
        originalName: templateVariant.originalName,
      },
    };
  }

  const html = await buildDrillSheetPdfHtml(detail.meta, detail.result);
  const computedBytes = await renderPdfBytesFromHtml(html);
  const bytes = await appendDrillSheetFillablePage(
    computedBytes,
    detail.meta,
    detail.result,
  );

  return {
    bytes,
    source: "generated",
    computedVariant,
    templateVariant: null,
  };
}
