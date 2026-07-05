import { PDFDocument, StandardFonts } from "pdf-lib";
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

/**
 * Bakes all AcroForm field values into the page content and removes the
 * interactive fields, so recipients (e.g. contractors reviewing a submittal)
 * cannot edit the PDF. Falls back to marking fields read-only if a field
 * cannot be flattened.
 */
export async function flattenPdfForms(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  if (form.getFields().length === 0) {
    return bytes;
  }

  try {
    // Fields authored in external tools (AutoCAD/Bluebeam) often lack
    // appearance streams; generate them first so flatten() has something
    // to draw into the page.
    const font = await doc.embedFont(StandardFonts.Helvetica);
    form.updateFieldAppearances(font);
    form.flatten();
  } catch {
    for (const field of form.getFields()) {
      try {
        field.enableReadOnly();
      } catch {
        // Leave the field as-is rather than failing the whole sheet.
      }
    }
  }

  return doc.save();
}

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
    const filled = await fillDrillSheetTemplatePdf(
      templateBytes,
      fieldMap,
      detail.result.openings,
      detail.result,
    );
    const bytes = await flattenPdfForms(filled);

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
  const withFormPage = await appendDrillSheetFillablePage(
    computedBytes,
    detail.meta,
    detail.result,
  );
  const bytes = await flattenPdfForms(withFormPage);

  return {
    bytes,
    source: "generated",
    computedVariant,
    templateVariant: null,
  };
}
