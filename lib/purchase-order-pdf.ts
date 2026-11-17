import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { PDF_SAVE_OPTIONS } from "@/lib/pdf-save-options";
import { toWinAnsiText } from "@/lib/pdf-text";

/**
 * The purchase order PDF, drawn from scratch with pdf-lib (no template file):
 * a letter page, the company header artwork, who the order goes to, where it
 * ships, the lines and the total. Lines that do not fit run on to further
 * pages; the notes, total and signature line close the last page.
 *
 * Three looks share one set of data and one pagination:
 *   house   the boxed, gray-banded grid of the quote, invoice and ticket
 *   clean   open layout, thin rules, the logo's red as the one accent
 *   ledger  charcoal bars and a full Excel-style grid, ruled to the bottom
 */
export type PurchaseOrderPdfDesign = "house" | "clean" | "ledger";

export const PURCHASE_ORDER_PDF_DESIGNS: PurchaseOrderPdfDesign[] = [
  "house",
  "clean",
  "ledger",
];

export type PurchaseOrderPdfParty = {
  name: string;
  /** Address, contact and phone lines, already in print order. */
  lines: string[];
};

export type PurchaseOrderPdfLine = {
  itemCode: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
};

/** Everything the page prints, already formatted for people. */
export type PurchaseOrderPdfData = {
  poNumber: string;
  orderDate: string;
  expectedDate: string;
  orderedBy: string;
  vendor: PurchaseOrderPdfParty;
  shipTo: PurchaseOrderPdfParty;
  lines: PurchaseOrderPdfLine[];
  total: string;
  notes: string;
  /** One line for the foot of the page: company name, address, phone. */
  companyLine: string;
};

export type RenderPurchaseOrderPdfOptions = {
  design: PurchaseOrderPdfDesign;
  /** PNG bytes of the company header artwork (logo, address, phone). */
  headerImagePng: Uint8Array | null;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
/** Same left and right edges as the quote, invoice and ticket templates. */
const LEFT = 48.7;
const RIGHT = 564.7;

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const HOUSE_GRAY_FILL = rgb(0.851, 0.851, 0.851);
const HOUSE_ROW_RULE = rgb(0.72, 0.72, 0.72);
/** The red of the company logo. */
const BRAND_RED = rgb(156 / 255, 63 / 255, 65 / 255);
/** The app's warm grays (app/globals.css). */
const INK = rgb(0x1d / 255, 0x1b / 255, 0x19 / 255);
const MUTED = rgb(0x6b / 255, 0x65 / 255, 0x5f / 255);
const HAIRLINE = rgb(0xcf / 255, 0xcc / 255, 0xc8 / 255);
const SOFT_FILL = rgb(0xf1 / 255, 0xf0 / 255, 0xee / 255);
const CHARCOAL = rgb(0x3a / 255, 0x36 / 255, 0x33 / 255);

const REMINDER =
  "Please show this purchase order number on all invoices, packing slips and correspondence.";

type Fonts = { regular: PDFFont; bold: PDFFont; oblique: PDFFont };

type Align = "left" | "right" | "center";

type ColumnKey =
  | "lineNumber"
  | "itemCode"
  | "description"
  | "quantity"
  | "unit"
  | "unitPrice"
  | "amount";

type Column = {
  key: ColumnKey;
  label: string;
  x0: number;
  x1: number;
  align: Align;
};

type Row = {
  number: number;
  cells: Record<ColumnKey, string[]>;
  height: number;
};

type Ctx = {
  doc: PDFDocument;
  fonts: Fonts;
  header: PDFImage | null;
  data: PurchaseOrderPdfData;
};

type TextOptions = {
  font: PDFFont;
  size: number;
  color?: RGB;
  align?: Align;
  /** Extra space after each letter, for small capital labels. */
  spacing?: number;
};

function textWidth(text: string, options: TextOptions): number {
  const spacing = options.spacing ?? 0;
  return (
    options.font.widthOfTextAtSize(text, options.size) +
    spacing * Math.max(text.length - 1, 0)
  );
}

/** Draws one line of text; `x` is the left edge, right edge or center. */
function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: TextOptions,
) {
  if (!text) {
    return;
  }
  const align = options.align ?? "left";
  const width = textWidth(text, options);
  let cursor = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  const color = options.color ?? BLACK;
  if (!options.spacing) {
    page.drawText(text, { x: cursor, y, size: options.size, font: options.font, color });
    return;
  }
  for (const char of text) {
    page.drawText(char, { x: cursor, y, size: options.size, font: options.font, color });
    cursor += options.font.widthOfTextAtSize(char, options.size) + options.spacing;
  }
}

