/**
 * Storm Leaching Galley families: End / Middle / CB SKUs that share a height
 * (and price/weight). Quotes carry a single "family total" line
 * (galleyFamilyCode set, productId null) that is broken into typed product
 * lines on award. Client-safe — no Prisma imports.
 */

export type GalleyTypeValue = "END" | "MIDDLE" | "CB";

/** Display and breakdown order: ends first, then middles, then CB. */
export const GALLEY_TYPE_ORDER: GalleyTypeValue[] = ["END", "MIDDLE", "CB"];

export const galleyTypeLabels: Record<GalleyTypeValue, string> = {
  END: "One End",
  MIDDLE: "Middle",
  CB: "CB",
};

/**
 * Family label from a member's name: "Storm Leaching Galley - 4'-0"  - One
 * End" → "Storm Leaching Galley - 4'-0"". Falls back to the name unchanged
 * when no type suffix is recognized.
 */
export function stripGalleyTypeSuffix(name: string): string {
  const stripped = name.replace(/\s*-\s*(One End|Middle|CB)\s*$/i, "").trim();
  return stripped || name.trim();
}

/**
 * Synthetic quote-form option ids for family rows. They live alongside real
 * product ids in the picker, so the prefix keeps them from ever being
 * mistaken for a productId.
 */
const GALLEY_FAMILY_OPTION_PREFIX = "galley-family:";

export function makeGalleyFamilyOptionId(familyCode: string): string {
  return `${GALLEY_FAMILY_OPTION_PREFIX}${familyCode}`;
}

export function isGalleyFamilyOptionId(id: string): boolean {
  return id.startsWith(GALLEY_FAMILY_OPTION_PREFIX);
}

export type GalleyBreakdownCounts = Record<GalleyTypeValue, number>;

/** Per-family breakdown state shown on the won-quote detail page. */
export type GalleyBreakdownView = {
  familyCode: string;
  /** Customer-facing family label, e.g. `Storm Leaching Galley - 4'-0"`. */
  label: string;
  /** Quoted total across the family's lines (family-total + typed). */
  total: number;
  /** True while the family-total line still needs its breakdown. */
  pending: boolean;
  /** Current counts on typed lines (absent types are 0). */
  counts: Partial<Record<GalleyTypeValue, number>>;
  availableTypes: GalleyTypeValue[];
  memberCodes: Partial<Record<GalleyTypeValue, string>>;
  /** Tickets/invoices reference these lines — the mix is frozen. */
  locked: boolean;
};

/**
 * Validates a breakdown entry set against the quoted family total.
 * Returns an error message, or null when valid.
 */
export function validateGalleyBreakdownCounts(
  counts: GalleyBreakdownCounts,
  expectedTotal: number,
  availableTypes: GalleyTypeValue[],
): string | null {
  if (!Number.isInteger(expectedTotal) || expectedTotal <= 0) {
    return "The quoted galley total must be a whole number.";
  }

  let sum = 0;
  for (const type of GALLEY_TYPE_ORDER) {
    const count = counts[type];
    if (!Number.isInteger(count) || count < 0) {
      return `${galleyTypeLabels[type]} count must be a whole number of 0 or more.`;
    }
    if (count > 0 && !availableTypes.includes(type)) {
      return `No active ${galleyTypeLabels[type]} product exists for this galley family.`;
    }
    sum += count;
  }

  if (sum !== expectedTotal) {
    return `Counts must add up to the quoted total of ${expectedTotal} (currently ${sum}).`;
  }

  return null;
}
