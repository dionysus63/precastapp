-- Global delivery ticket numbering: DT10001+ (year=0 sequence row).
INSERT INTO "DeliveryTicketSequence" ("id", "year", "lastNumber", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  0,
  GREATEST(
    10000,
    COALESCE(
      (SELECT MAX("sequenceNumber") FROM "DeliveryTicket" WHERE "sequenceNumber" >= 10000),
      10000
    )
  ),
  NOW(),
  NOW()
ON CONFLICT ("year") DO UPDATE
SET
  "lastNumber" = GREATEST(
    "DeliveryTicketSequence"."lastNumber",
    10000,
    COALESCE(
      (SELECT MAX("sequenceNumber") FROM "DeliveryTicket" WHERE "sequenceNumber" >= 10000),
      10000
    )
  ),
  "updatedAt" = NOW();
