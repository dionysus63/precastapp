import "server-only";

import { cache } from "react";
import { withDatabaseRetry } from "@/lib/prisma";
import type { ProductKind, ProductType } from "@/app/generated/prisma/client";
import type {
  ProductTaxonomyCategory,
  ProductTaxonomyCategoryWithUsage,
} from "@/lib/product-taxonomy.shared";
import {
  collectMissingTaxonomyForImport,
  resolveTaxonomyByNames,
} from "@/lib/product-taxonomy.shared";

async function fetchActiveProductTaxonomy(): Promise<ProductTaxonomyCategory[]> {
  return withDatabaseRetry((client) =>
    client.productCategory.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        productType: true,
        sortOrder: true,
        status: true,
        defaultProductKind: true,
        subcategories: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, sortOrder: true },
        },
      },
    }),
  );
}

export type {
  ProductTaxonomyCategory,
  ProductTaxonomyCategoryWithUsage,
  ProductTaxonomySubcategory,
  ProductTaxonomySubcategoryWithUsage,
} from "@/lib/product-taxonomy.shared";

export const listProductTaxonomy = cache(fetchActiveProductTaxonomy);

export const listAllProductTaxonomyForSettings = cache(
  async (): Promise<ProductTaxonomyCategoryWithUsage[]> => {
    return withDatabaseRetry((client) =>
      client.productCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          _count: { select: { products: true } },
          subcategories: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: { _count: { select: { products: true } } },
          },
        },
      }),
    );
  },
);

export async function validateTaxonomySelection(
  categoryId: string,
  subcategoryId: string | null,
  expectedProductType?: ProductType,
): Promise<{ categoryId: string; subcategoryId: string | null; productType: ProductType }> {
  const category = await withDatabaseRetry((client) =>
    client.productCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, status: true, productType: true },
    }),
  );

  if (!category || category.status !== "ACTIVE") {
    throw new Error("Selected category was not found or is inactive.");
  }

  if (expectedProductType && category.productType !== expectedProductType) {
    throw new Error("Selected category does not match the product type.");
  }

  if (!subcategoryId) {
    return { categoryId, subcategoryId: null, productType: category.productType };
  }

  const subcategory = await withDatabaseRetry((client) =>
    client.productSubcategory.findFirst({
      where: { id: subcategoryId, categoryId },
      select: { id: true },
    }),
  );

  if (!subcategory) {
    throw new Error("Selected subcategory does not belong to the category.");
  }

  return { categoryId, subcategoryId, productType: category.productType };
}

export async function resolveTaxonomyByNamesForImport(
  categoryName: string,
  subcategoryName: string | null,
  expectedProductType: ProductType,
): Promise<{ categoryId: string; subcategoryId: string | null }> {
  const taxonomy = await fetchActiveProductTaxonomy();
  const resolved = resolveTaxonomyByNames(
    taxonomy,
    categoryName,
    subcategoryName,
    expectedProductType,
  );

  if (resolved.errors.length > 0) {
    throw new Error(resolved.errors.join(" "));
  }

  const validated = await validateTaxonomySelection(
    resolved.categoryId,
    resolved.subcategoryId,
    expectedProductType,
  );

  return {
    categoryId: validated.categoryId,
    subcategoryId: validated.subcategoryId,
  };
}

export async function ensureTaxonomyForBulkImport(
  rows: Array<{ category: string; subcategory: string | null }>,
  expectedProductType: ProductType,
  defaultProductKind: ProductKind | null,
): Promise<void> {
  const taxonomy = await fetchActiveProductTaxonomy();
  const missing = collectMissingTaxonomyForImport(
    taxonomy,
    rows.map((row) => ({
      category: row.category,
      subcategory: row.subcategory ?? "",
    })),
    expectedProductType,
  );

  if (missing.categories.length === 0 && missing.subcategories.length === 0) {
    return;
  }

  await withDatabaseRetry(async (client) => {
    const categoryIdByName = new Map<string, string>();
    for (const category of taxonomy) {
      categoryIdByName.set(category.name.toLowerCase(), category.id);
    }

    const maxCategorySort = await client.productCategory.aggregate({
      _max: { sortOrder: true },
    });
    let nextCategorySort = (maxCategorySort._max.sortOrder ?? -1) + 1;

    for (const { name } of missing.categories) {
      const existing = await client.productCategory.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true, status: true, productType: true },
      });

      if (existing) {
        if (existing.status !== "ACTIVE") {
          throw new Error(
            `Category "${name}" exists but is inactive. Reactivate it in Settings → Products.`,
          );
        }
        if (existing.productType !== expectedProductType) {
          throw new Error(
            `Category "${name}" exists for ${existing.productType}, not this import preset.`,
          );
        }
        categoryIdByName.set(name.toLowerCase(), existing.id);
        continue;
      }

      const created = await client.productCategory.create({
        data: {
          name,
          productType: expectedProductType,
          sortOrder: nextCategorySort,
          defaultProductKind,
        },
      });
      nextCategorySort += 1;
      categoryIdByName.set(name.toLowerCase(), created.id);
    }

    for (const { categoryName, name } of missing.subcategories) {
      const categoryId = categoryIdByName.get(categoryName.toLowerCase());
      if (!categoryId) {
        throw new Error(
          `Could not resolve category "${categoryName}" for subcategory "${name}".`,
        );
      }

      const existingSubcategory = await client.productSubcategory.findFirst({
        where: {
          categoryId,
          name: { equals: name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existingSubcategory) {
        continue;
      }

      const maxSubcategorySort = await client.productSubcategory.aggregate({
        where: { categoryId },
        _max: { sortOrder: true },
      });
      const nextSubcategorySort = (maxSubcategorySort._max.sortOrder ?? -1) + 1;

      await client.productSubcategory.create({
        data: {
          categoryId,
          name,
          sortOrder: nextSubcategorySort,
        },
      });
    }
  });
}
