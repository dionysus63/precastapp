import { prisma } from "@/lib/prisma";
import type { MoldSheetSettings } from "@/lib/mold-sheet-settings";

/**
 * The mold registry's drill sheet settings, read live so saved sheets follow
 * the mold (a mold switched to OD or to "no key" updates the sheets already
 * made on it, without re-saving each one).
 */
export async function loadMoldSheetSettings(): Promise<MoldSheetSettings[]> {
  const molds = await prisma.structureDiameterConfig.findMany({
    select: {
      insideDiameterFeet: true,
      wallThicknessInches: true,
      hasKey: true,
      sheetDiameterBasis: true,
    },
  });
  return molds.map((mold) => ({
    insideDiameterFeet: Number(mold.insideDiameterFeet),
    wallThicknessInches:
      mold.wallThicknessInches != null
        ? Number(mold.wallThicknessInches)
        : null,
    hasKey: mold.hasKey,
    sheetDiameterBasis: mold.sheetDiameterBasis,
  }));
}
