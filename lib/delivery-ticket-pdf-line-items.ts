import type { PDFPage, PDFFont } from "pdf-lib";
import { rgb } from "pdf-lib";
import { richTextToPlainText } from "@/lib/rich-text";
import {
  COL_DESC_WIDTH,
  COL_DESC_X,
  COL_ITEM_NUM_X,
  COL_ITEM_NUM_WIDTH,
  COL_QTY_WIDTH,
  COL_QTY_X,
  DEFAULT_TABLE_LAYOUT,
  ROW_SEPARATOR_COLOR,
  ROW_SEPARATOR_GAP,
  ROW_SEPARATOR_THICKNESS,
  TABLE_LEFT_X,
  TABLE_RIGHT_X,
  TEXT_COLOR,
  TOTALS_ROW_PADDING,
  type DeliveryTicketTableLayout,
} from "@/lib/delivery-ticket-pdf-layout";

export type DeliveryTicketDrawLineItem = {
  qty: string;
  unit: string;
  productCode: string;
  description: string;
};

export type LineItemPageSlice = {
  items: DeliveryTicketDrawLineItem[];
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

export function measureDescriptionLines(
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
  item: DeliveryTicketDrawLineItem,
  font: PDFFont,
  layout: DeliveryTicketTableLayout = DEFAULT_TABLE_LAYOUT,
): number {
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

function measureTotalsRowHeight(
  layout: DeliveryTicketTableLayout = DEFAULT_TABLE_LAYOUT,
): number {
  return layout.lineHeight + TOTALS_ROW_PADDING;
}

export function paginateLineItems(
  items: DeliveryTicketDrawLineItem[],
  font: PDFFont,
  layout: DeliveryTicketTableLayout = DEFAULT_TABLE_LAYOUT,
): LineItemPageSlice[] {
  if (items.length === 0) {
    return [{ items: [], isLastPage: true }];
  }

  const pages: LineItemPageSlice[] = [];
  let currentItems: DeliveryTicketDrawLineItem[] = [];
  let usedHeight = 0;
  const availableHeight = layout.tableTopY - layout.tableBottomY;
  const totalsHeight = measureTotalsRowHeight(layout);

  let itemIndex = 0;
  while (itemIndex < items.length) {
    const item = items[itemIndex]!;
    const rowHeight = measureRowHeight(item, font, layout);
    const isLastItem = itemIndex === items.length - 1;
    const extraForTotals = isLastItem ? totalsHeight : 0;

    if (
      currentItems.length > 0 &&
      usedHeight + rowHeight + extraForTotals > availableHeight
    ) {
      pages.push({ items: currentItems, isLastPage: false });
      currentItems = [];
      usedHeight = 0;
      continue;
    }

    if (currentItems.length === 0 && rowHeight + extraForTotals > availableHeight) {
      pages.push({ items: [item], isLastPage: isLastItem });
      itemIndex += 1;
      continue;
    }

    currentItems.push(item);
    usedHeight += rowHeight;
    itemIndex += 1;

    if (isLastItem) {
      pages.push({ items: currentItems, isLastPage: true });
      currentItems = [];
      usedHeight = 0;
    }
  }

  if (currentItems.length > 0) {
    pages.push({ items: currentItems, isLastPage: true });
  }

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

export function drawLineItemRow(
  page: PDFPage,
  font: PDFFont,
  item: DeliveryTicketDrawLineItem,
  topY: number,
  layout: DeliveryTicketTableLayout = DEFAULT_TABLE_LAYOUT,
): number {
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
    item.productCode,
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

export function drawTotalsRow(
  page: PDFPage,
  font: PDFFont,
  totalPieces: string,
  topY: number,
  layout: DeliveryTicketTableLayout = DEFAULT_TABLE_LAYOUT,
): number {
  if (!totalPieces.trim()) {
    return topY;
  }

  const labelY = topY - layout.lineHeight;
  drawTextAt(
    page,
    font,
    `Total: ${totalPieces} pcs`,
    COL_DESC_X,
    labelY,
    layout.fontSize,
  );

  return topY - measureTotalsRowHeight(layout);
}

export function drawLineItemsOnPage(
  page: PDFPage,
  font: PDFFont,
  slice: LineItemPageSlice,
  totalPieces: string,
  layout: DeliveryTicketTableLayout = DEFAULT_TABLE_LAYOUT,
): void {
  let cursorY = layout.tableTopY;

  for (const item of slice.items) {
    cursorY = drawLineItemRow(page, font, item, cursorY, layout);
  }

  if (slice.isLastPage) {
    drawTotalsRow(page, font, totalPieces, cursorY - TOTALS_ROW_PADDING, layout);
  }
}
