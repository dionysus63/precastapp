-- Fix JobSequence after partial schema migration.
-- Ensures updatedAt has a default for any direct SQL inserts.
-- No-op when JobSequence table does not exist (e.g. fresh shadow database).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'JobSequence'
  ) THEN
    ALTER TABLE "JobSequence"
    ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
