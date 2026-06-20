-- AlterTable (no-op when JobSequence does not exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'JobSequence'
  ) THEN
    ALTER TABLE "JobSequence" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
