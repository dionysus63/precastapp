-- Editable F.O.B. terms on quotes; per-price-list default. Null means the
-- historical hardcoded value ("Factory") so existing quotes print unchanged.
ALTER TABLE "Quote" ADD COLUMN "fob" TEXT;
ALTER TABLE "PriceList" ADD COLUMN "fobDefault" TEXT;
