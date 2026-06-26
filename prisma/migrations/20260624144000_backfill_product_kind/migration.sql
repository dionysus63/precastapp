-- Backfill productKind from legacy boolean / castingRole columns.
UPDATE "Product"
SET "productKind" = 'DRAIN_RING'
WHERE "isDrainRing" = true;

UPDATE "Product"
SET "productKind" = 'CASTING_ASSEMBLY'
WHERE "castingRole" = 'ASSEMBLY'
  AND "productKind" = 'STANDARD';

UPDATE "Product"
SET "productKind" = 'CASTING_COMPONENT'
WHERE "castingRole" = 'COMPONENT'
  AND "productKind" = 'STANDARD';
