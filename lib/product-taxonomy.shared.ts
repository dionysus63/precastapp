import type {
  ProductCategoryStatus,
  ProductKind,
  ProductType,
} from "@/app/generated/prisma/client";

export type ProductTaxonomySubcategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type ProductTaxonomyCategory = {
  id: string;
  name: string;
  productType: ProductType;
  sortOrder: number;
  status: ProductCategoryStatus;
  defaultProductKind: ProductKind | null;
  subcategories: ProductTaxonomySubcategory[];
};

export type ProductTaxonomySubcategoryWithUsage = ProductTaxonomySubcategory & {
  _count: { products: number };
};

export type ProductTaxonomyCategoryWithUsage = Omit<
  ProductTaxonomyCategory,
  "subcategories"
> & {
  _count: { products: number };
  subcategories: ProductTaxonomySubcategoryWithUsage[];
};

export function getCategoriesForProductType(
  taxonomy: ProductTaxonomyCategory[],
  productType: ProductType,
): ProductTaxonomyCategory[] {
  return taxonomy.filter((category) => category.productType === productType);
}

export function getSubcategoriesForCategoryId(
  taxonomy: ProductTaxonomyCategory[],
  categoryId: string,
): ProductTaxonomySubcategory[] {
  return taxonomy.find((category) => category.id === categoryId)?.subcategories ?? [];
}

export function suggestedKindForCategoryId(
  taxonomy: ProductTaxonomyCategory[],
  categoryId: string,
): ProductKind | null {
  return taxonomy.find((category) => category.id === categoryId)?.defaultProductKind ?? null;
}

export function buildCategoryFilterOptions(
  taxonomy: ProductTaxonomyCategory[],
  productType?: ProductType | "All",
): Array<{ id: string; name: string }> {
  const scoped =
    productType && productType !== "All"
      ? getCategoriesForProductType(taxonomy, productType)
      : taxonomy;
  return [{ id: "All", name: "All" }, ...scoped.map((category) => ({
    id: category.id,
    name: category.name,
  }))];
}

export function buildSubcategoryFilterOptions(
  taxonomy: ProductTaxonomyCategory[],
  categoryId: string,
): Array<{ id: string; name: string }> {
  if (!categoryId || categoryId === "All") {
    return [{ id: "All", name: "All" }];
  }

  const subcategories = getSubcategoriesForCategoryId(taxonomy, categoryId);
  return [
    { id: "All", name: "All" },
    ...subcategories.map((subcategory) => ({
      id: subcategory.id,
      name: subcategory.name,
    })),
  ];
}

export const productKindFormOptionsForCategoryDefault: Array<{
  value: string;
  label: string;
}> = [
  { value: "", label: "None (manual kind on product form)" },
  { value: "STANDARD", label: "Standard" },
  { value: "DRAIN_RING", label: "Drain Ring" },
  { value: "CASTING_ASSEMBLY", label: "Casting Assembly" },
  { value: "CASTING_COMPONENT", label: "Casting Component" },
];

export function parseCategoryDefaultProductKind(
  raw: string,
): ProductKind | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const kinds: ProductKind[] = [
    "STANDARD",
    "DRAIN_RING",
    "CASTING_ASSEMBLY",
    "CASTING_COMPONENT",
  ];
  return kinds.includes(value as ProductKind) ? (value as ProductKind) : null;
}

export function parseCategoryProductType(raw: string): ProductType | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const types: ProductType[] = [
    "STOCK_PRECAST",
    "CASTING",
    "ACCESSORY",
    "PRECAST_PIPE",
    "ADS_PIPE",
    "CONFIGURABLE",
    "SERVICE",
  ];
  return types.includes(value as ProductType) ? (value as ProductType) : null;
}

export type ResolvedTaxonomyByName = {
  categoryId: string;
  subcategoryId: string | null;
  errors: string[];
};

export type TaxonomyAnalyzeResult = {
  categoryId: string | null;
  subcategoryId: string | null;
  missingCategory: boolean;
  missingSubcategory: boolean;
  errors: string[];
};

export type MissingTaxonomyForImport = {
  categories: Array<{ name: string }>;
  subcategories: Array<{ categoryName: string; name: string }>;
};

function categoryNameMatches(
  category: ProductTaxonomyCategory,
  categoryName: string,
): boolean {
  return category.name.toLowerCase() === categoryName.toLowerCase();
}

