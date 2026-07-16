-- Remove the remaining (delivered / cancelled) tickets on job 26-001 so the
-- job's loads can be rebuilt from scratch.
--
-- Mirrors the app's own reversal logic before deleting:
--   1. Aborts if any of these tickets has an invoice (billing must be
--      handled first — tell Claude if this trips).
--   2. Credits inventory back for every delivery deduction that has not
--      already been reversed (same idempotency guard as the app, so a
--      ticket cancelled through the app is not double-credited).
--   3. Resets any structures those tickets marked SHIPPED back to MADE.
--   4. Deletes the tickets (their line items cascade). Ledger history rows
--      are kept.
--
-- Run on the app server (LIP-TITAN):
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d precastapp -f delete-job-26-001-remaining-tickets.sql

-- Show what will be deleted first
SELECT dt."ticketNumber", dt.status, dt."deliveredAt", count(li.id) AS lines
FROM "DeliveryTicket" dt
JOIN "Job" j ON j.id = dt."jobId"
LEFT JOIN "DeliveryTicketLineItem" li ON li."deliveryTicketId" = dt.id
WHERE j."jobNumber" = '26-001'
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
  r RECORD;
BEGIN
  SELECT id INTO v_job_id FROM "Job" WHERE "jobNumber" = '26-001';
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Job 26-001 not found — nothing deleted.';
  END IF;

  SELECT count(*) INTO v_tickets FROM "DeliveryTicket" WHERE "jobId" = v_job_id;
  IF v_tickets = 0 THEN
    RAISE EXCEPTION 'Job 26-001 has no tickets — nothing deleted.';
  END IF;

  SELECT count(*) INTO v_invoiced FROM "Invoice" i
   WHERE i."deliveryTicketId" IN (
     SELECT id FROM "DeliveryTicket" WHERE "jobId" = v_job_id);
  IF v_invoiced > 0 THEN
    RAISE EXCEPTION '% ticket(s) on 26-001 have invoices — aborting, nothing deleted. Handle billing first.', v_invoiced;
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
        WHERE dt."jobId" = v_job_id)
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
       'Reversal of deleted job 26-001 ticket (manual cleanup)');

    UPDATE "Product"
       SET "currentStockQuantity" = "currentStockQuantity" + (-r."quantityChange")::int,
           "updatedAt" = NOW()
     WHERE id = r."productId";

    v_reversals := v_reversals + 1;
  END LOOP;

  -- Un-ship structures these tickets had marked SHIPPED.
  UPDATE "JobStructure" s
     SET status = 'MADE', "shippedDate" = NULL, "updatedAt" = NOW()
   WHERE s.status = 'SHIPPED'
     AND s.id IN (
       SELECT li."jobStructureId" FROM "DeliveryTicketLineItem" li
       JOIN "DeliveryTicket" dt ON dt.id = li."deliveryTicketId"
       WHERE dt."jobId" = v_job_id AND li."jobStructureId" IS NOT NULL);
  GET DIAGNOSTICS v_structures = ROW_COUNT;

  DELETE FROM "DeliveryTicket" WHERE "jobId" = v_job_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'Deleted % ticket(s); credited % inventory deduction(s) back; reset % structure(s) to MADE.',
    v_deleted, v_reversals, v_structures;
END $$;

COMMIT;