function drawRule(
  page: PDFPage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
  color: RGB = BLACK,
) {
  page.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, thickness, color });
}

function fillRect(
  page: PDFPage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: RGB,
) {
  page.drawRectangle({ x: x0, y: y0, width: x1 - x0, height: y1 - y0, color });
}

function strokeRect(
  page: PDFPage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
  color: RGB = BLACK,
) {
  page.drawRectangle({
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
    borderColor: color,
    borderWidth: thickness,
  });
}

/** Breaks text into lines no wider than `maxWidth`, keeping typed line breaks. */
export function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      if (out.length > 0) {
        out.push("");
      }
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        out.push(line);
        line = "";
      }
      // A single word wider than the column is cut letter by letter.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) {
          cut -= 1;
        }
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) {
      out.push(line);
    }
  }
  while (out.length > 0 && out[out.length - 1] === "") {
    out.pop();
  }
  return out;
}

/** Cuts a line that must stay on one row, ending it with "..." when cut. */
function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }
  let cut = text.length;
  while (cut > 1 && font.widthOfTextAtSize(`${text.slice(0, cut)}...`, size) > maxWidth) {
    cut -= 1;
  }
  return `${text.slice(0, cut).trimEnd()}...`;
}

function drawHeaderImage(
  ctx: Ctx,
  page: PDFPage,
  x: number,
  top: number,
  width: number,
) {
  if (!ctx.header) {
    return;
  }
  const height = (width * ctx.header.height) / ctx.header.width;
  page.drawImage(ctx.header, { x, y: top - height, width, height });
}

function pageLabel(pageNumber: number, pageCount: number): string {
  return pageCount <= 1 ? "1" : `${pageNumber} of ${pageCount}`;
}

// ---------------------------------------------------------------------------
// Line rows and pagination (shared by every look)
// ---------------------------------------------------------------------------

type TableStyle = {
  columns: Column[];
  font: PDFFont;
  size: number;
  lineHeight: number;
  /** Space above the first and below the last text line of a row. */
  padTop: number;
  padBottom: number;
  /** Space between a column's edge and its text. */
  inset: number;
  minRowHeight: number;
};

function buildRows(data: PurchaseOrderPdfData, style: TableStyle): Row[] {
  return data.lines.map((line, index) => {
    const cells = {} as Record<ColumnKey, string[]>;
    let lineCount = 1;
    for (const column of style.columns) {
      const raw = column.key === "lineNumber" ? String(index + 1) : line[column.key];
      const wraps = column.key === "description" || column.key === "itemCode";
      const width = column.x1 - column.x0 - style.inset * 2;
      const lines = wraps
        ? wrapPdfText(raw, style.font, style.size, width)
        : [fitText(raw, style.font, style.size, width)];
      cells[column.key] = lines.length > 0 ? lines : [""];
      lineCount = Math.max(lineCount, cells[column.key].length);
    }
    const height = Math.max(
      style.minRowHeight,
      style.padTop + lineCount * style.lineHeight + style.padBottom,
    );
    return { number: index + 1, cells, height };
  });
}

/**
 * Splits the rows over pages. `firstRoom` and `nextRoom` are the heights
 * free for rows on the first and on later pages when nothing else follows;
 * the last page must also hold `closingHeight` (notes, total, signature).
 * When the closing block does not fit under the last rows it moves to a new
 * page and takes the last row with it, so that page is never bare.
 */
export function paginatePurchaseOrderRows<T extends { height: number }>(
  rows: T[],
  firstRoom: number,
  nextRoom: number,
  closingHeight: number,
): T[][] {
  const pages: T[][] = [[]];
  let used = 0;
  let room = firstRoom;
  for (const row of rows) {
    const current = pages[pages.length - 1]!;
    if (used + row.height > room && current.length > 0) {
      pages.push([row]);
      used = row.height;
      room = nextRoom;
      continue;
    }
    current.push(row);
    used += row.height;
  }
  if (used + closingHeight > room) {
    const last = pages[pages.length - 1]!;
    const carried = last.length > 1 ? last.splice(last.length - 1, 1) : [];
    pages.push(carried);
  }
  return pages;
}

function drawRowText(
  page: PDFPage,
  row: Row,
  rowTop: number,
  style: TableStyle,
  color: RGB,
  boldFont: PDFFont | null,
) {
  for (const column of style.columns) {
    const lines = row.cells[column.key];
    const font = boldFont && column.key === "amount" ? boldFont : style.font;
    lines.forEach((text, index) => {
      const y = rowTop - style.padTop - style.size * 0.78 - index * style.lineHeight;
      const x =
        column.align === "right"
          ? column.x1 - style.inset
          : column.align === "center"
            ? (column.x0 + column.x1) / 2
            : column.x0 + style.inset;
      drawText(page, text, x, y, { font, size: style.size, color, align: column.align });
    });
  }
}

