import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";
import { parseStructureConfigJson } from "@/lib/quotes/structure-workbook";

/**
 * Where "Create drill sheet" should send the user for a placeholder
 * structure, based on its quote line's stored config:
 * - rect config → the rect sheet editor pre-seeded from the placeholder
 * - circular config → the quote's circular structure workbook (its quote-page
 *   "Create Drill Sheets" upgrades placeholders in place)
 * - no parseable config (manual structure / deleted quote line) → null; the
 *   caller falls back to the structure page.
 */
export function resolveCreateDrillSheetHref(
  structureId: string,
  quoteId: string | null,
  configJson: unknown,
): string | null {
  if (parseRectStructureConfigJson(configJson)) {
    return `/drill-sheets/rect/new?structureId=${structureId}`;
  }
  if (quoteId && parseStructureConfigJson(configJson)) {
    return `/quotes/${quoteId}/edit/structures`;
  }
  return null;
}
