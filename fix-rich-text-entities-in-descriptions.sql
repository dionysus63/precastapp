-- One-off cleanup: decode rich-text markup that leaked into plain-text
-- description columns.
--
-- Quote line descriptions are stored as rich text (HTML-escaped, so a 6"
-- boot reads `6&quot; Boots`, line breaks are `<br>`). Linking job
-- structures on quote-won copied that rich text verbatim into
-- JobStructure.description, and from there it spread into delivery ticket
-- and invoice line items. The code now decodes at those boundaries
-- (lib/job-structure-workflow.ts, lib/delivery-fulfillment.ts); this script
-- cleans rows written before the fix.
--
-- Run on the server:
--   psql -U postgres -d precastapp -f fix-rich-text-entities-in-descriptions.sql
-- Dry run: change COMMIT to ROLLBACK at the bottom and inspect the notices.

BEGIN;

-- Mirrors richTextToPlainText in lib/rich-text.ts: <br> becomes a line
-- break, other tags are dropped, entities are decoded (&amp; first, same as
-- decodeHtmlEntities), runs of spaces/tabs collapse but newlines survive.
CREATE FUNCTION pg_temp.plain_text(value text) RETURNS text AS $fn$
  SELECT NULLIF(btrim(regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(
      regexp_replace(
        regexp_replace(value, '<br[^>]*>', E'\n', 'gi'),
        '</?[a-z][a-z0-9]*[^>]*>', '', 'gi'),
      '&nbsp;', ' '),
      '&amp;', '&'),
      '&lt;', '<'),
      '&gt;', '>'),
      '&quot;', '"'),
      '&#34;', '"'),
      '&#39;', ''''),
    '[ \t]+', ' ', 'g')), '')
$fn$ LANGUAGE sql IMMUTABLE;

DO $$
DECLARE
  affected integer;
  offender_pattern text := '&(nbsp|amp|lt|gt|quot|#34|#39);|</?[a-z][^>]*>';
BEGIN
  UPDATE "JobStructure"
  SET description = pg_temp.plain_text(description)
  WHERE description ~* offender_pattern;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'JobStructure.description cleaned: % row(s)', affected;

  UPDATE "DeliveryTicketLineItem"
  SET description = pg_temp.plain_text(description)
  WHERE description ~* offender_pattern;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'DeliveryTicketLineItem.description cleaned: % row(s)', affected;

  UPDATE "InvoiceLineItem"
  SET description = pg_temp.plain_text(description)
  WHERE description ~* offender_pattern;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'InvoiceLineItem.description cleaned: % row(s)', affected;
END $$;

-- Anything still carrying markup after the cleanup (should be 0 rows).
SELECT 'JobStructure' AS tbl, count(*) AS still_dirty
FROM "JobStructure"
WHERE description ~* '&(nbsp|amp|lt|gt|quot|#34|#39);|</?[a-z][^>]*>'
UNION ALL
SELECT 'DeliveryTicketLineItem', count(*)
FROM "DeliveryTicketLineItem"
WHERE description ~* '&(nbsp|amp|lt|gt|quot|#34|#39);|</?[a-z][^>]*>'
UNION ALL
SELECT 'InvoiceLineItem', count(*)
FROM "InvoiceLineItem"
WHERE description ~* '&(nbsp|amp|lt|gt|quot|#34|#39);|</?[a-z][^>]*>';

COMMIT;