function drawPartyLines(
  page: PDFPage,
  party: PurchaseOrderPdfParty,
  x: number,
  firstBaseline: number,
  maxWidth: number,
  maxLines: number,
  fonts: Fonts,
  options: { nameSize: number; size: number; lineHeight: number; color: RGB },
) {
  const lines = [party.name, ...party.lines].filter((line) => line.trim());
  lines.slice(0, maxLines).forEach((line, index) => {
    const font = index === 0 ? fonts.bold : fonts.regular;
    const size = index === 0 ? options.nameSize : options.size;
    drawText(page, fitText(line, font, size, maxWidth), x, firstBaseline - index * options.lineHeight, {
      font,
      size,
      color: options.color,
    });
  });
}

// ---------------------------------------------------------------------------
// Look 1: house (the quote / invoice / ticket grid)
// ---------------------------------------------------------------------------

const HOUSE_COLUMNS: Column[] = [
  { key: "itemCode", label: "Item #", x0: LEFT, x1: 134.7, align: "left" },
  { key: "description", label: "Description", x0: 134.7, x1: 356.7, align: "left" },
  { key: "quantity", label: "Qty", x0: 356.7, x1: 398.7, align: "right" },
  { key: "unit", label: "Unit", x0: 398.7, x1: 434.7, align: "center" },
  { key: "unitPrice", label: "Unit Price", x0: 434.7, x1: 496.7, align: "right" },
  { key: "amount", label: "Total", x0: 496.7, x1: RIGHT, align: "right" },
];

function houseNotesLines(ctx: Ctx): string[] {
  return wrapPdfText(ctx.data.notes, ctx.fonts.regular, 9, 400 - LEFT - 14);
}

function houseClosingBoxHeight(ctx: Ctx): number {
  return Math.max(72, 22 + houseNotesLines(ctx).length * 11 + 6);
}

