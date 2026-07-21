/**
 * Generates assets/templates/invoice-template.pdf and
 * assets/templates/invoice-template-continuation.pdf in the same visual
 * language as the quote and delivery-ticket templates (Rev1 grid).
 *
 * Run with: npx tsx scripts/generate-invoice-templates.ts
 *
 * The item-table grid must match lib/quote-pdf-layout.ts exactly — invoice
 * line items are drawn by the quote line-item code (lib/invoice-pdf-line-items.ts).
 * AcroForm field names must match INVOICE_TEMPLATE_FIELD_NAMES in
 * lib/invoice-pdf-data.ts.
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  TextAlignment,
  rgb,
} from "pdf-lib";
import {
  CONT_TABLE_BOTTOM_Y,
  MAIN_TABLE_BOTTOM_Y,
  TABLE_LEFT_X,
  TABLE_RIGHT_X,
} from "../lib/quote-pdf-layout";

const TEMPLATE_DIR = path.join(process.cwd(), "assets", "templates");

const GRAY_FILL = rgb(0.851, 0.851, 0.851);
const GRAY_TEXT = rgb(0.666, 0.666, 0.666);
const BLACK = rgb(0, 0, 0);
const BORDER_WIDTH = 0.75;
const RULE_WIDTH = 0.5;

// Header image placement measured from the quote template.
const HEADER_IMAGE = { x: 48.7, y: 666.2, width: 348, height: 85.8 };

// Info box (Bill To / project details), same as the quote template.
const INFO_BOX = { top: 661.7, bottom: 583.1, dividerX: 312.7 };

// Meta strip (four even cells: Ticket #, Invoice Date, Due Date, Page).
// Slimmer than the quote template's strip, centered in the same envelope.
const STRIP = { top: 568.4, labelBottom: 554.9, bottom: 539.9 };

// Item table header band; verticals from lib/quote-pdf-layout.ts comments.
const TABLE_HEADER = { top: 525.1, bottom: 507.1 };
const TABLE_VERTICALS = [104.7, 148.7, 408.7, 486.7];

// Bottom boxes (main template only), same envelope as the quote template.
const BOTTOM_BOX = { top: 132.2, bottom: 60.2 };
const REMIT_BOX = { left: 48, right: 400 };
const TOTALS_BOX = { left: 408, right: 564, dividerX: 495 };

// No Discount row: discounts are rare and entered as line items; any stored
// discount amount is already netted into the printed Subtotal.
const TOTALS_ROWS = [
  { label: "Subtotal", field: "Subtotal", bold: false },
  { label: "Delivery", field: "Delivery", bold: false },
  { label: "Tax Rate", field: "Tax Rate", bold: false },
  { label: "Sales Tax", field: "Sales Tax", bold: false },
  { label: "TOTAL", field: "Total", bold: true },
];

type Ctx = {
  page: PDFPage;
  doc: PDFDocument;
  helv: PDFFont;
  helvBold: PDFFont;
};

function drawBox(
  page: PDFPage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  options: { fill?: boolean; borderWidth?: number } = {},
) {
  page.drawRectangle({
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
    borderColor: options.fill ? undefined : BLACK,
    borderWidth: options.fill ? undefined : options.borderWidth ?? BORDER_WIDTH,
    color: options.fill ? GRAY_FILL : undefined,
  });
}

function drawLine(page: PDFPage, x0: number, y0: number, x1: number, y1: number) {
  page.drawLine({
    start: { x: x0, y: y0 },
    end: { x: x1, y: y1 },
    thickness: RULE_WIDTH,
    color: BLACK,
  });
}

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerX: number,
  baselineY: number,
  size: number,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y: baselineY, size, font, color: BLACK });
}

function addTextField(
  ctx: Ctx,
  name: string,
  rect: { x0: number; y0: number; x1: number; y1: number },
  options: {
    fontSize?: number;
    alignment?: TextAlignment;
    bold?: boolean;
    grayText?: boolean;
    multiline?: boolean;
  } = {},
) {
  const form = ctx.doc.getForm();
  const field = form.createTextField(name);
  if (options.alignment !== undefined) {
    field.setAlignment(options.alignment);
  }
  if (options.multiline) {
    field.enableMultiline();
  }
  field.addToPage(ctx.page, {
    x: rect.x0,
    y: rect.y0,
    width: rect.x1 - rect.x0,
    height: rect.y1 - rect.y0,
    borderWidth: 0,
    font: options.bold ? ctx.helvBold : ctx.helv,
    textColor: options.grayText ? GRAY_TEXT : BLACK,
  });
  // After addToPage so the field has a /DA entry to update.
  field.setFontSize(options.fontSize ?? 9);
}

async function drawSharedTop(ctx: Ctx, headerImageBytes: Uint8Array) {
  const { page, helv, helvBold } = ctx;

  const headerImage = await ctx.doc.embedPng(headerImageBytes);
  page.drawImage(headerImage, HEADER_IMAGE);

  // Title, right-aligned like "Price Quote" on the quote template.
  const title = "Invoice";
  const titleSize = 20;
  const titleWidth = helvBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: 560 - titleWidth,
    y: 692,
    size: titleSize,
    font: helvBold,
    color: BLACK,
  });
  // Invoice number under the title (gray bold, like the quote/ticket
  // number), centered on the word "Invoice" above it.
  const titleCenterX = 560 - titleWidth / 2;
  addTextField(
    ctx,
    "Invoice Number",
    { x0: titleCenterX - 63, y0: 673.1, x1: titleCenterX + 63, y1: 689.1 },
    { fontSize: 12, alignment: TextAlignment.Center, bold: true, grayText: true },
  );

  // Info box.
  drawBox(page, TABLE_LEFT_X, INFO_BOX.bottom, TABLE_RIGHT_X, INFO_BOX.top);
  drawLine(page, INFO_BOX.dividerX, INFO_BOX.bottom, INFO_BOX.dividerX, INFO_BOX.top);

  const labelSize = 9;
  page.drawText("Bill To:", { x: 56.7, y: 646.1, size: labelSize, font: helvBold, color: BLACK });
  addTextField(ctx, "Bill To Name", { x0: 95, y0: 644.1, x1: 306.7, y1: 658.1 });
  // Billing contact's full name under the company, then the address.
  addTextField(ctx, "Bill To Contact", { x0: 56.7, y0: 625, x1: 306.7, y1: 639 });
  addTextField(ctx, "Bill To Address 1", { x0: 56.7, y0: 606.3, x1: 306.7, y1: 620.3 });
  addTextField(ctx, "Bill To Address 2", { x0: 56.7, y0: 587.6, x1: 306.7, y1: 601.6 });

  const rightLabels: Array<{ text: string; y: number; field: string }> = [
    { text: "Project Name:", y: 644.1, field: "Project Name" },
    { text: "Job Number:", y: 625.1, field: "Job Number" },
  ];
  for (const label of rightLabels) {
    page.drawText(label.text, { x: 320.7, y: label.y, size: labelSize, font: helvBold, color: BLACK });
    const fieldX = 320.7 + helvBold.widthOfTextAtSize(label.text, labelSize) + 6;
    addTextField(ctx, label.field, { x0: fieldX, y0: label.y - 2, x1: 561.7, y1: label.y + 12 });
  }
  // Full delivery address (multi-line) fills the space the ticket number
  // left behind — the ticket number lives in the meta strip now.
  const deliveryLabel = "Delivery Address:";
  page.drawText(deliveryLabel, { x: 320.7, y: 606.1, size: labelSize, font: helvBold, color: BLACK });
  addTextField(
    ctx,
    "Delivery Address",
    {
      x0: 320.7 + helvBold.widthOfTextAtSize(deliveryLabel, labelSize) + 6,
      y0: 585.9,
      x1: 561.7,
      y1: 617.9,
    },
    { multiline: true },
  );

  // Meta strip: gray label band over a value row, four even cells, text
  // centered vertically in both bands.
  drawBox(page, TABLE_LEFT_X, STRIP.labelBottom, TABLE_RIGHT_X, STRIP.top, { fill: true });
  drawBox(page, TABLE_LEFT_X, STRIP.bottom, TABLE_RIGHT_X, STRIP.top);
  drawLine(page, TABLE_LEFT_X, STRIP.labelBottom, TABLE_RIGHT_X, STRIP.labelBottom);
  const stripCells: Array<{ label: string; field: string }> = [
    { label: "Ticket #", field: "Ticket Number" },
    { label: "Invoice Date", field: "Invoice Date" },
    { label: "Due Date", field: "Due Date" },
    { label: "Page", field: "Page" },
  ];
  const cellWidth = (TABLE_RIGHT_X - TABLE_LEFT_X) / stripCells.length;
  const labelBandCenter = (STRIP.top + STRIP.labelBottom) / 2;
  const valueBandCenter = (STRIP.labelBottom + STRIP.bottom) / 2;
  stripCells.forEach((cell, index) => {
    const cellLeft = TABLE_LEFT_X + index * cellWidth;
    if (index > 0) {
      drawLine(page, cellLeft, STRIP.bottom, cellLeft, STRIP.top);
    }
    drawCenteredText(
      page,
      ctx.helvBold,
      cell.label,
      cellLeft + cellWidth / 2,
      labelBandCenter - 8 * 0.36,
      8,
    );
    addTextField(
      ctx,
      cell.field,
      {
        x0: cellLeft + 3,
        y0: valueBandCenter - 6,
        x1: cellLeft + cellWidth - 3,
        y1: valueBandCenter + 6,
      },
      { alignment: TextAlignment.Center },
    );
  });

  // Item table header band.
  drawBox(page, TABLE_LEFT_X, TABLE_HEADER.bottom, TABLE_RIGHT_X, TABLE_HEADER.top, { fill: true });
  const columnEdges = [TABLE_LEFT_X, ...TABLE_VERTICALS, TABLE_RIGHT_X];
  const headers = ["Item #", "Qty", "Description", "Unit Price", "Total"];
  headers.forEach((header, index) => {
    drawCenteredText(
      page,
      helvBold,
      header,
      (columnEdges[index]! + columnEdges[index + 1]!) / 2,
      509.4,
      8,
    );
  });

  void helv;
}

function drawTableFrame(ctx: Ctx, tableBottomY: number) {
  const { page } = ctx;
  drawBox(page, TABLE_LEFT_X, tableBottomY, TABLE_RIGHT_X, TABLE_HEADER.top);
  drawLine(page, TABLE_LEFT_X, TABLE_HEADER.bottom, TABLE_RIGHT_X, TABLE_HEADER.bottom);
  for (const x of TABLE_VERTICALS) {
    drawLine(page, x, tableBottomY, x, TABLE_HEADER.top);
  }
}

function drawMainBottom(ctx: Ctx) {
  const { page, helv, helvBold } = ctx;

  // Remittance box (where the quote has Notes).
  drawBox(page, REMIT_BOX.left, BOTTOM_BOX.bottom, REMIT_BOX.right, BOTTOM_BOX.top);
  page.drawText("Remit Payment To:", { x: 53, y: 120.2, size: 8.5, font: helvBold, color: BLACK });
  const remitLines = [
    "Long Island Precast",
    "20 Stiriz Road, Brookhaven, NY 11719",
    "Please include the invoice number with your payment.",
  ];
  remitLines.forEach((line, index) => {
    page.drawText(line, { x: 53, y: 106.2 - index * 13, size: 8.5, font: helv, color: BLACK });
  });
  page.drawText("Thank you for your business.", {
    x: 53,
    y: 66,
    size: 8.5,
    font: helvBold,
    color: BLACK,
  });

  // Totals box: six 12pt rows, labels left of the divider, values right.
  drawBox(page, TOTALS_BOX.left, BOTTOM_BOX.bottom, TOTALS_BOX.right, BOTTOM_BOX.top);
  drawLine(page, TOTALS_BOX.dividerX, BOTTOM_BOX.bottom, TOTALS_BOX.dividerX, BOTTOM_BOX.top);
  const rowHeight = (BOTTOM_BOX.top - BOTTOM_BOX.bottom) / TOTALS_ROWS.length;
  TOTALS_ROWS.forEach((row, index) => {
    const rowTop = BOTTOM_BOX.top - index * rowHeight;
    const rowBottom = rowTop - rowHeight;
    if (index > 0) {
      drawLine(page, TOTALS_BOX.left, rowTop, TOTALS_BOX.right, rowTop);
    }
    if (row.bold) {
      drawBox(page, TOTALS_BOX.dividerX, rowBottom, TOTALS_BOX.right, rowTop, { fill: true });
      drawBox(page, TOTALS_BOX.dividerX, rowBottom, TOTALS_BOX.right, rowTop);
    }
    const size = row.bold ? 9 : 8.5;
    const labelWidth = helvBold.widthOfTextAtSize(row.label, size);
    page.drawText(row.label, {
      x: TOTALS_BOX.dividerX - 4 - labelWidth,
      y: rowBottom + rowHeight / 2 - size / 2 + 1,
      size,
      font: helvBold,
      color: BLACK,
    });
    addTextField(
      ctx,
      row.field,
      {
        x0: TOTALS_BOX.dividerX + 2,
        y0: rowBottom + 0.5,
        x1: TOTALS_BOX.right - 3,
        y1: rowTop - 0.5,
      },
      { alignment: TextAlignment.Right, bold: row.bold },
    );
  });
}

async function buildTemplate(
  headerImageBytes: Uint8Array,
  variant: "main" | "continuation",
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { page, doc, helv, helvBold };

  await drawSharedTop(ctx, headerImageBytes);

  if (variant === "main") {
    drawTableFrame(ctx, MAIN_TABLE_BOTTOM_Y);
    drawMainBottom(ctx);
  } else {
    drawTableFrame(ctx, CONT_TABLE_BOTTOM_Y);
  }

  doc.setTitle(
    variant === "main" ? "Invoice Template" : "Invoice Template (Continuation)",
  );
  return doc.save();
}

async function main() {
  const headerImageBytes = new Uint8Array(
    await readFile(path.join(TEMPLATE_DIR, "lip-header.png")),
  );

  const mainBytes = await buildTemplate(headerImageBytes, "main");
  await writeFile(path.join(TEMPLATE_DIR, "invoice-template.pdf"), mainBytes);

  const contBytes = await buildTemplate(headerImageBytes, "continuation");
  await writeFile(
    path.join(TEMPLATE_DIR, "invoice-template-continuation.pdf"),
    contBytes,
  );

  console.log("Wrote invoice-template.pdf and invoice-template-continuation.pdf");
}

void main();
