import type { Prisma } from "@/app/generated/prisma/client";
import { prisma, withDatabaseRetry } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type PriceListOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type PriceListCompleteness = {
  totalActiveProducts: number;
  listedCount: number;
  missingCount: number;
  isComplete: boolean;
};

export async function getDefaultPriceList(
  client: DbClient = prisma,
): Promise<PriceListOption | null> {
  const list = await client.priceList.findFirst({
    where: { isDefault: true },
    select: { id: true, name: true, isDefault: true },
  });
  if (list) {
    return list;
  }

  return client.priceList.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, isDefault: true },
  });
}

export async function getDefaultPriceListId(
  client: DbClient = prisma,
): Promise<string | null> {
  const list = await getDefaultPriceList(client);
  return list?.id ?? null;
}

export async function listPriceListOptions(
  client: DbClient = prisma,
): Promise<PriceListOption[]> {
  return client.priceList.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });
}

export async function getActiveProductCount(
  client: DbClient = prisma,
): Promise<number> {
  return client.product.count({ where: { status: "ACTIVE" } });
}

export async function getPriceListCompleteness(
  priceListId: string,
  client: DbClient = prisma,
): Promise<PriceListCompleteness> {
  // Sequential awaits: `client` may be a transaction client, which is pinned
  // to a single pg connection — concurrent queries on it are unsupported
  // (deprecated in pg 8, removed in pg 9).
  const totalActiveProducts = await getActiveProductCount(client);
  const listedCount = await client.priceListItem.count({
    where: { priceListId },
  });

  const missingCount = Math.max(0, totalActiveProducts - listedCount);

  return {
    totalActiveProducts,
    listedCount,
    missingCount,
    isComplete: missingCount === 0,
  };
}

export async function getMissingProductsForPriceList(
  priceListId: string,
  client: DbClient = prisma,
) {
  const listedProductIds = await client.priceListItem.findMany({
    where: { priceListId },
    select: { productId: true },
  });
  const listedIds = new Set(listedProductIds.map((item) => item.productId));

  const products = await client.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { productCode: "asc" },
    select: { id: true, productCode: true, name: true },
  });

  return products.filter((product) => !listedIds.has(product.id));
}

export async function getOtherPriceListIds(
  excludePriceListId: string,
  client: DbClient = prisma,
): Promise<string[]> {
  const lists = await client.priceList.findMany({
    where: { id: { not: excludePriceListId } },
    select: { id: true },
  });
  return lists.map((list) => list.id);
}

export async function getPriceListsMissingProducts(
  productIds: string[],
  excludePriceListId: string,
  client: DbClient = prisma,
): Promise<Array<{ id: string; name: string; missingCount: number }>> {
  if (productIds.length === 0) {
    return [];
  }

  const otherLists = await client.priceList.findMany({
    where: { id: { not: excludePriceListId } },
    select: { id: true, name: true },
  });

  const results: Array<{ id: string; name: string; missingCount: number }> = [];

  for (const list of otherLists) {
    const covered = await client.priceListItem.count({
      where: {
        priceListId: list.id,
        productId: { in: productIds },
      },
    });
    const missingCount = productIds.length - covered;
    if (missingCount > 0) {
      results.push({ id: list.id, name: list.name, missingCount });
    }
  }

  return results;
}

export async function assertPriceListCompleteForDefault(
  priceListId: string,
  client: DbClient = prisma,
): Promise<void> {
  const completeness = await getPriceListCompleteness(priceListId, client);
  if (!completeness.isComplete) {
    throw new Error(
      `Cannot set as default: ${completeness.missingCount} active product(s) are missing prices on this list.`,
    );
  }
}

export async function copyPriceListItems(
  targetPriceListId: string,
  sourcePriceListId: string,
  client: DbClient = prisma,
): Promise<number> {
  const sourceItems = await client.priceListItem.findMany({
    where: { priceListId: sourcePriceListId },
    select: { productId: true, unitPrice: true },
  });

  for (const item of sourceItems) {
    await client.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: targetPriceListId,
          productId: item.productId,
        },
      },
      create: {
        priceListId: targetPriceListId,
        productId: item.productId,
        unitPrice: item.unitPrice,
      },
      update: { unitPrice: item.unitPrice },
    });
  }

  return sourceItems.length;
}

export async function upsertProductPriceListItem(
  priceListId: string,
  productId: string,
  unitPrice: Prisma.Decimal,
  client: DbClient = prisma,
) {
  return client.priceListItem.upsert({
    where: {
      priceListId_productId: { priceListId, productId },
    },
    create: { priceListId, productId, unitPrice },
    update: { unitPrice },
  });
}

export async function getProductPricesForList(
  productIds: string[],
  priceListId: string | null,
  client: DbClient = prisma,
): Promise<Map<string, Prisma.Decimal>> {
  if (!priceListId || productIds.length === 0) {
    return new Map();
  }

  const items = await client.priceListItem.findMany({
    where: {
      priceListId,
      productId: { in: productIds },
    },
    select: { productId: true, unitPrice: true },
  });

  return new Map(items.map((item) => [item.productId, item.unitPrice]));
}

export async function loadPriceListOptionsForForms() {
  return withDatabaseRetry((client) => listPriceListOptions(client));
}
