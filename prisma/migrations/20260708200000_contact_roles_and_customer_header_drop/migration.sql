-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('ESTIMATING', 'BILLING', 'FIELD');

-- Backfill: the app used to mirror a "primary contact" onto Customer header
-- columns and only materialized a Contact row when the detail page was
-- viewed. Materialize the remaining header-only contacts before dropping the
-- columns so no person data is lost. Phone-only headers are treated as the
-- company line (which stays on Customer) and do not create a contact.
INSERT INTO "Contact" ("id", "customerId", "name", "phone", "email", "isPrimary", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c."id",
    COALESCE(NULLIF(TRIM(c."primaryContactName"), ''), 'Primary Contact'),
    NULLIF(TRIM(c."phone"), ''),
    NULLIF(TRIM(c."email"), ''),
    true,
    NOW(),
    NOW()
FROM "Customer" c
WHERE NOT EXISTS (SELECT 1 FROM "Contact" k WHERE k."customerId" = c."id")
  AND (
    NULLIF(TRIM(c."primaryContactName"), '') IS NOT NULL
    OR NULLIF(TRIM(c."email"), '') IS NOT NULL
  );

-- DropIndex
DROP INDEX "Customer_email_trgm_idx";

-- DropIndex
DROP INDEX "Customer_primaryContactName_trgm_idx";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "roles" "ContactRole"[] DEFAULT ARRAY[]::"ContactRole"[];

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "email",
DROP COLUMN "primaryContactName";

-- CreateTable
CREATE TABLE "CustomerContactRoleDefault" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "role" "ContactRole" NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContactRoleDefault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerContactRoleDefault_contactId_idx" ON "CustomerContactRoleDefault"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerContactRoleDefault_customerId_role_key" ON "CustomerContactRoleDefault"("customerId", "role");

-- CreateIndex
CREATE INDEX "Contact_name_trgm_idx" ON "Contact" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Contact_email_trgm_idx" ON "Contact" USING GIN ("email" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "CustomerContactRoleDefault" ADD CONSTRAINT "CustomerContactRoleDefault_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContactRoleDefault" ADD CONSTRAINT "CustomerContactRoleDefault_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
