-- Vendor address and contact, printed on the purchase order PDF. All optional.
ALTER TABLE "Vendor" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "zip" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "contactName" TEXT;
