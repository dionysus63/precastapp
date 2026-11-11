/**
 * Per-mold drill sheet settings (Settings → Structure Molds): whether the mold
 * forms a key at all, and which diameter its drill sheets print. Pure helpers
 * — safe in client components. The database loader lives in
 * lib/mold-sheet-settings-load.ts.
 */

/** Which diameter a mold is called by. Mirrors the Prisma enum. */
export type MoldDiameterBasis = "INSIDE" | "OUTSIDE";

export const MOLD_DIAMETER_BASIS_OPTIONS: {
  value: MoldDiameterBasis;
  label: string;
}[] = [
  { value: "INSIDE", label: "ID" },
  { value: "OUTSIDE", label: "OD" },
];

export type MoldSheetSettings = {
  insideDiameterFeet: number;
  wallThicknessInches: number | null;
  /** False = keyless mold (wall too thin to key). */
  hasKey: boolean;
  sheetDiameterBasis: MoldDiameterBasis;
};

/** Molds are matched to templates and sheets by inside diameter. */
export function findMoldSheetSettings<
  T extends { insideDiameterFeet: number },
>(molds: readonly T[], insideDiameterFeet: number | null | undefined): T | null {
  if (insideDiameterFeet == null || !Number.isFinite(insideDiameterFeet)) {
    return null;
  }
  return (
    molds.find(
      (mold) => Math.abs(mold.insideDiameterFeet - insideDiameterFeet) < 1e-6,
    ) ?? null
  );
}

/**
 * Outside diameter in feet: inside Ø + 2 × wall. Snapped to the nearest ¼"
 * first, because the registry stores inside Ø to two decimals — an 8' OD mold
 * with 4" walls is entered as 7.33', which must print as 8', not 7.9967'.
 */
export function moldOutsideDiameterFeet(
  insideDiameterFeet: number | null | undefined,
  wallThicknessInches: number | null | undefined,
): number | null {
  if (
    insideDiameterFeet == null ||
    !Number.isFinite(insideDiameterFeet) ||
    insideDiameterFeet <= 0 ||
    wallThicknessInches == null ||
    !Number.isFinite(wallThicknessInches) ||
    wallThicknessInches <= 0
  ) {
    return null;
  }
  const outsideInches = insideDiameterFeet * 12 + 2 * wallThicknessInches;
  const snappedInches = Math.round(outsideInches * 4) / 4;
  return Math.round((snappedInches / 12) * 100) / 100;
}

export type SheetDiameter = {
  /** The diameter the sheet prints, in feet. */
  feet: number | null;
  /** Which one it is — OUTSIDE only when the mold asks for it and has a wall. */
  basis: MoldDiameterBasis;
};

/**
 * The diameter a drill sheet prints for a structure: the mold's outside Ø when
 * the mold is set to OD (and has a wall thickness to compute it from), else
 * the inside Ø as always.
 */
export function resolveSheetDiameter(
  insideDiameterFeet: number | null | undefined,
  mold:
    | {
        wallThicknessInches?: number | null;
        sheetDiameterBasis?: MoldDiameterBasis | null;
      }
    | null
    | undefined,
): SheetDiameter {
  const inside =
    insideDiameterFeet != null && Number.isFinite(insideDiameterFeet)
      ? insideDiameterFeet
      : null;
  if (mold?.sheetDiameterBasis === "OUTSIDE") {
    const outside = moldOutsideDiameterFeet(inside, mold.wallThicknessInches);
    if (outside != null) {
      return { feet: outside, basis: "OUTSIDE" };
    }
  }
  return { feet: inside, basis: "INSIDE" };
}

/**
 * What a sheet prints as its diameter, from the sheet's header data: the
 * mold-resolved diameter when one was attached, else the inside diameter.
 */
export function printedSheetDiameter(meta: {
  insideDiameterFeet: number | null;
  sheetDiameter?: SheetDiameter | null;
}): SheetDiameter {
  if (meta.sheetDiameter && meta.sheetDiameter.feet != null) {
    return meta.sheetDiameter;
  }
  return { feet: meta.insideDiameterFeet, basis: "INSIDE" };
}
