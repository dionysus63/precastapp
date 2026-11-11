-- Manual wall height change (Quick Build's up/down arrows), in inches.
ALTER TABLE "JobStructureCalc" ADD COLUMN "wallHeightAdjustInches" INTEGER NOT NULL DEFAULT 0;
