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

/** One column of the item table: its left border and its width. */
export type QuoteTableColumn = { x: number; width: number };

/**
 * The columns of the item table. The quote prints two ways: the standard
 * table, and one with List Price and Disc % ahead of the price when the quote
 * shows its discounts. Invoices use the standard table.
 */
export type QuoteTableColumns = {
  item: QuoteTableColumn;
  qty: QuoteTableColumn;
  description: QuoteTableColumn;
  /** Price before the discount; only on the discount table. */
  listPrice?: QuoteTableColumn;
  /** Discount percent; only on the discount table. */
  discount?: QuoteTableColumn;
  /** The billed price each ("Unit Price", or "Net Price" beside a discount). */
  unitPrice: QuoteTableColumn;
  total: QuoteTableColumn;
};

function column(left: number, right: number): QuoteTableColumn {
  return { x: left, width: right - left };
}

export const STANDARD_TABLE_COLUMNS: QuoteTableColumns = {
  item: column(TABLE_LEFT_X, 104.7),
  qty: column(104.7, 148.7),
  description: column(148.7, 408.7),
  unitPrice: column(408.7, 486.7),
  total: column(486.7, TABLE_RIGHT_X),
};

/**
 * Item # 48.7-104.7, Qty 104.7-144.7, Description 144.7-338.7,
 * List Price 338.7-400.7, Disc % 400.7-436.7, Net Price 436.7-498.7,
 * Total 498.7-564.7.
 */
export const DISCOUNT_TABLE_COLUMNS: QuoteTableColumns = {
  item: column(TABLE_LEFT_X, 104.7),
  qty: column(104.7, 144.7),
  description: column(144.7, 338.7),
  listPrice: column(338.7, 400.7),
  discount: column(400.7, 436.7),
  unitPrice: column(436.7, 498.7),
  total: column(498.7, TABLE_RIGHT_X),
};

/**
 * The gray header band of the item table. The quote templates print the band
 * and the table frame; the column lines and the column names are drawn with
 * the line items, because they differ between the two tables.
 */
export const TABLE_HEADER_TOP_Y = 525.1;
export const TABLE_HEADER_BOTTOM_Y = 507.1;
export const TABLE_HEADER_FONT_SIZE = 8;
/** Baseline of the column names inside the band. */
export const TABLE_HEADER_TEXT_Y = 511.1;
/** Width of the table frame and its column lines, as the templates draw them. */
export const TABLE_BORDER_WIDTH = 0.8;

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
