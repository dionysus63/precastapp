-- Configurable ticket/invoice numbering: prefix per document type and a
-- starting number for the global ticket counter. Invoice numbers derive
-- from the ticket number (same digits, invoice prefix).
ALTER TABLE "AppSettings" ADD COLUMN "ticketNumberPrefix" TEXT NOT NULL DEFAULT 'T';
ALTER TABLE "AppSettings" ADD COLUMN "invoiceNumberPrefix" TEXT NOT NULL DEFAULT 'I';
ALTER TABLE "AppSettings" ADD COLUMN "ticketNumberStart" INTEGER NOT NULL DEFAULT 10001;
