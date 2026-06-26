-- Restore HOOD and THROAT (map existing THIRD_PIECE data to HOOD)
CREATE TYPE "CastingPieceRole_new" AS ENUM ('FRAME', 'COVER_GRATE', 'HOOD', 'THROAT');

ALTER TABLE "Product"
  ALTER COLUMN "castingPieceRole" TYPE "CastingPieceRole_new"
  USING (
    CASE "castingPieceRole"::text
      WHEN 'FRAME' THEN 'FRAME'::"CastingPieceRole_new"
      WHEN 'COVER_GRATE' THEN 'COVER_GRATE'::"CastingPieceRole_new"
      WHEN 'THIRD_PIECE' THEN 'HOOD'::"CastingPieceRole_new"
      ELSE NULL
    END
  );

ALTER TABLE "ProductCastingComponent"
  ALTER COLUMN "pieceRole" TYPE "CastingPieceRole_new"
  USING (
    CASE "pieceRole"::text
      WHEN 'FRAME' THEN 'FRAME'::"CastingPieceRole_new"
      WHEN 'COVER_GRATE' THEN 'COVER_GRATE'::"CastingPieceRole_new"
      WHEN 'THIRD_PIECE' THEN 'HOOD'::"CastingPieceRole_new"
      ELSE NULL
    END
  );

DROP TYPE "CastingPieceRole";
ALTER TYPE "CastingPieceRole_new" RENAME TO "CastingPieceRole";
