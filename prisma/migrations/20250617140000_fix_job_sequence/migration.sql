-- Fix JobSequence after partial schema migration.
-- Ensures updatedAt has a default for any direct SQL inserts.

ALTER TABLE "JobSequence"
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
