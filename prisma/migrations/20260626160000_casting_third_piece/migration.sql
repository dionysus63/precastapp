-- Consolidate HOOD and THROAT into THIRD_PIECE
DELETE FROM "ProductCastingComponent" AS throat
WHERE throat."pieceRole" = 'THROAT'
  AND EXISTS (
    SELECT 1
    FROM "ProductCastingComponent" AS hood
    WHERE hood."assemblyId" = throat."assemblyId"
      AND hood."pieceRole" = 'HOOD'
  );

CREATE TYPE "CastingPieceRole_new" AS ENUM ('FRAME', 'COVER_GRATE', 'THIRD_PIECE');

ALTER TABLE "Product"
  ALTER COLUMN "castingPieceRole" TYPE "CastingPieceRole_new"
  USING (
    CASE "castingPieceRole"::text
      WHEN 'FRAME' THEN 'FRAME'::"CastingPieceRole_new"
      WHEN 'COVER_GRATE' THEN 'COVER_GRATE'::"CastingPieceRole_new"
      WHEN 'HOOD' THEN 'THIRD_PIECE'::"CastingPieceRole_new"
      WHEN 'THROAT' THEN 'THIRD_PIECE'::"CastingPieceRole_new"
      ELSE NULL
    END
  );

ALTER TABLE "ProductCastingComponent"
  ALTER COLUMN "pieceRole" TYPE "CastingPieceRole_new"
  USING (
    CASE "pieceRole"::text
      WHEN 'FRAME' THEN 'FRAME'::"CastingPieceRole_new"
      WHEN 'COVER_GRATE' THEN 'COVER_GRATE'::"CastingPieceRole_new"
      WHEN 'HOOD' THEN 'THIRD_PIECE'::"CastingPieceRole_new"
      WHEN 'THROAT' THEN 'THIRD_PIECE'::"CastingPieceRole_new"
      ELSE NULL
    END
  );

DROP TYPE "CastingPieceRole";
ALTER TYPE "CastingPieceRole_new" RENAME TO "CastingPieceRole";
