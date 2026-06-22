-- AlterTable
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "contactTitle" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_contactId_idx" ON "Quote"("contactId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Quote"
    ADD CONSTRAINT "Quote_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill primary Contact rows from legacy customer header fields
INSERT INTO "Contact" ("id", "customerId", "name", "title", "phone", "email", "isPrimary", "notes", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  c."id",
  COALESCE(
    NULLIF(BTRIM(c."primaryContactName"), ''),
    c."name",
    'Primary Contact'
  ),
  NULL,
  NULLIF(BTRIM(c."phone"), ''),
  NULLIF(BTRIM(c."email"), ''),
  true,
  NULL,
  NOW(),
  NOW()
FROM "Customer" c
WHERE (
  NULLIF(BTRIM(c."primaryContactName"), '') IS NOT NULL
  OR NULLIF(BTRIM(c."phone"), '') IS NOT NULL
  OR NULLIF(BTRIM(c."email"), '') IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM "Contact" ct WHERE ct."customerId" = c."id"
);
