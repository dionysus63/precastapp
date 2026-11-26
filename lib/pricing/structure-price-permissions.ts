import { AppPermission } from "@/app/generated/prisma/client";
import type { StructurePriceTableKey } from "@/lib/pricing/structure-price-tables";

/**
 * Who may change each structure price sheet: the permission of the screen
 * its numbers were always edited on, so the Pricing screen opens no door
 * that was closed before. Molds and rings sit in Settings; templates and
 * opening catalogs sit under Structures.
 */
export function structurePriceTablePermission(
  table: StructurePriceTableKey,
): AppPermission {
  return table === "molds" || table === "rings"
    ? AppPermission.SETTINGS_MANAGE
    : AppPermission.STRUCTURES_MANAGE;
}
