/** Layout constants for drawing line items on the Rev8 delivery ticket template. */

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

export const FONT_SIZE = 9;
export const LINE_HEIGHT = 11;
export const MIN_FONT_SIZE = 9;

/**
 * Rev8 table grid measured from the template's vector lines (pdf.js operator list):
 *   Vertical borders: x = 35.5 | 93.5 | 137.5 | 575.5
 *   Horizontal borders: y = 484 (top, under headers) and y = 162 (bottom)
 *   Cells: Item # = 35.5-93.5, Qty = 93.5-137.5, Description = 137.5-575.5
 * Header labels sit above y=484 (Item # x≈53, Qty x≈109, Description x≈335 centered).
 * Data is drawn left-aligned with a small inset from each cell's left border; Qty is centered.
 */
const CELL_INSET = 4.5;

export const TABLE_LEFT_X = 35.5;
export const TABLE_RIGHT_X = 575.5;
/**
 * Top of the first data row. The printed top border / headers sit at y≈484;
 * we start ~4 pt lower so the first row has the same top spacing as the gap
 * between later rows and their separators.
 */
export const TABLE_TOP_Y = 480;
export const TABLE_BOTTOM_Y = 162;
export const ROW_PADDING = 4;
export const TOTALS_ROW_PADDING = 6;

export const ROW_SEPARATOR_THICKNESS = 0.5;
export const ROW_SEPARATOR_GAP = 3;
export const ROW_SEPARATOR_COLOR = { r: 0, g: 0, b: 0 } as const;

export const COL_ITEM_NUM_X = TABLE_LEFT_X + CELL_INSET;
export const COL_ITEM_NUM_WIDTH = 93.5 - TABLE_LEFT_X;

export const COL_QTY_X = 93.5;
export const COL_QTY_WIDTH = 137.5 - 93.5;

export const COL_DESC_X = 137.5 + CELL_INSET;
export const COL_DESC_WIDTH = TABLE_RIGHT_X - COL_DESC_X;

export const TEXT_COLOR = { r: 0, g: 0, b: 0 } as const;

/** Top-right revision label position (aligned with quote template M_Quote_No). */
export const REVISION_LABEL_X = 434;
export const REVISION_LABEL_Y = 673;
export const REVISION_LABEL_FONT_SIZE = 10;

export type DeliveryTicketTableLayout = {
  tableTopY: number;
  tableBottomY: number;
  rowPadding: number;
  fontSize: number;
  lineHeight: number;
};

export const DEFAULT_TABLE_LAYOUT: DeliveryTicketTableLayout = {
  tableTopY: TABLE_TOP_Y,
  tableBottomY: TABLE_BOTTOM_Y,
  rowPadding: ROW_PADDING,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
};
