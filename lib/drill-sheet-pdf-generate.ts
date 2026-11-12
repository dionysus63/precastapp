import { PDFDocument, StandardFonts } from "pdf-lib";
import { removeFlattenLeftovers } from "@/lib/pdf-flatten-cleanup";
import { PDF_SAVE_OPTIONS } from "@/lib/pdf-save-options";
import type {
  DrillSheetDetail,
  DrillSheetWithDetail,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetDetail } from "@/lib/drill-sheet-detail";
import type { MoldSheetSettings } from "@/lib/mold-sheet-settings";
import { loadMoldSheetSettings } from "@/lib/mold-sheet-settings-load";
import { buildDrillSheetPdfHtml } from "@/lib/drill-sheet-pdf-html";
import { appendDrillSheetFillablePage } from "@/lib/drill-sheet-pdf-fillable";
import {
  buildDrillSheetFieldMap,
  fillDrillSheetTemplatePdf,
  templateVariantKey,
} from "@/lib/drill-sheet-template-pdf";
import { readSheetPdfBytes } from "@/lib/sheet-pdf-service";
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
    removeFlattenLeftovers(doc);
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
  /** The Sheet PDF the sheet was filled on; null for the generated layout. */
  sheetPdfName: string | null;
};

/** The Sheet PDF fields the circular fill needs (a template's `sheetPdf`). */
export type DrillSheetPdfFile = {
  name: string;
  filePath: string;
};

export async function buildDrillSheetPdfBytes(
  sheet: DrillSheetWithDetail,
  /** Mold registry settings; loaded here when the caller has none handy. */
  molds?: readonly MoldSheetSettings[],
): Promise<DrillSheetPdfBuildResult | null> {
  const detail = buildDrillSheetDetail(
    sheet,
    molds ?? (await loadMoldSheetSettings()),
  );
  if (!detail) {
    return null;
  }
  return buildDrillSheetPdfFromDetail(
    detail,
    sheet.structureTemplate?.sheetPdf ?? null,
  );
}

/**
 * Fills the drill sheet PDF from an already-computed sheet: the template's
 * Sheet PDF when it has one, else the generated HTML sheet plus the fillable
 * form page. Shared by saved sheets and the Quick Build live preview, which
 * renders rows that don't exist yet.
 */
export async function buildDrillSheetPdfFromDetail(
  detail: DrillSheetDetail,
  sheetPdf: DrillSheetPdfFile | null,
): Promise<DrillSheetPdfBuildResult> {
  const hasRiser = detail.result.sections.some(
    (section) => section.role === "RISER",
  );
  const hasKey = detail.result.hasKey;
  const computedVariant = {
    hasRiser,
    hasKey,
    key: templateVariantKey(hasRiser, hasKey),
  };

  // One round Sheet PDF covers every riser/key combination: the app draws
  // those differences itself.
  if (sheetPdf) {
    let templateBytes: Uint8Array;
    try {
      templateBytes = await readSheetPdfBytes(sheetPdf);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new Error(
          `The file for the Sheet PDF "${sheetPdf.name}" is missing from the server. Upload it again with Replace in Structures → Sheet PDFs.`,
        );
      }
      throw error;
    }
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
      sheetPdfName: sheetPdf.name,
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
    sheetPdfName: null,
  };
}
