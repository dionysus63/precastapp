-- AlterEnum
BEGIN;
CREATE TYPE "CastingPieceRole_new" AS ENUM ('FRAME', 'COVER_GRATE', 'HOOD');
ALTER TABLE "Product" ALTER COLUMN "castingPieceRole" TYPE "CastingPieceRole_new" USING ("castingPieceRole"::text::"CastingPieceRole_new");
ALTER TABLE "ProductCastingComponent" ALTER COLUMN "pieceRole" TYPE "CastingPieceRole_new" USING ("pieceRole"::text::"CastingPieceRole_new");
ALTER TYPE "CastingPieceRole" RENAME TO "CastingPieceRole_old";
ALTER TYPE "CastingPieceRole_new" RENAME TO "CastingPieceRole";
DROP TYPE "public"."CastingPieceRole_old";
COMMIT;
