import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DISCOUNT_GROUP_KEYS,
  emptyDiscountRateTable,
  hasAnyDiscount,
  type DiscountGroupKey,
  type DiscountRateTable,
} from "@/lib/pricing/discount-groups";
import type { QuoteDiscountPricing } from "@/lib/pricing/line-discount";

type DbClient = Prisma.TransactionClient | typeof prisma;

/** The standard discount for every group; a group with no row has none. */
export async function loadDiscountRateTable(
  client: DbClient = prisma,
): Promise<DiscountRateTable> {
  const table = emptyDiscountRateTable();
  const rows = await client.discountRule.findMany();
  for (const row of rows) {
    table[row.group] = {
      deliveredPercent: Number(row.deliveredPercent),
      pickupPercent: Number(row.pickupPercent),
    };
  }
  return table;
}

/** Product types that have no discount group of their own. */
const OTHER_PRODUCT_TYPES = ["ACCESSORY", "CONFIGURABLE", "SERVICE"] as const;

/**
 * The products of one discount group, as a database filter. Must agree with
 * `discountGroupForProduct` (lib/pricing/discount-groups.ts); a unit test
 * holds the two together.
 */
export function productWhereForDiscountGroup(
  group: DiscountGroupKey,
): Prisma.ProductWhereInput {
  switch (group) {
    case "STOCK_PRECAST":
      return { productType: "STOCK_PRECAST" };
    case "CASTING_IMPORTED":
      return { productType: "CASTING", castingSupplier: { origin: "IMPORTED" } };
    case "CASTING_DOMESTIC":
      return { productType: "CASTING", castingSupplier: { origin: "DOMESTIC" } };
    case "ADS_PIPE":
      return { productType: "ADS_PIPE" };
    case "RCP_PIPE":
      return { productType: "PRECAST_PIPE" };
    case "OTHER":
      return {
        OR: [
          { productType: { in: [...OTHER_PRODUCT_TYPES] } },
          { productType: "CASTING", castingSupplierId: null },
        ],
      };
  }
}

/**
 * The standard discounts and which products they cover, for the quote form.
 * Only groups that have a discount are looked up: a product in none of them
 * gets no discount, whatever its group.
 */
export async function loadQuoteDiscountPricing(
  client: DbClient = prisma,
): Promise<QuoteDiscountPricing> {
  const rates = await loadDiscountRateTable(client);
  const productIdsByGroup: QuoteDiscountPricing["productIdsByGroup"] = {};
  for (const group of DISCOUNT_GROUP_KEYS) {
    if (!hasAnyDiscount(rates[group])) {
      continue;
    }
    const products = await client.product.findMany({
      where: productWhereForDiscountGroup(group),
      select: { id: true },
    });
    productIdsByGroup[group] = products.map((product) => product.id);
  }
  return { rates, productIdsByGroup };
}

export type PricingProductRow = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  categoryId: string;
  categoryName: string;
  /** A casting with no supplier: the app cannot tell imported from domestic. */
  castingWithoutSupplier: boolean;
  /** Dollars and cents ("1450.00"), or null when the list has no price. */
  listPrice: string | null;
};

/** Active products of one group with their price on one list, in sheet order. */
export async function loadPricingRows(
  group: DiscountGroupKey,
  priceListId: string,
  client: DbClient = prisma,
): Promise<PricingProductRow[]> {
  const products = await client.product.findMany({
    where: { status: "ACTIVE", ...productWhereForDiscountGroup(group) },
    orderBy: [
      { productCategory: { sortOrder: "asc" } },
      { productCategory: { name: "asc" } },
      { productCode: "asc" },
    ],
    select: {
      id: true,
      productCode: true,
      name: true,
      unit: true,
      productType: true,
      castingSupplierId: true,
      categoryId: true,
      productCategory: { select: { name: true } },
      priceListItems: {
        where: { priceListId },
        select: { unitPrice: true },
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    unit: product.unit,
    categoryId: product.categoryId,
    categoryName: product.productCategory.name,
    castingWithoutSupplier:
      product.productType === "CASTING" && product.castingSupplierId == null,
    listPrice: product.priceListItems[0]
      ? product.priceListItems[0].unitPrice.toFixed(2)
      : null,
  }));
}

export type DiscountGroupCounts = Record<
  DiscountGroupKey,
  { products: number; unpriced: number }
>;

/** How many active products each group has, and how many have no price on the list. */
export async function loadDiscountGroupCounts(
  priceListId: string,
  client: DbClient = prisma,
): Promise<DiscountGroupCounts> {
  const counts = {} as DiscountGroupCounts;
  // Sequential: `client` may be a transaction client pinned to one connection.
  for (const group of DISCOUNT_GROUP_KEYS) {
    const where: Prisma.ProductWhereInput = {
      status: "ACTIVE",
      ...productWhereForDiscountGroup(group),
    };
    const products = await client.product.count({ where });
    const priced = await client.product.count({
      where: { ...where, priceListItems: { some: { priceListId } } },
    });
    counts[group] = { products, unpriced: products - priced };
  }
  return counts;
}
