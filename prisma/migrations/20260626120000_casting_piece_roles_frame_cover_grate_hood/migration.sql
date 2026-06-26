-- Replace CastingPieceRole: FRAME + COVER + GRATE -> FRAME + COVER_GRATE + HOOD
CREATE TYPE "CastingPieceRole_new" AS ENUM ('FRAME', 'COVER_GRATE', 'HOOD');

ALTER TABLE "Product"
  ALTER COLUMN "castingPieceRole" TYPE "CastingPieceRole_new"
  USING (
    CASE "castingPieceRole"::text
      WHEN 'FRAME' THEN 'FRAME'::"CastingPieceRole_new"
      WHEN 'COVER' THEN 'COVER_GRATE'::"CastingPieceRole_new"
      WHEN 'GRATE' THEN 'COVER_GRATE'::"CastingPieceRole_new"
      ELSE NULL
    END
  );

ALTER TABLE "ProductCastingComponent"
  ALTER COLUMN "pieceRole" TYPE "CastingPieceRole_new"
  USING (
    CASE "pieceRole"::text
      WHEN 'FRAME' THEN 'FRAME'::"CastingPieceRole_new"
      WHEN 'COVER' THEN 'COVER_GRATE'::"CastingPieceRole_new"
      WHEN 'GRATE' THEN 'HOOD'::"CastingPieceRole_new"
      ELSE NULL
    END
  );

DROP TYPE "CastingPieceRole";
ALTER TYPE "CastingPieceRole_new" RENAME TO "CastingPieceRole";
