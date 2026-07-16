-- v2: also removes stray ticket T10104 (created before the numbering
-- rollback decision), which blocked v1's counter-reset guard.
--
-- 1. Deletes ticket T10104 and every DELIVERED ticket on job 26-001, with
--    the app's own bookkeeping: inventory deductions credited back and
--    SHIPPED structures reset to MADE.
-- 2. Resets the global ticket counter so the next ticket number is 10100.
--
-- Aborts touching nothing if any targeted ticket has an invoice, or if a
-- ticket at number 10100+ would still remain after the deletes.
--
-- Run on the app server (LIP-TITAN):
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d precastapp -f delete-26-001-delivered-and-reset-numbering.sql

-- Show what will be deleted first
SELECT dt."ticketNumber", dt.status, j."jobNumber", dt."deliveredAt", count(li.id) AS lines
FROM "DeliveryTicket" dt
LEFT JOIN "Job" j ON j.id = dt."jobId"
LEFT JOIN "DeliveryTicketLineItem" li ON li."deliveryTicketId" = dt.id
WHERE dt."ticketNumber" = 'T10104'
   OR (dt.status = 'DELIVERED' AND j."jobNumber" = '26-001')
GROUP BY dt."ticketNumber", dt.status, j."jobNumber", dt."deliveredAt"
ORDER BY dt."ticketNumber";

BEGIN;

DO $$
DECLARE
  v_job_id text;
  v_target_ids text[];
  v_invoiced int;
  v_reversals int := 0;
  v_structures int;
  v_deleted int;
  v_max_seq int;
  r RECORD;
BEGIN
  SELECT id INTO v_job_id FROM "Job" WHERE "jobNumber" = '26-001';
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Job 26-001 not found — nothing changed.';
  END IF;

  SELECT COALESCE(array_agg(id), '{}') INTO v_target_ids
  FROM "DeliveryTicket"
  WHERE "ticketNumber" = 'T10104'
     OR ("jobId" = v_job_id AND status = 'DELIVERED');
  IF array_length(v_target_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No matching tickets found — nothing changed.';
  END IF;

  SELECT count(*) INTO v_invoiced FROM "Invoice" i
   WHERE i."deliveryTicketId" = ANY (v_target_ids);
  IF v_invoiced > 0 THEN
    RAISE EXCEPTION '% targeted ticket(s) have invoices — aborting, nothing changed. Handle billing first.', v_invoiced;
  END IF;

  -- After these deletes, no remaining ticket may sit at 10100 or above.
  SELECT COALESCE(max("sequenceNumber"), 0) INTO v_max_seq
  FROM "DeliveryTicket" WHERE NOT (id = ANY (v_target_ids));
  IF v_max_seq >= 10100 THEN
    RAISE EXCEPTION 'A remaining ticket still uses sequence % (>= 10100) — aborting, nothing changed.', v_max_seq;
  END IF;

  -- Credit back every un-reversed delivery deduction from these tickets.
  FOR r IN
    SELECT t."productId", t."quantityChange", t."referenceId"
    FROM "InventoryTransaction" t
    WHERE t."transactionType" = 'DELIVERY'
      AND t."referenceType" = 'DELIVERY_TICKET_LINE_ITEM'
      AND t."referenceId" IN (
        SELECT li.id FROM "DeliveryTicketLineItem" li
        WHERE li."deliveryTicketId" = ANY (v_target_ids))
      AND NOT EXISTS (
        SELECT 1 FROM "InventoryTransaction" rev
        WHERE rev."transactionType" = 'REVERSAL'
          AND rev."referenceType" = 'DELIVERY_TICKET_LINE_ITEM'
          AND rev."referenceId" = t."referenceId")
  LOOP
    INSERT INTO "InventoryTransaction"
      ("id", "productId", "quantityChange", "transactionType",
       "transactionDate", "referenceType", "referenceId", "notes")
    VALUES
      (gen_random_uuid()::text, r."productId", -r."quantityChange", 'REVERSAL',
       NOW(), 'DELIVERY_TICKET_LINE_ITEM', r."referenceId",
       'Reversal of manually deleted ticket (26-001 cleanup)');

    UPDATE "Product"
       SET "currentStockQuantity" = "currentStockQuantity" + (-r."quantityChange")::int,
           "updatedAt" = NOW()
     WHERE id = r."productId";

    v_reversals := v_reversals + 1;
  END LOOP;

  -- Un-ship structures those tickets had marked SHIPPED.
  UPDATE "JobStructure" s
     SET status = 'MADE', "shippedDate" = NULL, "updatedAt" = NOW()
   WHERE s.status = 'SHIPPED'
     AND s.id IN (
       SELECT li."jobStructureId" FROM "DeliveryTicketLineItem" li
       WHERE li."deliveryTicketId" = ANY (v_target_ids)
         AND li."jobStructureId" IS NOT NULL);
  GET DIAGNOSTICS v_structures = ROW_COUNT;

  DELETE FROM "DeliveryTicket" WHERE id = ANY (v_target_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Next allocation computes GREATEST(lastNumber + 1, settings start), so a
  -- lastNumber of 10099 makes the next ticket 10100 (as long as the settings
  -- start is not above 10100).
  INSERT INTO "DeliveryTicketSequence" ("id", "year", "lastNumber", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 0, 10099, NOW(), NOW())
  ON CONFLICT ("year") DO UPDATE SET "lastNumber" = 10099, "updatedAt" = NOW();

  UPDATE "AppSettings"
     SET "ticketNumberStart" = LEAST("ticketNumberStart", 10100)
   WHERE id = 'default';

  RAISE NOTICE 'Deleted % ticket(s); credited % inventory deduction(s); reset % structure(s) to MADE; next ticket number is 10100.',
    v_deleted, v_reversals, v_structures;
END $$;

COMMIT;