export function analyzeTaxonomyByNames(
  taxonomy: ProductTaxonomyCategory[],
  categoryName: string,
  subcategoryName?: string | null,
  expectedProductType?: ProductType,
): TaxonomyAnalyzeResult {
  const errors: string[] = [];
  const trimmedCategory = categoryName.trim();
  const trimmedSubcategory = subcategoryName?.trim() ?? "";

  if (!trimmedCategory) {
    return {
      categoryId: null,
      subcategoryId: null,
      missingCategory: false,
      missingSubcategory: false,
      errors: ["Category is required."],
    };
  }

  const globalMatches = taxonomy.filter((category) =>
    categoryNameMatches(category, trimmedCategory),
  );

  if (globalMatches.length > 0 && expectedProductType) {
    const scopedMatch = globalMatches.find(
      (category) => category.productType === expectedProductType,
    );
    if (!scopedMatch) {
      errors.push(
        `Category "${trimmedCategory}" exists but is for ${globalMatches[0].productType}, not this import preset.`,
      );
      return {
        categoryId: null,
        subcategoryId: null,
        missingCategory: false,
        missingSubcategory: false,
        errors,
      };
    }
  }

  const scoped = expectedProductType
    ? getCategoriesForProductType(taxonomy, expectedProductType)
    : taxonomy;

  const categoryMatches = scoped.filter((category) =>
    categoryNameMatches(category, trimmedCategory),
  );

  if (categoryMatches.length === 0) {
    return {
      categoryId: null,
      subcategoryId: null,
      missingCategory: true,
      missingSubcategory: trimmedSubcategory.length > 0,
      errors,
    };
  }

  if (categoryMatches.length > 1) {
    errors.push(`Category "${trimmedCategory}" is ambiguous — use a unique name.`);
    return {
      categoryId: null,
      subcategoryId: null,
      missingCategory: false,
      missingSubcategory: false,
      errors,
    };
  }

  const category = categoryMatches[0];

  if (!trimmedSubcategory) {
    return {
      categoryId: category.id,
      subcategoryId: null,
      missingCategory: false,
      missingSubcategory: false,
      errors,
    };
  }

  const subcategoryMatches = category.subcategories.filter(
    (subcategory) =>
      subcategory.name.toLowerCase() === trimmedSubcategory.toLowerCase(),
  );

  if (subcategoryMatches.length === 0) {
    return {
      categoryId: category.id,
      subcategoryId: null,
      missingCategory: false,
      missingSubcategory: true,
      errors,
    };
  }

  if (subcategoryMatches.length > 1) {
    errors.push(
      `Subcategory "${trimmedSubcategory}" is ambiguous under ${category.name}.`,
    );
    return {
      categoryId: category.id,
      subcategoryId: null,
      missingCategory: false,
      missingSubcategory: false,
      errors,
    };
  }

  return {
    categoryId: category.id,
    subcategoryId: subcategoryMatches[0].id,
    missingCategory: false,
    missingSubcategory: false,
    errors,
  };
}

export function collectMissingTaxonomyForImport(
  taxonomy: ProductTaxonomyCategory[],
  rows: Array<{ category: string; subcategory: string }>,
  expectedProductType: ProductType,
): MissingTaxonomyForImport {
  const categoriesByKey = new Map<string, string>();
  const subcategoriesByKey = new Map<string, MissingTaxonomyForImport["subcategories"][number]>();

  for (const row of rows) {
    const analyzed = analyzeTaxonomyByNames(
      taxonomy,
      row.category,
      row.subcategory,
      expectedProductType,
    );
    if (analyzed.errors.length > 0) {
      continue;
    }

    const categoryName = row.category.trim();
    const subcategoryName = row.subcategory.trim();
    if (!categoryName) {
      continue;
    }

    if (analyzed.missingCategory) {
      categoriesByKey.set(categoryName.toLowerCase(), categoryName);
    }

    if (analyzed.missingSubcategory && subcategoryName) {
      subcategoriesByKey.set(
        `${categoryName.toLowerCase()}|${subcategoryName.toLowerCase()}`,
        { categoryName, name: subcategoryName },
      );
    }
  }

  return {
    categories: [...categoriesByKey.values()].map((name) => ({ name })),
    subcategories: [...subcategoriesByKey.values()],
  };
}

export function resolveTaxonomyByNames(
  taxonomy: ProductTaxonomyCategory[],
  categoryName: string,
  subcategoryName?: string | null,
  expectedProductType?: ProductType,
): ResolvedTaxonomyByName {
  const analyzed = analyzeTaxonomyByNames(
    taxonomy,
    categoryName,
    subcategoryName,
    expectedProductType,
  );
  const trimmedCategory = categoryName.trim();
  const trimmedSubcategory = subcategoryName?.trim() ?? "";
  const errors = [...analyzed.errors];

  if (analyzed.missingCategory) {
    errors.push(
      expectedProductType
        ? `Category "${trimmedCategory}" was not found for this import preset.`
        : `Category "${trimmedCategory}" was not found.`,
    );
  }

  if (analyzed.missingSubcategory) {
    errors.push(
      `Subcategory "${trimmedSubcategory}" was not found under ${trimmedCategory}.`,
    );
  }

  return {
    categoryId: analyzed.categoryId ?? "",
    subcategoryId: analyzed.subcategoryId,
    errors,
  };
}
