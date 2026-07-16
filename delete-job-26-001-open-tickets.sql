-- Remove every OPEN delivery ticket on job 26-001 (draft / scheduled /
-- loading / in transit) so the loads can be rebuilt from scratch.
--
-- Delivered tickets are deliberately left alone: they carry the shipped
-- quantities, inventory deductions, and invoice links. Deleting open
-- tickets is safe — their line items cascade, and nothing else references
-- an undelivered ticket.
--
-- Run on the app server (LIP-TITAN):
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d precastapp -f delete-job-26-001-open-tickets.sql

-- Show what will be deleted first
SELECT dt."ticketNumber", dt.status, dt."deliveryDate", count(li.id) AS lines
FROM "DeliveryTicket" dt
JOIN "Job" j ON j.id = dt."jobId"
LEFT JOIN "DeliveryTicketLineItem" li ON li."deliveryTicketId" = dt.id
WHERE j."jobNumber" = '26-001'
  AND dt.status IN ('DRAFT','SCHEDULED','LOADING','IN_TRANSIT')
GROUP BY dt."ticketNumber", dt.status, dt."deliveryDate"
ORDER BY dt."ticketNumber";

BEGIN;

DO $$
DECLARE
  v_job_id text;
  v_open int;
  v_invoiced int;
  v_deleted int;
BEGIN
  SELECT id INTO v_job_id FROM "Job" WHERE "jobNumber" = '26-001';
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Job 26-001 not found — nothing deleted.';
  END IF;

  SELECT count(*) INTO v_open FROM "DeliveryTicket"
   WHERE "jobId" = v_job_id
     AND status IN ('DRAFT','SCHEDULED','LOADING','IN_TRANSIT');
  IF v_open = 0 THEN
    RAISE EXCEPTION 'Job 26-001 has no open tickets — nothing deleted.';
  END IF;

  -- Open tickets should never be invoiced; refuse loudly if one somehow is.
  SELECT count(*) INTO v_invoiced FROM "Invoice" i
   WHERE i."deliveryTicketId" IN (
     SELECT id FROM "DeliveryTicket"
      WHERE "jobId" = v_job_id
        AND status IN ('DRAFT','SCHEDULED','LOADING','IN_TRANSIT'));
  IF v_invoiced > 0 THEN
    RAISE EXCEPTION '% open ticket(s) have invoices — aborting, nothing deleted.', v_invoiced;
  END IF;

  DELETE FROM "DeliveryTicket"
   WHERE "jobId" = v_job_id
     AND status IN ('DRAFT','SCHEDULED','LOADING','IN_TRANSIT');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'Deleted % open ticket(s) on job 26-001. Delivered tickets untouched.', v_deleted;
END $$;

COMMIT;
