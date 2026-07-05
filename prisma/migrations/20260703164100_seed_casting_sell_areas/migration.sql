-- Seed default domestic casting sell areas
INSERT INTO "CastingSellArea" ("id", "name", "sortOrder", "status", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Nassau County', 1, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Suffolk County', 2, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NYSDOT', 3, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NYC Parks', 4, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Standard', 5, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
