-- Price agreed at ticket time for items added outside the quote; invoicing
-- uses it ahead of quote-line and price-list lookups.
ALTER TABLE "DeliveryTicketLineItem" ADD COLUMN "unitPrice" DECIMAL(12,2);
