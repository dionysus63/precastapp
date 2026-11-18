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
 * pages; the notes and total close the last page. An order placed against
 * the vendor's quote names that quote in place of the lines.
 *
 * The look is open: no boxes, thin rules, the logo's red as the one accent
 * and the purchase order number large at the top right.
 */
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
  /**
   * Set for an order placed against the vendor's quote: the page then shows
   * one row naming the quote instead of `lines`. Either part may be empty.
   */
  quote?: { number: string; date: string } | null;
  lines: PurchaseOrderPdfLine[];
  total: string;
  notes: string;
  /** One line for the foot of the page: company name, address, phone. */
  companyLine: string;
};

export type RenderPurchaseOrderPdfOptions = {
  /** PNG bytes of the company header artwork (logo, address, phone). */
  headerImagePng: Uint8Array | null;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
/** Same left and right edges as the quote, invoice and ticket templates. */
const LEFT = 48.7;
const RIGHT = 564.7;

const BLACK = rgb(0, 0, 0);
/** The red of the company logo. */
const BRAND_RED = rgb(156 / 255, 63 / 255, 65 / 255);
/** The app's warm grays (app/globals.css). */
const INK = rgb(0x1d / 255, 0x1b / 255, 0x19 / 255);
const MUTED = rgb(0x6b / 255, 0x65 / 255, 0x5f / 255);
const HAIRLINE = rgb(0xcf / 255, 0xcc / 255, 0xc8 / 255);

const REMINDER =
  "Please show this purchase order number on all invoices, packing slips and correspondence.";

type Fonts = { regular: PDFFont; bold: PDFFont; oblique: PDFFont };

type Align = "left" | "right" | "center";

type Column = {
  /** Which value of a row's record the column prints. */
  key: string;
  label: string;
  x0: number;
  x1: number;
  align: Align;
  /** Long text runs on to more lines instead of being cut. */
  wraps?: boolean;
  bold?: boolean;
};

type Row = {
  cells: Record<string, string[]>;
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
// Line rows and pagination
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
};

function buildRows(records: Array<Record<string, string>>, style: TableStyle): Row[] {
  return records.map((record) => {
    const cells: Record<string, string[]> = {};
    let lineCount = 1;
    for (const column of style.columns) {
      const raw = record[column.key] ?? "";
      const width = column.x1 - column.x0 - style.inset * 2;
      const lines = column.wraps
        ? wrapPdfText(raw, style.font, style.size, width)
        : [fitText(raw, style.font, style.size, width)];
      cells[column.key] = lines.length > 0 ? lines : [""];
      lineCount = Math.max(lineCount, cells[column.key].length);
    }
    const height = style.padTop + lineCount * style.lineHeight + style.padBottom;
    return { cells, height };
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
  boldFont: PDFFont,
) {
  for (const column of style.columns) {
    const lines = row.cells[column.key] ?? [];
    const font = column.bold ? boldFont : style.font;
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
// The page
// ---------------------------------------------------------------------------

const COLUMNS: Column[] = [
  { key: "itemCode", label: "ITEM", x0: LEFT, x1: 136.7, align: "left", wraps: true },
  {
    key: "description",
    label: "DESCRIPTION",
    x0: 136.7,
    x1: 356.7,
    align: "left",
    wraps: true,
  },
  { key: "quantity", label: "QTY", x0: 356.7, x1: 398.7, align: "right" },
  { key: "unit", label: "UNIT", x0: 398.7, x1: 434.7, align: "left" },
  { key: "unitPrice", label: "UNIT PRICE", x0: 434.7, x1: 498.7, align: "right" },
  { key: "amount", label: "AMOUNT", x0: 498.7, x1: RIGHT, align: "right", bold: true },
];

/** The one row of an order placed against the vendor's quote. */
const QUOTE_COLUMNS: Column[] = [
  { key: "number", label: "VENDOR QUOTE", x0: LEFT, x1: 166.7, align: "left", wraps: true },
  { key: "date", label: "QUOTE DATE", x0: 166.7, x1: 246.7, align: "left" },
  {
    key: "description",
    label: "DESCRIPTION",
    x0: 246.7,
    x1: 470.7,
    align: "left",
    wraps: true,
  },
  { key: "amount", label: "AMOUNT", x0: 470.7, x1: RIGHT, align: "right", bold: true },
];

const QUOTE_ORDER_TEXT =
  "Order for all items on your quote, at the quantities and prices quoted.";

function notesLinesFor(ctx: Ctx): string[] {
  return wrapPdfText(ctx.data.notes, ctx.fonts.regular, 9.5, 300);
}

function renderPages(ctx: Ctx) {
  const { doc, fonts, data } = ctx;
  const columns = data.quote ? QUOTE_COLUMNS : COLUMNS;
  const style: TableStyle = {
    columns,
    font: fonts.regular,
    size: 9.5,
    lineHeight: 12,
    padTop: 7,
    padBottom: 6,
    // Text sits flush with the page margins: no boxes to stand clear of.
    inset: 0,
  };
  // A little air between neighbouring columns instead of an inset.
  style.columns = columns.map((column) => ({
    ...column,
    x0: column.align === "left" && column.x0 > LEFT ? column.x0 + 8 : column.x0,
  }));
  const rows = buildRows(
    data.quote
      ? [
          {
            number: data.quote.number,
            date: data.quote.date,
            description: QUOTE_ORDER_TEXT,
            amount: data.total,
          },
        ]
      : data.lines,
    style,
  );

  const notesLines = notesLinesFor(ctx);
  const firstRowsTop = 553;
  const nextRowsTop = 681;
  const openBottom = 72;
  /** Under the last row: total and notes, then room above the reminder line. */
  const closingHeight = 16 + Math.max(30, 14 + notesLines.length * 12) + 24;
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
    quote: data.quote
      ? { number: text(data.quote.number), date: text(data.quote.date) }
      : null,
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

  renderPages(ctx);
  return doc.save(PDF_SAVE_OPTIONS);
}
