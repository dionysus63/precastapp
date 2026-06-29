import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import type { DrillSheetResult } from "@/lib/drill-sheet";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const LABEL_SIZE = 7;
const FIELD_HEIGHT = 16;
const BORDER = rgb(0.55, 0.6, 0.66);
const LABEL_COLOR = rgb(0.29, 0.33, 0.39);
const TITLE_COLOR = rgb(0.07, 0.09, 0.15);

function feet(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }
  return value.toFixed(2);
}

type FieldContext = {
  doc: PDFDocument;
  page: PDFPage;
  label: PDFFont;
  used: Set<string>;
};

/** Draws a small caption and an interactive text field box beneath it. */
function drawField(
  ctx: FieldContext,
  name: string,
  caption: string,
  value: string,
  x: number,
  topY: number,
  width: number,
  options: { multiline?: boolean; height?: number } = {},
): void {
  ctx.page.drawText(caption, {
    x,
    y: topY,
    size: LABEL_SIZE,
    font: ctx.label,
    color: LABEL_COLOR,
  });

  const height = options.height ?? FIELD_HEIGHT;
  const form = ctx.doc.getForm();
  // Field names must be unique across the AcroForm.
  let fieldName = name;
  let suffix = 2;
  while (ctx.used.has(fieldName)) {
    fieldName = `${name}_${suffix++}`;
  }
  ctx.used.add(fieldName);

  const field = form.createTextField(fieldName);
  if (value) {
    field.setText(value);
  }
  if (options.multiline) {
    field.enableMultiline();
  }
  field.setFontSize(9);
  field.addToPage(ctx.page, {
    x,
    y: topY - 4 - height,
    width,
    height,
    borderWidth: 0.75,
    borderColor: BORDER,
  });
}

/**
 * Appends a single interactive (AcroForm) page to an existing drill-sheet PDF.
 * The page mirrors the Long Island Precast manhole form's hand-fill blanks —
 * header, sign-off, the A/B/C/D opening table, and notes — prefilled with the
 * computed values so it can be edited or completed in the field.
 */
export async function appendDrillSheetFillablePage(
  pdfBytes: Uint8Array,
  meta: DrillSheetPreviewMeta,
  result: DrillSheetResult,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const label = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: FieldContext = { doc, page, label, used: new Set() };

  let y = PAGE_HEIGHT - MARGIN;

  page.drawText("DRILL SHEET — FILLABLE COPY", {
    x: MARGIN,
    y: y - 12,
    size: 13,
    font: bold,
    color: TITLE_COLOR,
  });
  page.drawText(
    meta.manholeNumber
      ? `Structure ${meta.manholeNumber}`
      : "Editable / inspection copy",
    {
      x: MARGIN,
      y: y - 26,
      size: 9,
      font: label,
      color: LABEL_COLOR,
    },
  );
  y -= 48;

  // Two-column header grid.
  const colGap = 16;
  const colWidth = (PAGE_WIDTH - MARGIN * 2 - colGap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + colGap;
  const rowStep = FIELD_HEIGHT + LABEL_SIZE + 12;

  const headerRows: [string, string, string, string, string, string][] = [
    // [leftName, leftCaption, leftValue, rightName, rightCaption, rightValue]
    [
      "ds_structure",
      "STRUCTURE #",
      meta.manholeNumber,
      "ds_casting",
      "CASTING",
      meta.castingName,
    ],
    [
      "ds_contractor",
      "CONTRACTOR",
      meta.contractor,
      "ds_project",
      "PROJECT",
      meta.project,
    ],
    ["ds_date", "DATE", meta.date, "ds_inspection", "INSPECTION", meta.inspection],
    [
      "ds_approved",
      "APPROVED BY",
      meta.approvedBy,
      "ds_template",
      "TEMPLATE",
      meta.templateName,
    ],
    [
      "ds_use_base",
      "USE (BASE)",
      meta.useBase,
      "ds_use_riser",
      "USE / RISER",
      meta.useRiser,
    ],
    [
      "ds_brick_adj",
      "BRICK ADJUSTMENT",
      meta.brickAdjustment,
      "ds_wall_height",
      "WALL HEIGHT (FT)",
      feet(result.wallHeightFeet),
    ],
  ];

  for (const [ln, lc, lv, rn, rc, rv] of headerRows) {
    drawField(ctx, ln, lc, lv, leftX, y, colWidth);
    drawField(ctx, rn, rc, rv, rightX, y, colWidth);
    y -= rowStep;
  }

  y -= 6;

  // Pipe openings table — Op / Invert / Dia / Type / Boot (matches paper form).
  page.drawText("PIPE OPENINGS", {
    x: MARGIN,
    y: y,
    size: 9,
    font: bold,
    color: TITLE_COLOR,
  });
  y -= 14;

  const cols = [
    { key: "op", title: "OP", x: MARGIN, w: 40 },
    { key: "invert", title: "INVERT", x: MARGIN + 40, w: 110 },
    { key: "dia", title: "DIA", x: MARGIN + 150, w: 70 },
    { key: "type", title: "TYPE", x: MARGIN + 220, w: 130 },
    { key: "boot", title: "BOOT", x: MARGIN + 350, w: PAGE_WIDTH - MARGIN - (MARGIN + 350) },
  ];

  for (const col of cols) {
    page.drawText(col.title, {
      x: col.x + 2,
      y,
      size: LABEL_SIZE,
      font: bold,
      color: LABEL_COLOR,
    });
  }
  y -= 4;

  const rowHeight = 20;
  const rowCount = Math.max(result.openings.length, 4);
  for (let i = 0; i < rowCount; i += 1) {
    const opening = result.openings[i];
    const rowTop = y;
    const cellTop = rowTop; // caption-less cells: pass topY so box sits just below
    const placeCell = (
      name: string,
      value: string,
      x: number,
      w: number,
    ) => {
      const form = doc.getForm();
      let fieldName = name;
      let suffix = 2;
      while (ctx.used.has(fieldName)) {
        fieldName = `${name}_${suffix++}`;
      }
      ctx.used.add(fieldName);
      const field = form.createTextField(fieldName);
      if (value) {
        field.setText(value);
      }
      field.setFontSize(9);
      field.addToPage(page, {
        x,
        y: cellTop - rowHeight,
        width: w,
        height: rowHeight,
        borderWidth: 0.75,
        borderColor: BORDER,
      });
    };

    const labelChar =
      opening?.label || String.fromCharCode(65 + i);
    placeCell(`ds_op_${i}`, labelChar, cols[0].x, cols[0].w);
    placeCell(
      `ds_invert_${i}`,
      opening ? feet(opening.invertElevation) : "",
      cols[1].x,
      cols[1].w,
    );
    placeCell(
      `ds_dia_${i}`,
      opening?.pipeSizeInches != null ? String(opening.pipeSizeInches) : "",
      cols[2].x,
      cols[2].w,
    );
    placeCell(
      `ds_type_${i}`,
      opening?.pipeType ?? "",
      cols[3].x,
      cols[3].w,
    );
    placeCell(
      `ds_boot_${i}`,
      opening?.bootModel ?? "",
      cols[4].x,
      cols[4].w,
    );

    y -= rowHeight;
  }

  y -= 18;

  // Notes / sign-off block.
  drawField(ctx, "ds_notes", "NOTES", result.errorMessage ?? "", MARGIN, y, PAGE_WIDTH - MARGIN * 2, {
    multiline: true,
    height: 60,
  });

  return doc.save();
}
