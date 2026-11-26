export type { QuoteDrawLineItem as InvoiceDrawLineItem } from "@/lib/quote-pdf-line-items";
export {
  drawQuoteLineItemsOnPage as drawInvoiceLineItemsOnPage,
  drawQuoteTableColumns as drawInvoiceTableColumns,
  paginateQuoteLineItems as paginateInvoiceLineItems,
  type QuoteLineItemPageSlice as InvoiceLineItemPageSlice,
} from "@/lib/quote-pdf-line-items";
import type { QuoteTableColumnStyle } from "@/lib/quote-pdf-line-items";

/**
 * The invoice templates print the table frame and its gray band; the column
 * lines and names are drawn with the line items, because an invoice with a
 * discounted line prints List Price and Disc % columns. Line width and text
 * baseline as scripts/generate-invoice-templates.ts used to draw them.
 */
export const INVOICE_TABLE_COLUMN_STYLE: QuoteTableColumnStyle = {
  lineWidth: 0.5,
  headerTextY: 509.4,
};
