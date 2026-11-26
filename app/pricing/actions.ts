"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { invalidateAppSettingsCache } from "@/lib/app-settings";
import { writeAuditLog } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  DISCOUNT_GROUP_LABELS,
  formatDiscountPercent,
  isDiscountGroupKey,
  parseDiscountPercentInput,
} from "@/lib/pricing/discount-groups";
import { parsePriceInput } from "@/lib/pricing/price-input";
import {
  saveStructurePriceRows,
  type StructurePriceRowInput,
} from "@/lib/pricing/structure-price-data";
import { structurePriceTablePermission } from "@/lib/pricing/structure-price-permissions";
import {
  STRUCTURE_PRICE_TABLES,
  isStructurePriceTableKey,
  type StructurePriceRow,
} from "@/lib/pricing/structure-price-tables";
import { returnActionError } from "@/lib/server/action-errors";

export type ListPriceEntry = {
  productId: string;
  /** As typed: "1450", "$1,450.00"; blank or null takes the price off the list. */
  price: string | null;
};

export type SaveListPricesResult =
  | {
      /** The saved price per product, as stored ("1450.00"); null = no price. */
      saved: Array<{ productId: string; price: string | null }>;
    }
  | { error: string };

/** A paste fills one tab at most; this is well above any group's size. */
const MAX_ENTRIES_PER_SAVE = 5000;

/**
 * Save list prices typed or pasted on the Pricing screen. All of them land or
 * none do, so a pasted column is never half saved. Only the list price is
 * touched: a pickup price typed on the old price list screen stays as it is.
 */
export async function saveListPrices(
  priceListId: string,
  entries: ListPriceEntry[],
): Promise<SaveListPricesResult> {
  return returnActionError(async () => {
    const user = await requirePermission(AppPermission.PRODUCTS_MANAGE);

    if (!priceListId) {
      throw new Error("Pick a price list first.");
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      return { saved: [] };
    }
    if (entries.length > MAX_ENTRIES_PER_SAVE) {
      throw new Error("That is too many prices to save at once.");
    }

    // Last entry for a product wins, as it would typing the cell twice.
    const priceByProductId = new Map<string, string | null>();
    for (const entry of entries) {
      const productId = String(entry?.productId ?? "").trim();
      if (!productId) {
        throw new Error("A price is missing its product.");
      }
      const parsed = parsePriceInput(String(entry.price ?? ""));
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      priceByProductId.set(productId, parsed.value);
    }
    const productIds = [...priceByProductId.keys()];

    const priceListName = await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const priceList = await tx.priceList.findUnique({
          where: { id: priceListId },
          select: { name: true },
        });
        if (!priceList) {
          throw new Error("That price list no longer exists.");
        }
        const found = await tx.product.count({
          where: { id: { in: productIds } },
        });
        if (found !== productIds.length) {
          throw new Error(
            "A product on this screen no longer exists. Reload the page and try again.",
          );
        }

        const clearedIds = productIds.filter(
          (id) => priceByProductId.get(id) == null,
        );
        if (clearedIds.length > 0) {
          await tx.priceListItem.deleteMany({
            where: { priceListId, productId: { in: clearedIds } },
          });
        }
        for (const productId of productIds) {
          const price = priceByProductId.get(productId);
          if (price == null) {
            continue;
          }
          const unitPrice = new Prisma.Decimal(price);
          await tx.priceListItem.upsert({
            where: { priceListId_productId: { priceListId, productId } },
            create: { priceListId, productId, unitPrice },
            update: { unitPrice },
          });
        }
        return priceList.name;
      }),
    );

    await writeAuditLog({
      userId: user.id,
      action: "pricing.list_prices_saved",
      entityType: "PriceList",
      entityId: priceListId,
      summary: `${productIds.length} list price${productIds.length === 1 ? "" : "s"} saved on ${priceListName}`,
      metadata: {
        prices: productIds.slice(0, 200).map((productId) => ({
          productId,
          price: priceByProductId.get(productId) ?? null,
        })),
      },
    });

    // Screens that show prices from the list. The Pricing screen itself keeps
    // what was typed, so it is not refreshed under the person typing.
    revalidatePath("/products");
    revalidatePath(`/settings/price-lists/${priceListId}`);
    revalidatePath("/settings/price-lists");

    return {
      saved: productIds.map((productId) => ({
        productId,
        price: priceByProductId.get(productId) ?? null,
      })),
    };
  });
}

