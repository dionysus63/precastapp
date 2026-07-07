-- Rename RectWall values from plan letters to directions (in place, so
-- existing JobStructureOpening.wall / JobStructureDimension.topSlabOpeningSide
-- rows follow automatically). A=top, B=right, C=bottom, D=left.
ALTER TYPE "RectWall" RENAME VALUE 'A' TO 'UP';
ALTER TYPE "RectWall" RENAME VALUE 'B' TO 'RIGHT';
ALTER TYPE "RectWall" RENAME VALUE 'C' TO 'DOWN';
ALTER TYPE "RectWall" RENAME VALUE 'D' TO 'LEFT';
