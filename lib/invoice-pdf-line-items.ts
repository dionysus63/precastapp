export type { QuoteDrawLineItem as InvoiceDrawLineItem } from "@/lib/quote-pdf-line-items";
export {
  drawQuoteLineItemsOnPage as drawInvoiceLineItemsOnPage,
  paginateQuoteLineItems as paginateInvoiceLineItems,
  type QuoteLineItemPageSlice as InvoiceLineItemPageSlice,
} from "@/lib/quote-pdf-line-items";
