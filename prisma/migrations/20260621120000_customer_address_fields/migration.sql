-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "address" TEXT;
ALTER TABLE "Customer" ADD COLUMN "town" TEXT;
ALTER TABLE "Customer" ADD COLUMN "state" TEXT;
ALTER TABLE "Customer" ADD COLUMN "zip" TEXT;

-- MigrateData
UPDATE "Customer" SET "address" = "billingAddress" WHERE "billingAddress" IS NOT NULL;

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "billingAddress";
ALTER TABLE "Customer" DROP COLUMN "customerType";

-- DropEnum
DROP TYPE "CustomerType";