function renderHouse(ctx: Ctx) {
  const { doc, fonts, data } = ctx;
  const style: TableStyle = {
    columns: HOUSE_COLUMNS,
    font: fonts.regular,
    size: 9,
    lineHeight: 11,
    padTop: 5,
    padBottom: 4,
    inset: 4.5,
    minRowHeight: 0,
  };
  const rows = buildRows(data, style);

  const firstRowsTop = 507.1;
  const nextRowsTop = 677.1;
  const openBottom = 40;
  const boxBottom = 60.2;
  const boxHeight = houseClosingBoxHeight(ctx);
  const closingTableBottom = boxBottom + boxHeight + 8;
  const pages = paginatePurchaseOrderRows(
    rows,
    firstRowsTop - openBottom,
    nextRowsTop - openBottom,
    closingTableBottom - openBottom,
  );

  pages.forEach((pageRows, pageIndex) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const first = pageIndex === 0;
    const last = pageIndex === pages.length - 1;
    const label = pageLabel(pageIndex + 1, pages.length);

    let headerTop: number;
    if (first) {
      drawHeaderImage(ctx, page, LEFT, 752, 348);
      drawText(page, "Purchase Order", (410 + RIGHT) / 2, 712, {
        font: fonts.bold,
        size: 17,
        align: "center",
      });

      // Vendor and Ship To.
      strokeRect(page, LEFT, 583.1, RIGHT, 661.7, 0.75);
      drawRule(page, 312.7, 583.1, 312.7, 661.7, 0.5);
      drawText(page, "Vendor:", LEFT + 8, 648.5, { font: fonts.bold, size: 9 });
      drawPartyLines(page, data.vendor, LEFT + 8, 635.5, 312.7 - LEFT - 16, 5, fonts, {
        nameSize: 10,
        size: 9.5,
        lineHeight: 11.5,
        color: BLACK,
      });
      drawText(page, "Ship To:", 320.7, 648.5, { font: fonts.bold, size: 9 });
      drawPartyLines(page, data.shipTo, 320.7, 635.5, RIGHT - 320.7 - 8, 5, fonts, {
        nameSize: 10,
        size: 9.5,
        lineHeight: 11.5,
        color: BLACK,
      });

      // Strip of labelled cells.
      const cells = [
        { label: "Purchase Order #", value: data.poNumber, weight: 1.15, bold: true },
        { label: "Order Date", value: data.orderDate, weight: 1, bold: false },
        { label: "Expected Delivery", value: data.expectedDate, weight: 1.15, bold: false },
        { label: "Ordered By", value: data.orderedBy, weight: 1.2, bold: false },
        { label: "Page", value: label, weight: 0.7, bold: false },
      ];
      const totalWeight = cells.reduce((sum, cell) => sum + cell.weight, 0);
      fillRect(page, LEFT, 554.9, RIGHT, 568.4, HOUSE_GRAY_FILL);
      strokeRect(page, LEFT, 539.9, RIGHT, 568.4, 0.75);
      drawRule(page, LEFT, 554.9, RIGHT, 554.9, 0.5);
      let x = LEFT;
      cells.forEach((cell, index) => {
        const width = ((RIGHT - LEFT) * cell.weight) / totalWeight;
        if (index > 0) {
          drawRule(page, x, 539.9, x, 568.4, 0.5);
        }
        drawText(page, cell.label, x + width / 2, 558.6, {
          font: fonts.bold,
          size: 7.5,
          align: "center",
        });
        const font = cell.bold ? fonts.bold : fonts.regular;
        drawText(page, fitText(cell.value, font, 9.5, width - 8), x + width / 2, 544.2, {
          font,
          size: 9.5,
          align: "center",
        });
        x += width;
      });
      headerTop = 525.1;
    } else {
      drawText(page, "Purchase Order", LEFT, 728, { font: fonts.bold, size: 14 });
      drawText(page, `${data.poNumber}   ${data.vendor.name}`, LEFT, 712, {
        font: fonts.regular,
        size: 10,
      });
      drawText(page, `Page ${label}`, RIGHT, 712, {
        font: fonts.regular,
        size: 10,
        align: "right",
      });
      headerTop = 695.1;
    }

    // Line table: gray header band, full-height columns.
    const rowsTop = headerTop - 18;
    const tableBottom = last ? closingTableBottom : openBottom;
    fillRect(page, LEFT, rowsTop, RIGHT, headerTop, HOUSE_GRAY_FILL);
    strokeRect(page, LEFT, tableBottom, RIGHT, headerTop, 0.75);
    drawRule(page, LEFT, rowsTop, RIGHT, rowsTop, 0.5);
    for (const column of HOUSE_COLUMNS) {
      if (column.x0 > LEFT) {
        drawRule(page, column.x0, tableBottom, column.x0, headerTop, 0.5);
      }
      drawText(page, column.label, (column.x0 + column.x1) / 2, rowsTop + 6, {
        font: fonts.bold,
        size: 8,
        align: "center",
      });
    }
    let y = rowsTop;
    pageRows.forEach((row) => {
      drawRowText(page, row, y, style, BLACK, null);
      y -= row.height;
      drawRule(page, LEFT, y, RIGHT, y, 0.4, HOUSE_ROW_RULE);
    });

    if (last) {
      const boxTop = boxBottom + boxHeight;
      strokeRect(page, LEFT, boxBottom, 400, boxTop, 0.75);
      drawText(page, "Notes:", LEFT + 6, boxTop - 12.5, { font: fonts.bold, size: 9 });
      houseNotesLines(ctx).forEach((line, index) => {
        drawText(page, line, LEFT + 6, boxTop - 25 - index * 11, {
          font: fonts.regular,
          size: 9,
        });
      });

      // Total, then a line to sign on.
      fillRect(page, 408, boxTop - 20, 496.7, boxTop, HOUSE_GRAY_FILL);
      strokeRect(page, 408, boxTop - 20, RIGHT, boxTop, 0.75);
      drawRule(page, 496.7, boxTop - 20, 496.7, boxTop, 0.5);
      drawText(page, "TOTAL", 490.7, boxTop - 13.5, {
        font: fonts.bold,
        size: 9.5,
        align: "right",
      });
      drawText(page, data.total, RIGHT - 4.5, boxTop - 13.5, {
        font: fonts.bold,
        size: 9.5,
        align: "right",
      });
      drawRule(page, 408, boxBottom + 13, RIGHT, boxBottom + 13, 0.5);
      drawText(page, "Authorized By", 408, boxBottom + 3.5, {
        font: fonts.regular,
        size: 7.5,
      });
      drawText(page, "Date", 520, boxBottom + 3.5, { font: fonts.regular, size: 7.5 });
      drawText(page, REMINDER, PAGE_WIDTH / 2, 44, {
        font: fonts.regular,
        size: 7.5,
        align: "center",
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Look 2: clean (open layout, thin rules, red accent)
// ---------------------------------------------------------------------------

const CLEAN_COLUMNS: Column[] = [
  { key: "itemCode", label: "ITEM", x0: LEFT, x1: 136.7, align: "left" },
  { key: "description", label: "DESCRIPTION", x0: 136.7, x1: 356.7, align: "left" },
  { key: "quantity", label: "QTY", x0: 356.7, x1: 398.7, align: "right" },
  { key: "unit", label: "UNIT", x0: 398.7, x1: 434.7, align: "left" },
  { key: "unitPrice", label: "UNIT PRICE", x0: 434.7, x1: 498.7, align: "right" },
  { key: "amount", label: "AMOUNT", x0: 498.7, x1: RIGHT, align: "right" },
];

function cleanNotesLines(ctx: Ctx): string[] {
  return wrapPdfText(ctx.data.notes, ctx.fonts.regular, 9.5, 300);
}

function renderClean(ctx: Ctx) {
  const { doc, fonts, data } = ctx;
  const style: TableStyle = {
    columns: CLEAN_COLUMNS,
    font: fonts.regular,
    size: 9.5,
    lineHeight: 12,
    padTop: 7,
    padBottom: 6,
    // Text sits flush with the page margins: no boxes to stand clear of.
    inset: 0,
    minRowHeight: 0,
  };
  // A little air between neighbouring columns instead of an inset.
  style.columns = CLEAN_COLUMNS.map((column) => ({
    ...column,
    x0: column.align === "left" && column.x0 > LEFT ? column.x0 + 8 : column.x0,
  }));
  const rows = buildRows(data, style);

  const notesLines = cleanNotesLines(ctx);
  const firstRowsTop = 553;
  const nextRowsTop = 681;
  const openBottom = 72;
  /** Under the last row: total and notes, then the signature line. */
  const closingHeight = 16 + Math.max(30, 14 + notesLines.length * 12) + 64;
  const pages = paginatePurchaseOrderRows(
    rows,
    firstRowsTop - openBottom,
    nextRowsTop - openBottom,
    closingHeight,
  );
  const label = { font: fonts.bold, size: 7.5, color: MUTED, spacing: 0.8 } as const;

  pages.forEach((pageRows, pageIndex) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const first = pageIndex === 0;
    const last = pageIndex === pages.length - 1;

    let headerBaseline: number;
    if (first) {
      drawHeaderImage(ctx, page, LEFT, 756, 300);
      drawText(page, "PURCHASE ORDER", RIGHT, 737, {
        font: fonts.bold,
        size: 10,
        color: BRAND_RED,
        align: "right",
        spacing: 1.6,
      });
      drawText(page, data.poNumber, RIGHT, 706, {
        font: fonts.bold,
        size: 27,
        color: INK,
        align: "right",
      });
      drawRule(page, LEFT, 668, RIGHT, 668, 2, BRAND_RED);

      drawText(page, "VENDOR", LEFT, 648, label);
      drawPartyLines(page, data.vendor, LEFT, 633, 176, 5, fonts, {
        nameSize: 10.5,
        size: 9.5,
        lineHeight: 12,
        color: INK,
      });
      drawText(page, "SHIP TO", 236, 648, label);
      drawPartyLines(page, data.shipTo, 236, 633, 150, 5, fonts, {
        nameSize: 10.5,
        size: 9.5,
        lineHeight: 12,
        color: INK,
      });
      const facts = [
        ["Order date", data.orderDate],
        ["Expected delivery", data.expectedDate],
        ["Ordered by", data.orderedBy],
      ] as const;
      drawText(page, "ORDER", 400, 648, label);
      facts.forEach(([name, value], index) => {
        const y = 633 - index * 15;
        drawText(page, name, 400, y, { font: fonts.regular, size: 9.5, color: MUTED });
        drawText(page, fitText(value, fonts.bold, 9.5, 80), RIGHT, y, {
          font: fonts.bold,
          size: 9.5,
          color: INK,
          align: "right",
        });
        drawRule(page, 400, y - 4.5, RIGHT, y - 4.5, 0.5, HAIRLINE);
      });
      headerBaseline = 559;
    } else {
      drawText(page, "PURCHASE ORDER", LEFT, 737, {
        font: fonts.bold,
        size: 10,
        color: BRAND_RED,
        spacing: 1.6,
      });
      drawText(page, data.poNumber, LEFT, 716, { font: fonts.bold, size: 18, color: INK });
      drawText(page, data.vendor.name, RIGHT, 716, {
        font: fonts.regular,
        size: 10,
        color: MUTED,
        align: "right",
      });
      drawRule(page, LEFT, 704, RIGHT, 704, 2, BRAND_RED);
      headerBaseline = 687;
    }

    // Line table: small capital labels over one dark rule, hairlines between rows.
    for (const column of style.columns) {
      const x = column.align === "right" ? column.x1 : column.x0;
      drawText(page, column.label, x, headerBaseline, { ...label, align: column.align });
    }
    const rowsTop = headerBaseline - 6;
    drawRule(page, LEFT, rowsTop, RIGHT, rowsTop, 1, INK);
    let y = rowsTop;
    pageRows.forEach((row) => {
      drawRowText(page, row, y, style, INK, fonts.bold);
      y -= row.height;
      drawRule(page, LEFT, y, RIGHT, y, 0.5, HAIRLINE);
    });

    if (last) {
      // The total closes the amount column; notes sit to its left.
      drawRule(page, 398.7, y, RIGHT, y, 1.5, INK);
      drawText(page, "TOTAL", 398.7, y - 21, { ...label, size: 8.5 });
      drawText(page, data.total, RIGHT, y - 23, {
        font: fonts.bold,
        size: 15,
        color: INK,
        align: "right",
      });
      if (notesLines.length > 0) {
        drawText(page, "NOTES", LEFT, y - 21, label);
        notesLines.forEach((line, index) => {
          drawText(page, line, LEFT, y - 35 - index * 12, {
            font: fonts.regular,
            size: 9.5,
            color: INK,
          });
        });
      }
      drawRule(page, 398.7, 104, RIGHT, 104, 0.75, INK);
      drawText(page, "AUTHORIZED BY", 398.7, 93, label);
      drawText(page, "DATE", 520, 93, label);
      drawText(page, REMINDER, LEFT, 72, { font: fonts.oblique, size: 8, color: MUTED });
    }

    drawRule(page, LEFT, 58, RIGHT, 58, 0.5, HAIRLINE);
    drawText(page, data.companyLine, LEFT, 46, { font: fonts.regular, size: 7.5, color: MUTED });
    drawText(page, `Page ${pageLabel(pageIndex + 1, pages.length)}`, RIGHT, 46, {
      font: fonts.regular,
      size: 7.5,
      color: MUTED,
      align: "right",
    });
  });
}

// ---------------------------------------------------------------------------
// Look 3: ledger (charcoal bars, a full grid ruled to the bottom)
// ---------------------------------------------------------------------------

const LEDGER_COLUMNS: Column[] = [
  { key: "lineNumber", label: "#", x0: LEFT, x1: 70.7, align: "center" },
  { key: "itemCode", label: "ITEM", x0: 70.7, x1: 150.7, align: "left" },
  { key: "description", label: "DESCRIPTION", x0: 150.7, x1: 356.7, align: "left" },
  { key: "quantity", label: "QTY", x0: 356.7, x1: 398.7, align: "right" },
  { key: "unit", label: "UNIT", x0: 398.7, x1: 434.7, align: "center" },
  { key: "unitPrice", label: "UNIT PRICE", x0: 434.7, x1: 496.7, align: "right" },
  { key: "amount", label: "AMOUNT", x0: 496.7, x1: RIGHT, align: "right" },
];

const LEDGER_ROW_HEIGHT = 17;
const LEDGER_GRID = rgb(0x55 / 255, 0x50 / 255, 0x4b / 255);

function ledgerNotesLines(ctx: Ctx): string[] {
  return wrapPdfText(ctx.data.notes, ctx.fonts.regular, 9, 396 - LEFT - 12);
}

function ledgerClosingBoxHeight(ctx: Ctx): number {
  return Math.max(70, 14 + 8 + ledgerNotesLines(ctx).length * 11 + 4);
}

/** A charcoal title bar with a white label, the top of a ledger box. */
function drawLedgerBar(
  page: PDFPage,
  fonts: Fonts,
  text: string,
  x0: number,
  x1: number,
  top: number,
  height: number,
  align: Align = "left",
) {
  fillRect(page, x0, top - height, x1, top, CHARCOAL);
  const x = align === "center" ? (x0 + x1) / 2 : align === "right" ? x1 - 6 : x0 + 6;
  drawText(page, text, x, top - height / 2 - 2.9, {
    font: fonts.bold,
    size: 8,
    color: WHITE,
    align,
    spacing: 0.5,
  });
}

function renderLedger(ctx: Ctx) {
  const { doc, fonts, data } = ctx;
  const style: TableStyle = {
    columns: LEDGER_COLUMNS,
    font: fonts.regular,
    size: 9,
    lineHeight: 11,
    padTop: 4.5,
    padBottom: 1.5,
    inset: 4.5,
    minRowHeight: LEDGER_ROW_HEIGHT,
  };
  const rows = buildRows(data, style);

  const firstRowsTop = 558;
  const nextRowsTop = 690;
  const openBottom = 44;
  const boxBottom = 62;
  const boxHeight = ledgerClosingBoxHeight(ctx);
  const closingTableBottom = boxBottom + boxHeight + 8;
  const pages = paginatePurchaseOrderRows(
    rows,
    firstRowsTop - openBottom,
    nextRowsTop - openBottom,
    closingTableBottom - openBottom,
  );

  pages.forEach((pageRows, pageIndex) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const first = pageIndex === 0;
    const last = pageIndex === pages.length - 1;
    const label = pageLabel(pageIndex + 1, pages.length);

    let headerTop: number;
    if (first) {
      drawHeaderImage(ctx, page, LEFT, 752, 318);

      // Title block: a small grid of label and value cells.
      const blockLeft = 392;
      const labelRight = 462;
      const facts = [
        { name: "PO NUMBER", value: data.poNumber, bold: true, size: 11 },
        { name: "ORDER DATE", value: data.orderDate, bold: false, size: 9.5 },
        { name: "EXPECTED", value: data.expectedDate, bold: false, size: 9.5 },
        { name: "ORDERED BY", value: data.orderedBy, bold: false, size: 9.5 },
      ];
      drawLedgerBar(page, fonts, "PURCHASE ORDER", blockLeft, RIGHT, 752, 17, "center");
      const factHeight = 15;
      facts.forEach((fact, index) => {
        const top = 735 - index * factHeight;
        fillRect(page, blockLeft, top - factHeight, labelRight, top, SOFT_FILL);
        drawText(page, fact.name, blockLeft + 5, top - 10.4, {
          font: fonts.bold,
          size: 7,
          color: CHARCOAL,
          spacing: 0.3,
        });
        const font = fact.bold ? fonts.bold : fonts.regular;
        drawText(
          page,
          fitText(fact.value, font, fact.size, RIGHT - labelRight - 10),
          labelRight + 5,
          top - (fact.bold ? 11.2 : 10.6),
          { font, size: fact.size, color: INK },
        );
        drawRule(page, blockLeft, top - factHeight, RIGHT, top - factHeight, 0.5, LEDGER_GRID);
      });
      const blockBottom = 735 - facts.length * factHeight;
      drawRule(page, labelRight, blockBottom, labelRight, 735, 0.5, LEDGER_GRID);
      strokeRect(page, blockLeft, blockBottom, RIGHT, 752, 0.75, CHARCOAL);

      // Vendor and Ship To boxes.
      const boxes = [
        { title: "VENDOR", party: data.vendor, x0: LEFT, x1: 302.7 },
        { title: "SHIP TO", party: data.shipTo, x0: 310.7, x1: RIGHT },
      ];
      for (const box of boxes) {
        drawLedgerBar(page, fonts, box.title, box.x0, box.x1, 662, 14);
        strokeRect(page, box.x0, 584, box.x1, 662, 0.75, CHARCOAL);
        drawPartyLines(page, box.party, box.x0 + 6, 636, box.x1 - box.x0 - 12, 5, fonts, {
          nameSize: 10,
          size: 9.5,
          lineHeight: 11.5,
          color: INK,
        });
      }
      headerTop = 574;
    } else {
      drawLedgerBar(page, fonts, "PURCHASE ORDER", LEFT, 180, 736, 17, "center");
      drawText(page, data.poNumber, 190, 724.5, { font: fonts.bold, size: 12, color: INK });
      drawText(page, data.vendor.name, RIGHT, 724.5, {
        font: fonts.regular,
        size: 10,
        color: INK,
        align: "right",
      });
      headerTop = 706;
    }

    // Line table: charcoal header and every row ruled.
    const rowsTop = headerTop - 16;
    const tableFloor = last ? closingTableBottom : openBottom;
    fillRect(page, LEFT, rowsTop, RIGHT, headerTop, CHARCOAL);
    for (const column of LEDGER_COLUMNS) {
      const x =
        column.align === "right"
          ? column.x1 - 4.5
          : column.align === "center"
            ? (column.x0 + column.x1) / 2
            : column.x0 + 4.5;
      drawText(page, column.label, x, rowsTop + 5.2, {
        font: fonts.bold,
        size: 7.5,
        color: WHITE,
        align: column.align,
        spacing: 0.4,
      });
    }
    let y = rowsTop;
    pageRows.forEach((row) => {
      drawRowText(page, row, y, style, INK, null);
      y -= row.height;
      drawRule(page, LEFT, y, RIGHT, y, 0.5, LEDGER_GRID);
    });
    // On the last page blank rows share what is left, so the grid ends
    // exactly on the floor; a page that continues stops at its last line.
    const blankRows = last ? Math.floor((y - tableFloor) / LEDGER_ROW_HEIGHT) : 0;
    const blankHeight = blankRows > 0 ? (y - tableFloor) / blankRows : 0;
    for (let index = 0; index < blankRows; index += 1) {
      y -= blankHeight;
      drawRule(page, LEFT, y, RIGHT, y, 0.5, LEDGER_GRID);
    }
    const tableBottom = y;
    for (const column of LEDGER_COLUMNS) {
      if (column.x0 > LEFT) {
        drawRule(page, column.x0, tableBottom, column.x0, rowsTop, 0.5, LEDGER_GRID);
      }
    }
    strokeRect(page, LEFT, tableBottom, RIGHT, headerTop, 0.75, CHARCOAL);

    if (last) {
      const boxTop = boxBottom + boxHeight;
      drawLedgerBar(page, fonts, "NOTES", LEFT, 396, boxTop, 14);
      strokeRect(page, LEFT, boxBottom, 396, boxTop, 0.75, CHARCOAL);
      ledgerNotesLines(ctx).forEach((line, index) => {
        drawText(page, line, LEFT + 6, boxTop - 26 - index * 11, {
          font: fonts.regular,
          size: 9,
          color: INK,
        });
      });

      // Total cell, then boxes to sign and date.
      const totalBottom = boxTop - 22;
      fillRect(page, 404, totalBottom, 496.7, boxTop, CHARCOAL);
      drawText(page, "TOTAL", 490.7, totalBottom + 7.5, {
        font: fonts.bold,
        size: 9.5,
        color: WHITE,
        align: "right",
        spacing: 0.5,
      });
      drawText(page, data.total, RIGHT - 4.5, totalBottom + 7, {
        font: fonts.bold,
        size: 11,
        color: INK,
        align: "right",
      });
      strokeRect(page, 404, totalBottom, RIGHT, boxTop, 0.75, CHARCOAL);
      const signTop = totalBottom - 8;
      strokeRect(page, 404, boxBottom, RIGHT, signTop, 0.75, CHARCOAL);
      drawRule(page, 506, boxBottom, 506, signTop, 0.5, LEDGER_GRID);
      drawText(page, "AUTHORIZED BY", 409, signTop - 9.5, {
        font: fonts.bold,
        size: 6.5,
        color: MUTED,
        spacing: 0.3,
      });
      drawText(page, "DATE", 511, signTop - 9.5, {
        font: fonts.bold,
        size: 6.5,
        color: MUTED,
        spacing: 0.3,
      });
      drawText(page, REMINDER, LEFT, 47, { font: fonts.regular, size: 7.5, color: MUTED });
    }
    drawText(page, `Page ${label}`, RIGHT, last ? 47 : 30, {
      font: fonts.regular,
      size: 7.5,
      color: MUTED,
      align: "right",
    });
  });
}

// ---------------------------------------------------------------------------

function cleanData(data: PurchaseOrderPdfData): PurchaseOrderPdfData {
  const text = (value: string) => toWinAnsiText(value ?? "").trim();
  const party = (value: PurchaseOrderPdfParty): PurchaseOrderPdfParty => ({
    name: text(value.name),
    lines: value.lines.map(text).filter(Boolean),
  });
  return {
    poNumber: text(data.poNumber),
    orderDate: text(data.orderDate),
    expectedDate: text(data.expectedDate),
    orderedBy: text(data.orderedBy),
    vendor: party(data.vendor),
    shipTo: party(data.shipTo),
    lines: data.lines.map((line) => ({
      itemCode: text(line.itemCode),
      description: toWinAnsiText(line.description ?? ""),
      quantity: text(line.quantity),
      unit: text(line.unit),
      unitPrice: text(line.unitPrice),
      amount: text(line.amount),
    })),
    total: text(data.total),
    notes: toWinAnsiText(data.notes ?? ""),
    companyLine: text(data.companyLine),
  };
}

export async function renderPurchaseOrderPdf(
  data: PurchaseOrderPdfData,
  options: RenderPurchaseOrderPdfOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Purchase Order ${data.poNumber}`.trim());
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const header = options.headerImagePng
    ? await doc.embedPng(options.headerImagePng)
    : null;
  const ctx: Ctx = { doc, fonts, header, data: cleanData(data) };

  if (options.design === "clean") {
    renderClean(ctx);
  } else if (options.design === "ledger") {
    renderLedger(ctx);
  } else {
    renderHouse(ctx);
  }
  return doc.save(PDF_SAVE_OPTIONS);
}