export type SaveDiscountRuleResult =
  | { deliveredPercent: string; pickupPercent: string }
  | { error: string };

/**
 * Save one group's standard discount. Company policy, so it takes the same
 * permission as the rest of Settings.
 */
export async function saveDiscountRule(
  group: string,
  deliveredRaw: string,
  pickupRaw: string,
): Promise<SaveDiscountRuleResult> {
  return returnActionError(async () => {
    const user = await requirePermission(AppPermission.SETTINGS_MANAGE);

    if (!isDiscountGroupKey(group)) {
      throw new Error("That discount group does not exist.");
    }
    const delivered = parseDiscountPercentInput(String(deliveredRaw ?? ""));
    if (!delivered.ok) {
      throw new Error(`Delivered: ${delivered.error}`);
    }
    const pickup = parseDiscountPercentInput(String(pickupRaw ?? ""));
    if (!pickup.ok) {
      throw new Error(`Picked Up: ${pickup.error}`);
    }

    const deliveredPercent = new Prisma.Decimal(delivered.value);
    const pickupPercent = new Prisma.Decimal(pickup.value);

    await withDatabaseRetry((client) =>
      client.discountRule.upsert({
        where: { group },
        create: { group, deliveredPercent, pickupPercent },
        update: { deliveredPercent, pickupPercent },
      }),
    );

    await writeAuditLog({
      userId: user.id,
      action: "pricing.discount_rule_saved",
      entityType: "DiscountRule",
      entityId: group,
      summary: `${DISCOUNT_GROUP_LABELS[group]} discount set to ${formatDiscountPercent(deliveredPercent)}% delivered, ${formatDiscountPercent(pickupPercent)}% picked up`,
    });

    revalidatePath("/pricing");

    return {
      deliveredPercent: formatDiscountPercent(deliveredPercent),
      pickupPercent: formatDiscountPercent(pickupPercent),
    };
  });
}

export type SaveStructurePricesResult =
  /** The saved rows as they now stand on the list. */
  { rows: StructurePriceRow[] } | { error: string };

/** A pasted block fills one sheet at most; well above any sheet's size. */
const MAX_STRUCTURE_ROWS_PER_SAVE = 2000;

/**
 * Save rows typed or pasted on the Pricing screen's Structures tab. All of
 * them land or none do. Each sheet takes the permission of the screen its
 * numbers were always edited on.
 */
export async function saveStructurePrices(
  priceListId: string,
  table: string,
  rows: StructurePriceRowInput[],
): Promise<SaveStructurePricesResult> {
  return returnActionError(async () => {
    if (!isStructurePriceTableKey(table)) {
      throw new Error("That price sheet does not exist.");
    }
    const user = await requirePermission(structurePriceTablePermission(table));

    if (!priceListId) {
      throw new Error("Pick a price list first.");
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return { rows: [] };
    }
    if (rows.length > MAX_STRUCTURE_ROWS_PER_SAVE) {
      throw new Error("That is too many rows to save at once.");
    }

    const { priceListName, saved } = await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const priceList = await tx.priceList.findUnique({
          where: { id: priceListId },
          select: { name: true },
        });
        if (!priceList) {
          throw new Error("That price list no longer exists.");
        }
        return {
          priceListName: priceList.name,
          saved: await saveStructurePriceRows(priceListId, table, rows, tx),
        };
      }),
    );
    if (table === "rings") {
      // Ring prices live in the settings row, which is cached.
      invalidateAppSettingsCache();
    }

    const { title } = STRUCTURE_PRICE_TABLES[table];
    await writeAuditLog({
      userId: user.id,
      action: "pricing.structure_prices_saved",
      entityType: "PriceList",
      entityId: priceListId,
      summary: `${saved.length} ${title} price row${saved.length === 1 ? "" : "s"} saved on ${priceListName}`,
      metadata: {
        table,
        rows: saved.slice(0, 200).map((row) => ({
          id: row.id,
          label: row.label,
          values: row.values,
        })),
      },
    });

    // Screens that show these numbers. The Pricing screen itself keeps what
    // was typed, so it is not refreshed under the person typing.
    revalidatePath("/structures", "layout");
    revalidatePath("/settings/diameters");
    revalidatePath("/settings/rings");

    return { rows: saved };
  });
}
