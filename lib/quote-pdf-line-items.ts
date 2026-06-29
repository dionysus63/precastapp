import type { PDFPage, PDFFont } from "pdf-lib";
import { rgb } from "pdf-lib";
import { richTextToPlainText } from "@/lib/rich-text";
import {
  COL_DESC_WIDTH,
  COL_DESC_X,
  COL_ITEM_NUM_X,
  COL_QTY_WIDTH,
  COL_QTY_X,
  COL_TOTAL_WIDTH,
  COL_TOTAL_X,
  COL_UNIT_PRICE_WIDTH,
  COL_UNIT_PRICE_X,
  CONT_TABLE_LAYOUT,
  MAIN_TABLE_LAYOUT,
  ROW_SEPARATOR_COLOR,
  ROW_SEPARATOR_GAP,
  ROW_SEPARATOR_THICKNESS,
  TABLE_LEFT_X,
  TABLE_RIGHT_X,
  TEXT_COLOR,
  type QuoteTableLayout,
} from "@/lib/quote-pdf-layout";

const CELL_INSET = 4.5;

export type QuoteDrawLineItem = {
  item: string;
  qty: string;
  description: string;
  unitPrice: string;
  total: string;
  isCategoryLine?: boolean;
};

export type QuoteLineItemPageSlice = {
  items: QuoteDrawLineItem[];
  isLastPage: boolean;
};

export function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);

    if (width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      currentLine = word;
      continue;
    }

    let chunk = "";
    for (const char of word) {
      const nextChunk = `${chunk}${char}`;
      if (font.widthOfTextAtSize(nextChunk, fontSize) <= maxWidth) {
        chunk = nextChunk;
      } else {
        if (chunk) {
          lines.push(chunk);
        }
        chunk = char;
      }
    }
    currentLine = chunk;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function measureDescriptionLines(
  description: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const plainText = richTextToPlainText(description);
  if (!plainText.trim()) {
    return [];
  }

  const paragraphs = plainText.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    lines.push(...wrapText(paragraph, font, fontSize, maxWidth));
  }

  return lines;
}

function measureSeparatorHeight(): number {
  return ROW_SEPARATOR_THICKNESS + ROW_SEPARATOR_GAP;
}

export function measureRowHeight(
  item: QuoteDrawLineItem,
  font: PDFFont,
  layout: QuoteTableLayout,
): number {
  if (item.isCategoryLine) {
    return layout.lineHeight + layout.rowPadding + measureSeparatorHeight();
  }

  const descLines = measureDescriptionLines(
    item.description,
    font,
    layout.fontSize,
    COL_DESC_WIDTH,
  );
  const lineCount = Math.max(1, descLines.length);
  return (
    lineCount * layout.lineHeight +
    layout.rowPadding +
    measureSeparatorHeight()
  );
}

function availableHeight(layout: QuoteTableLayout): number {
  return layout.tableTopY - layout.tableBottomY;
}

function suffixFitsMain(
  items: QuoteDrawLineItem[],
  startIndex: number,
  font: PDFFont,
): boolean {
  const slice = items.slice(startIndex);
  const height = slice.reduce(
    (sum, item) => sum + measureRowHeight(item, font, MAIN_TABLE_LAYOUT),
    0,
  );
  return height <= availableHeight(MAIN_TABLE_LAYOUT);
}

function packContinuationPages(
  items: QuoteDrawLineItem[],
  font: PDFFont,
): QuoteLineItemPageSlice[] {
  const pages: QuoteLineItemPageSlice[] = [];
  let currentItems: QuoteDrawLineItem[] = [];
  let usedHeight = 0;
  const maxHeight = availableHeight(CONT_TABLE_LAYOUT);

  for (const item of items) {
    const rowHeight = measureRowHeight(item, font, CONT_TABLE_LAYOUT);

    if (
      currentItems.length > 0 &&
      usedHeight + rowHeight > maxHeight
    ) {
      pages.push({ items: currentItems, isLastPage: false });
      currentItems = [];
      usedHeight = 0;
    }

    if (currentItems.length === 0 && rowHeight > maxHeight) {
      pages.push({ items: [item], isLastPage: false });
      continue;
    }

    currentItems.push(item);
    usedHeight += rowHeight;
  }

  if (currentItems.length > 0) {
    pages.push({ items: currentItems, isLastPage: false });
  }

  return pages;
}

export function paginateQuoteLineItems(
  items: QuoteDrawLineItem[],
  font: PDFFont,
): QuoteLineItemPageSlice[] {
  if (items.length === 0) {
    return [{ items: [], isLastPage: true }];
  }

  const totalMainHeight = items.reduce(
    (sum, item) => sum + measureRowHeight(item, font, MAIN_TABLE_LAYOUT),
    0,
  );
  if (totalMainHeight <= availableHeight(MAIN_TABLE_LAYOUT)) {
    return [{ items, isLastPage: true }];
  }

  let lastPageStart = items.length;
  for (let start = 0; start < items.length; start += 1) {
    if (suffixFitsMain(items, start, font)) {
      lastPageStart = start;
    }
  }

  const continuationItems = items.slice(0, lastPageStart);
  const lastPageItems = items.slice(lastPageStart);
  const pages = packContinuationPages(continuationItems, font);
  pages.push({ items: lastPageItems, isLastPage: true });

  return pages;
}

