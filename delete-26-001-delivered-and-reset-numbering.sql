-- 1. Remove the DELIVERED ticket(s) on job 26-001 (with the same inventory
--    reversal and structure reset the app performs), and
-- 2. Reset the global ticket counter so the next ticket number is 10100.
--
-- Aborts touching nothing if a delivered 26-001 ticket has an invoice, or if
-- any existing ticket already uses number 10100 or higher (which would make
-- future allocations collide).
--
-- Run on the app server (LIP-TITAN):
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d precastapp -f delete-26-001-delivered-and-reset-numbering.sql

-- Show what will be deleted first
SELECT dt."ticketNumber", dt.status, dt."deliveredAt", count(li.id) AS lines
FROM "DeliveryTicket" dt
JOIN "Job" j ON j.id = dt."jobId"
LEFT JOIN "DeliveryTicketLineItem" li ON li."deliveryTicketId" = dt.id
WHERE j."jobNumber" = '26-001' AND dt.status = 'DELIVERED'
GROUP BY dt."ticketNumber", dt.status, dt."deliveredAt"
ORDER BY dt."ticketNumber";

BEGIN;

DO $$
DECLARE
  v_job_id text;
  v_tickets int;
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

  SELECT count(*) INTO v_tickets FROM "DeliveryTicket"
   WHERE "jobId" = v_job_id AND status = 'DELIVERED';
  IF v_tickets = 0 THEN
    RAISE EXCEPTION 'Job 26-001 has no delivered tickets — nothing changed.';
  END IF;

  SELECT count(*) INTO v_invoiced FROM "Invoice" i
   WHERE i."deliveryTicketId" IN (
     SELECT id FROM "DeliveryTicket"
      WHERE "jobId" = v_job_id AND status = 'DELIVERED');
  IF v_invoiced > 0 THEN
    RAISE EXCEPTION '% delivered ticket(s) on 26-001 have invoices — aborting, nothing changed. Handle billing first.', v_invoiced;
  END IF;

  -- The counter reset only works if no ticket sits at 10100 or above.
  SELECT COALESCE(max("sequenceNumber"), 0) INTO v_max_seq FROM "DeliveryTicket";
  IF v_max_seq >= 10100 THEN
    RAISE EXCEPTION 'A ticket already uses sequence % (>= 10100) — aborting, nothing changed.', v_max_seq;
  END IF;

  -- Credit back every un-reversed delivery deduction from these tickets.
  FOR r IN
    SELECT t."productId", t."quantityChange", t."referenceId"
    FROM "InventoryTransaction" t
    WHERE t."transactionType" = 'DELIVERY'
      AND t."referenceType" = 'DELIVERY_TICKET_LINE_ITEM'
      AND t."referenceId" IN (
        SELECT li.id FROM "DeliveryTicketLineItem" li
        JOIN "DeliveryTicket" dt ON dt.id = li."deliveryTicketId"
        WHERE dt."jobId" = v_job_id AND dt.status = 'DELIVERED')
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
       'Reversal of deleted job 26-001 delivered ticket (manual cleanup)');

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
       JOIN "DeliveryTicket" dt ON dt.id = li."deliveryTicketId"
       WHERE dt."jobId" = v_job_id AND dt.status = 'DELIVERED'
         AND li."jobStructureId" IS NOT NULL);
  GET DIAGNOSTICS v_structures = ROW_COUNT;

  DELETE FROM "DeliveryTicket"
   WHERE "jobId" = v_job_id AND status = 'DELIVERED';
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

  RAISE NOTICE 'Deleted % delivered ticket(s); credited % inventory deduction(s); reset % structure(s) to MADE; next ticket number is 10100.',
    v_deleted, v_reversals, v_structures;
END $$;

COMMIT;
