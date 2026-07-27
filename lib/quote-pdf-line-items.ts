import type { PDFPage, PDFFont } from "pdf-lib";
import { rgb } from "pdf-lib";
import { richTextToPlainText } from "@/lib/rich-text";
import {
  COL_DESC_WIDTH,
  COL_DESC_X,
  COL_ITEM_NUM_WIDTH,
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
const ITEM_NUM_TEXT_WIDTH = COL_ITEM_NUM_WIDTH - CELL_INSET * 2;

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
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return [];
  }

  const lines: string[] = [];
  let remaining = normalized;

  while (remaining) {
    if (font.widthOfTextAtSize(remaining, fontSize) <= maxWidth) {
      lines.push(remaining);
      break;
    }

    let fitEnd = 0;
    for (let end = 1; end <= remaining.length; end += 1) {
      if (
        font.widthOfTextAtSize(remaining.slice(0, end), fontSize) > maxWidth
      ) {
        break;
      }
      fitEnd = end;
    }

    // maxWidth is always a real cell width, but force progress if a single
    // glyph is somehow wider than the available space.
    fitEnd = Math.max(1, fitEnd);

    let naturalLineEnd = 0;
    let naturalNextStart = 0;
    for (let index = 0; index <= fitEnd && index < remaining.length; index += 1) {
      const char = remaining[index];
      if (char === " " && index > 0) {
        // The space itself is not drawn, so it may sit immediately beyond the
        // widest fitting prefix.
        naturalLineEnd = index;
        naturalNextStart = index + 1;
      } else if (char === "-" && index + 1 <= fitEnd) {
        // Keep a hyphen at the end of the preceding line.
        naturalLineEnd = index + 1;
        naturalNextStart = index + 1;
      }
    }

    const lineEnd = naturalLineEnd || fitEnd;
    const nextStart = naturalLineEnd ? naturalNextStart : fitEnd;
    lines.push(remaining.slice(0, lineEnd).trimEnd());
    remaining = remaining.slice(nextStart).trimStart();
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

  const descLines = measureDescriptionLines(
    item.description,
    font,
    layout.fontSize,
    COL_DESC_WIDTH,
  );
  const itemLines = wrapText(
    item.item,
    font,
    layout.fontSize,
    ITEM_NUM_TEXT_WIDTH,
  );
  const lineCount = Math.max(1, descLines.length, itemLines.length);
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

/**
 * Pages fill front-to-back: each continuation page packs full before the
 * next page starts, and whatever remains lands on the totals (main) page.
 * The totals page holds less than a continuation page, so the check is
 * "do ALL remaining rows fit the main layout?" at each page boundary —
 * never pulling rows off an earlier page just to fatten the last one.
 */
export function paginateQuoteLineItems(
  items: QuoteDrawLineItem[],
  font: PDFFont,
): QuoteLineItemPageSlice[] {
  if (items.length === 0) {
    return [{ items: [], isLastPage: true }];
  }

  const pages: QuoteLineItemPageSlice[] = [];
  let index = 0;

  for (;;) {
    if (suffixFitsMain(items, index, font)) {
      pages.push({ items: items.slice(index), isLastPage: true });
      return pages;
    }

    // Fill one continuation page greedily.
    const group: QuoteDrawLineItem[] = [];
    let usedHeight = 0;
    const maxHeight = availableHeight(CONT_TABLE_LAYOUT);
    while (index < items.length) {
      const rowHeight = measureRowHeight(items[index], font, CONT_TABLE_LAYOUT);
      if (group.length > 0 && usedHeight + rowHeight > maxHeight) {
        break;
      }
      group.push(items[index]);
      usedHeight += rowHeight;
      index += 1;
    }

    // A full continuation page can swallow a remainder that was too tall for
    // the main layout; keep at least one row back so the totals page never
    // prints without a single line item above it.
    if (index >= items.length && group.length > 1) {
      group.pop();
      index -= 1;
    }
    pages.push({ items: group, isLastPage: false });

    if (index >= items.length) {
      pages.push({ items: [], isLastPage: true });
      return pages;
    }
  }
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

    if (descLines.length === 0) {
      const separatorY = topY - textHeight - layout.rowPadding;
      drawRowSeparator(page, separatorY);
      return topY - rowHeight;
    }

    for (let index = 0; index < descLines.length; index += 1) {
      const lineText = descLines[index]!;
      const lineY = firstLineY - index * layout.lineHeight;
      const isTitleLine = index === 0;

      drawTextAt(
        page,
        isTitleLine ? boldFont : font,
        lineText,
        COL_DESC_X,
        lineY,
        layout.fontSize,
      );

      if (isTitleLine && lineText.trim()) {
        const textWidth = boldFont.widthOfTextAtSize(lineText, layout.fontSize);
        drawTextUnderline(page, COL_DESC_X, lineY, textWidth);
      }
    }

    const separatorY = topY - textHeight - layout.rowPadding;
    drawRowSeparator(page, separatorY);
    return topY - rowHeight;
  }

  const descLines = measureDescriptionLines(
    item.description,
    font,
    layout.fontSize,
    COL_DESC_WIDTH,
  );
  const itemLines = wrapText(
    item.item,
    font,
    layout.fontSize,
    ITEM_NUM_TEXT_WIDTH,
  );
  const lineCount = Math.max(1, descLines.length, itemLines.length);
  const textHeight = lineCount * layout.lineHeight;
  const rowHeight = textHeight + layout.rowPadding + measureSeparatorHeight();
  const firstLineY = topY - layout.lineHeight;

  for (let index = 0; index < itemLines.length; index += 1) {
    drawTextAt(
      page,
      font,
      itemLines[index]!,
      COL_ITEM_NUM_X,
      firstLineY - index * layout.lineHeight,
      layout.fontSize,
    );
  }
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