function drawTextAt(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  fontSize: number,
): void {
  if (!text.trim()) {
    return;
  }
  page.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
  });
}

function drawCenteredInColumn(
  page: PDFPage,
  font: PDFFont,
  text: string,
  colX: number,
  colWidth: number,
  y: number,
  fontSize: number,
): void {
  if (!text.trim()) {
    return;
  }
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const x = colX + Math.max(0, (colWidth - textWidth) / 2);
  drawTextAt(page, font, text, x, y, fontSize);
}

function drawRightAlignedInColumn(
  page: PDFPage,
  font: PDFFont,
  text: string,
  colX: number,
  colWidth: number,
  y: number,
  fontSize: number,
): void {
  if (!text.trim()) {
    return;
  }
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const x = colX + Math.max(0, colWidth - textWidth - CELL_INSET);
  drawTextAt(page, font, text, x, y, fontSize);
}

function drawRowSeparator(page: PDFPage, y: number): void {
  page.drawLine({
    start: { x: TABLE_LEFT_X, y },
    end: { x: TABLE_RIGHT_X, y },
    thickness: ROW_SEPARATOR_THICKNESS,
    color: rgb(
      ROW_SEPARATOR_COLOR.r,
      ROW_SEPARATOR_COLOR.g,
      ROW_SEPARATOR_COLOR.b,
    ),
  });
}

function drawTextUnderline(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
): void {
  page.drawLine({
    start: { x, y: y - 1.5 },
    end: { x: x + width, y: y - 1.5 },
    thickness: 0.75,
    color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
  });
}

export function drawLineItemRow(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  item: QuoteDrawLineItem,
  topY: number,
  layout: QuoteTableLayout,
): number {
  if (item.isCategoryLine) {
    const rowHeight =
      layout.lineHeight + layout.rowPadding + measureSeparatorHeight();
    const firstLineY = topY - layout.lineHeight;
    const categoryText = item.description.trim();
    drawTextAt(
      page,
      boldFont,
      categoryText,
      COL_DESC_X,
      firstLineY,
      layout.fontSize,
    );
    if (categoryText) {
      const textWidth = boldFont.widthOfTextAtSize(
        categoryText,
        layout.fontSize,
      );
      drawTextUnderline(page, COL_DESC_X, firstLineY, textWidth);
    }
    const separatorY = topY - layout.lineHeight - layout.rowPadding;
    drawRowSeparator(page, separatorY);
    return topY - rowHeight;
  }

  const descLines = measureDescriptionLines(
    item.description,
    font,
    layout.fontSize,
    COL_DESC_WIDTH,
  );
  const lineCount = Math.max(1, descLines.length);
  const textHeight = lineCount * layout.lineHeight;
  const rowHeight = textHeight + layout.rowPadding + measureSeparatorHeight();
  const firstLineY = topY - layout.lineHeight;

  drawTextAt(
    page,
    font,
    item.item,
    COL_ITEM_NUM_X,
    firstLineY,
    layout.fontSize,
  );
  drawCenteredInColumn(
    page,
    font,
    item.qty,
    COL_QTY_X,
    COL_QTY_WIDTH,
    firstLineY,
    layout.fontSize,
  );
  drawRightAlignedInColumn(
    page,
    font,
    item.unitPrice,
    COL_UNIT_PRICE_X,
    COL_UNIT_PRICE_WIDTH,
    firstLineY,
    layout.fontSize,
  );
  drawRightAlignedInColumn(
    page,
    font,
    item.total,
    COL_TOTAL_X,
    COL_TOTAL_WIDTH,
    firstLineY,
    layout.fontSize,
  );

  if (descLines.length === 0) {
    const separatorY = topY - textHeight - layout.rowPadding;
    drawRowSeparator(page, separatorY);
    return topY - rowHeight;
  }

  for (let index = 0; index < descLines.length; index += 1) {
    drawTextAt(
      page,
      font,
      descLines[index]!,
      COL_DESC_X,
      firstLineY - index * layout.lineHeight,
      layout.fontSize,
    );
  }

  const separatorY = topY - textHeight - layout.rowPadding;
  drawRowSeparator(page, separatorY);
  return topY - rowHeight;
}

export function drawQuoteLineItemsOnPage(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  slice: QuoteLineItemPageSlice,
): void {
  const layout = slice.isLastPage ? MAIN_TABLE_LAYOUT : CONT_TABLE_LAYOUT;
  let cursorY = layout.tableTopY;

  for (const item of slice.items) {
    cursorY = drawLineItemRow(page, font, boldFont, item, cursorY, layout);
  }
}
