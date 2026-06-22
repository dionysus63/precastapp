import "server-only";

import { cache } from "react";
import type { Prisma } from "@/app/generated/prisma/client";
import { getAppSettings } from "@/lib/app-settings";
import type {
  ProductCatalogCategory,
  ProductCatalogRename,
  ProductCatalogUsageGroup,
} from "@/lib/product-catalog-settings";
import { prisma } from "@/lib/prisma";

export const getProductCatalog = cache(
  async (): Promise<ProductCatalogCategory[]> => {
    const settings = await getAppSettings();
    return settings.productCatalog;
  },
);

const MAX_SAMPLE_PRODUCT_CODES = 3;

export const getProductCatalogUsage = cache(
  async (): Promise<ProductCatalogUsageGroup[]> => {
    const products = await prisma.product.findMany({
      select: {
        category: true,
        description: true,
        productCode: true,
      },
      orderBy: { productCode: "asc" },
    });

    const groups = new Map<string, ProductCatalogUsageGroup>();

    for (const product of products) {
      const category = product.category.trim();
      if (!category) {
        continue;
      }

      const subcategory = product.description?.trim() || null;
      const key = `${category.toLowerCase()}::${subcategory?.toLowerCase() ?? ""}`;

      const existing = groups.get(key);
      if (existing) {
        existing.productCount += 1;
        if (
          existing.sampleProductCodes.length < MAX_SAMPLE_PRODUCT_CODES &&
          !existing.sampleProductCodes.includes(product.productCode)
        ) {
          existing.sampleProductCodes.push(product.productCode);
        }
        continue;
      }

      groups.set(key, {
        category,
        subcategory,
        productCount: 1,
        sampleProductCodes: [product.productCode],
      });
    }

    return Array.from(groups.values());
  },
);

function isPairRename(rename: ProductCatalogRename): boolean {
  return Boolean(rename.fromSubcategory?.trim());
}

export async function applyProductCatalogRenames(
  tx: Prisma.TransactionClient,
  renames: ProductCatalogRename[],
): Promise<number> {
  let totalUpdated = 0;
  const pairRenames = renames.filter((rename) => isPairRename(rename));
  const categoryRenames = renames.filter((rename) => !isPairRename(rename));

  for (const rename of pairRenames) {
    const result = await tx.product.updateMany({
      where: {
        category: rename.fromCategory.trim(),
        description: rename.fromSubcategory!.trim(),
      },
      data: {
        category: rename.toCategory.trim(),
        description: rename.toSubcategory?.trim() ?? null,
      },
    });
    totalUpdated += result.count;
  }

  for (const rename of categoryRenames) {
    const result = await tx.product.updateMany({
      where: {
        category: rename.fromCategory.trim(),
      },
      data: {
        category: rename.toCategory.trim(),
      },
    });
    totalUpdated += result.count;
  }

  return totalUpdated;
}
