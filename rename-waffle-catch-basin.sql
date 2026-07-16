-- Rename the 4x4 waffle catch basin everywhere the old name is stored:
-- product catalog, quote line snapshots, delivery ticket line snapshots,
-- and invoice line snapshots.
--
--   old: 4' x 4' Waffle Catch Basin - 4'-0" w/ Bottom
--   new: 4' x 4' Waffle Catch Basin - 4'-0" w/ Top & Bottom
--
-- Uses replace() so the text updates even when a line description has
-- extra words around it. Run on the app server (LIP-TITAN):
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d precastapp -f rename-waffle-catch-basin.sql

BEGIN;

DO $$
DECLARE
  v_old text := '4'' x 4'' Waffle Catch Basin - 4''-0" w/ Bottom';
  v_new text := '4'' x 4'' Waffle Catch Basin - 4''-0" w/ Top & Bottom';
  v_products int;
  v_quote_lines int;
  v_ticket_lines int;
  v_invoice_lines int;
BEGIN
  UPDATE "Product"
     SET "name" = replace("name", v_old, v_new), "updatedAt" = NOW()
   WHERE "name" LIKE '%' || v_old || '%';
  GET DIAGNOSTICS v_products = ROW_COUNT;

  UPDATE "QuoteLineItem"
     SET "description" = replace("description", v_old, v_new)
   WHERE "description" LIKE '%' || v_old || '%';
  GET DIAGNOSTICS v_quote_lines = ROW_COUNT;

  UPDATE "DeliveryTicketLineItem"
     SET "description" = replace("description", v_old, v_new)
   WHERE "description" LIKE '%' || v_old || '%';
  GET DIAGNOSTICS v_ticket_lines = ROW_COUNT;

  UPDATE "InvoiceLineItem"
     SET "description" = replace("description", v_old, v_new)
   WHERE "description" LIKE '%' || v_old || '%';
  GET DIAGNOSTICS v_invoice_lines = ROW_COUNT;

  RAISE NOTICE 'Renamed: % product(s), % quote line(s), % ticket line(s), % invoice line(s)',
    v_products, v_quote_lines, v_ticket_lines, v_invoice_lines;

  IF v_products = 0 AND v_quote_lines = 0 AND v_ticket_lines = 0 AND v_invoice_lines = 0 THEN
    RAISE EXCEPTION 'Old name not found anywhere — check the exact spelling (nothing changed).';
  END IF;
END $$;

COMMIT;
