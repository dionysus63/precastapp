/** Layout constants for drawing line items on the quote PDF templates (Rev1). */

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

export const FONT_SIZE = 9;
export const LINE_HEIGHT = 11;
export const MIN_FONT_SIZE = 9;

/**
 * Quote table grid measured from Rev1 template vector lines (pdf.js operator list):
 *   Vertical borders: x = 48.7 | 104.7 | 148.7 | 408.7 | 486.7 | 564.7
 *   Horizontal borders: y = 507.1 (header underline) and y = 140 (MAIN bottom) / y = 40 (CONT bottom)
 *   Cells: Item # = 48.7-104.7, Qty = 104.7-148.7, Description = 148.7-408.7,
 *          Unit Price = 408.7-486.7, Total = 486.7-564.7
 */
const CELL_INSET = 4.5;

export const TABLE_LEFT_X = 48.7;
export const TABLE_RIGHT_X = 564.7;
/** Top of the first data row (printed header underline at y≈507). */
export const TABLE_TOP_Y = 503;
export const MAIN_TABLE_BOTTOM_Y = 140;
export const CONT_TABLE_BOTTOM_Y = 40;
export const ROW_PADDING = 4;

export const ROW_SEPARATOR_THICKNESS = 0.5;
export const ROW_SEPARATOR_GAP = 3;
export const ROW_SEPARATOR_COLOR = { r: 0, g: 0, b: 0 } as const;

export const COL_ITEM_NUM_X = TABLE_LEFT_X + CELL_INSET;
export const COL_ITEM_NUM_WIDTH = 104.7 - TABLE_LEFT_X;

export const COL_QTY_X = 104.7;
export const COL_QTY_WIDTH = 148.7 - 104.7;

export const COL_DESC_X = 148.7 + CELL_INSET;
export const COL_DESC_WIDTH = 408.7 - COL_DESC_X;

export const COL_UNIT_PRICE_X = 408.7;
export const COL_UNIT_PRICE_WIDTH = 486.7 - 408.7;

export const COL_TOTAL_X = 486.7;
export const COL_TOTAL_WIDTH = TABLE_RIGHT_X - 486.7;

export const TEXT_COLOR = { r: 0, g: 0, b: 0 } as const;

export type QuoteTableLayout = {
  tableTopY: number;
  tableBottomY: number;
  rowPadding: number;
  fontSize: number;
  lineHeight: number;
};

export const MAIN_TABLE_LAYOUT: QuoteTableLayout = {
  tableTopY: TABLE_TOP_Y,
  tableBottomY: MAIN_TABLE_BOTTOM_Y,
  rowPadding: ROW_PADDING,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
};

export const CONT_TABLE_LAYOUT: QuoteTableLayout = {
  tableTopY: TABLE_TOP_Y,
  tableBottomY: CONT_TABLE_BOTTOM_Y,
  rowPadding: ROW_PADDING,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
};
