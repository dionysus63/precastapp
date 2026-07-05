/** Client-safe taxonomy types and helpers. Server queries live in product-taxonomy.server.ts */
export type {
  ProductTaxonomyCategory,
  ProductTaxonomyCategoryWithUsage,
  ProductTaxonomySubcategory,
  ProductTaxonomySubcategoryWithUsage,
} from "@/lib/product-taxonomy.shared";

export {
  analyzeTaxonomyByNames,
  buildCategoryFilterOptions,
  buildSubcategoryFilterOptions,
  collectMissingTaxonomyForImport,
  getCategoriesForProductType,
  getSubcategoriesForCategoryId,
  parseCategoryDefaultProductKind,
  parseCategoryProductType,
  productKindFormOptionsForCategoryDefault,
  resolveTaxonomyByNames,
  suggestedKindForCategoryId,
} from "@/lib/product-taxonomy.shared";

export type { MissingTaxonomyForImport } from "@/lib/product-taxonomy.shared";
