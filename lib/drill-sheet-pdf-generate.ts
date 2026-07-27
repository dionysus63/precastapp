import { PDFDocument, StandardFonts } from "pdf-lib";
import { PDF_SAVE_OPTIONS } from "@/lib/pdf-save-options";
import type { DrillSheetWithDetail } from "@/lib/drill-sheet-detail";
import {
  buildDrillSheetDetail,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetPdfHtml } from "@/lib/drill-sheet-pdf-html";
import { appendDrillSheetFillablePage } from "@/lib/drill-sheet-pdf-fillable";
import {
  buildDrillSheetFieldMap,
  fillDrillSheetTemplatePdf,
  templateVariantKey,
} from "@/lib/drill-sheet-template-pdf";
import { readRectPdfSetFileBytes } from "@/lib/rect-pdf-set-service";
import { rectTemplateVariantKey } from "@/lib/structure-template-pdf-service";
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

  return doc.save(PDF_SAVE_OPTIONS);
}

export type DrillSheetPdfSource = "template" | "generated";

export type DrillSheetPdfBuildResult = {
  bytes: Uint8Array;
  source: DrillSheetPdfSource;
  computedVariant: { hasRiser: boolean; hasKey: boolean; key: string };
  templateVariant: {
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

  // Circular sets hold one file stored under the {false,false} slot; the app
  // draws riser/key differences itself.
  const setFiles = sheet.structureTemplate?.rectPdfSet?.files ?? [];
  const setFile =
    setFiles.find((file) => !file.hasTopSlab && !file.hasBaseSlab) ??
    setFiles[0] ??
    null;

  if (setFile) {
    const templateBytes = await readRectPdfSetFileBytes(setFile);
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
        key: rectTemplateVariantKey(setFile.hasTopSlab, setFile.hasBaseSlab),
        originalName: setFile.originalName,
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
