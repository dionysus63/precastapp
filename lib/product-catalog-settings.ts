export type ProductCatalogCategory = {
  name: string;
  subcategories: string[];
};

export const DEFAULT_PRODUCT_CATALOG: ProductCatalogCategory[] = [
  {
    name: "Vaults",
    subcategories: ["Traffic Rated", "Standard Duty", "Light Duty"],
  },
  {
    name: "Manholes",
    subcategories: ["Riser", "Cone", "Base Section", "Sanitary Sewer"],
  },
  {
    name: "Walls",
    subcategories: ["H6 Panel", "H8 Panel", "Corner Panel"],
  },
  {
    name: "Slabs",
    subcategories: ["Equipment Pad", "Sidewalk Slab"],
  },
  {
    name: "Drainage",
    subcategories: ["Catch Basin", "Sanitary Sewer"],
  },
  {
    name: "Accessories",
    subcategories: ["Lifting Hardware", "Connection Hardware"],
  },
  {
    name: "Castings",
    subcategories: ["Traffic Rated", "Sanitary", "Water", "Other"],
  },
];

function normalizeSubcategories(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(trimmed);
  }

  return items;
}

export function parseProductCatalog(value: unknown): ProductCatalogCategory[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_PRODUCT_CATALOG;
  }

  const seenCategories = new Set<string>();
  const catalog: ProductCatalogCategory[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const name =
      "name" in entry && typeof entry.name === "string"
        ? entry.name.trim()
        : "";
    if (!name) {
      continue;
    }

    const categoryKey = name.toLowerCase();
    if (seenCategories.has(categoryKey)) {
      continue;
    }

    const subcategories = normalizeSubcategories(
      "subcategories" in entry ? entry.subcategories : [],
    );
    if (subcategories.length === 0) {
      continue;
    }

    seenCategories.add(categoryKey);
    catalog.push({ name, subcategories });
  }

  return catalog.length > 0 ? catalog : DEFAULT_PRODUCT_CATALOG;
}

export function validateProductCatalog(
  catalog: ProductCatalogCategory[],
): string | null {
  if (catalog.length === 0) {
    return "Add at least one category.";
  }

  const seenCategories = new Set<string>();

  for (const category of catalog) {
    const name = category.name.trim();
    if (!name) {
      return "Each category needs a name.";
    }

    const categoryKey = name.toLowerCase();
    if (seenCategories.has(categoryKey)) {
      return `Duplicate category name: ${name}`;
    }
    seenCategories.add(categoryKey);

    if (category.subcategories.length === 0) {
      return `Category "${name}" needs at least one subcategory.`;
    }

    const seenSubcategories = new Set<string>();
    for (const subcategory of category.subcategories) {
      const trimmed = subcategory.trim();
      if (!trimmed) {
        return `Category "${name}" has an empty subcategory line.`;
      }

      const subcategoryKey = trimmed.toLowerCase();
      if (seenSubcategories.has(subcategoryKey)) {
        return `Duplicate subcategory "${trimmed}" under ${name}.`;
      }
      seenSubcategories.add(subcategoryKey);
    }
  }

  return null;
}

export function parseProductCatalogFromFormData(
  raw: string,
): ProductCatalogCategory[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid product catalog data.");
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Category ${index + 1} is invalid.`);
    }

    const name =
      "name" in entry && typeof entry.name === "string"
        ? entry.name.trim()
        : "";
    const subcategories = normalizeSubcategories(
      "subcategories" in entry ? entry.subcategories : [],
    );

    return { name, subcategories };
  });
}

export function getCategoryNames(catalog: ProductCatalogCategory[]): string[] {
  return catalog.map((category) => category.name);
}

export function getSubcategoriesForCategory(
  catalog: ProductCatalogCategory[],
  categoryName: string,
): string[] {
  const match = catalog.find(
    (category) => category.name.toLowerCase() === categoryName.toLowerCase(),
  );
  return match?.subcategories ?? [];
}

export function getAllSubcategories(catalog: ProductCatalogCategory[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const category of catalog) {
    for (const subcategory of category.subcategories) {
      const key = subcategory.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(subcategory);
    }
  }

  return items;
}

export type ProductCatalogInUsePair = {
  category: string;
  subcategory: string;
};

export function mergeCatalogWithInUseValues(
  catalog: ProductCatalogCategory[],
  inUsePairs: ProductCatalogInUsePair[],
): ProductCatalogCategory[] {
  const merged = catalog.map((category) => ({
    name: category.name,
    subcategories: [...category.subcategories],
  }));

  for (const pair of inUsePairs) {
    const categoryName = pair.category.trim();
    const trimmedSubcategory = pair.subcategory.trim();
    const subcategoryName =
      trimmedSubcategory === "—" ? "" : trimmedSubcategory;
    if (!categoryName) {
      continue;
    }

    let category = merged.find(
      (entry) => entry.name.toLowerCase() === categoryName.toLowerCase(),
    );

    if (!category) {
      category = {
        name: categoryName,
        subcategories: subcategoryName ? [subcategoryName] : [],
      };
      merged.push(category);
      continue;
    }

    if (
      subcategoryName &&
      !category.subcategories.some(
        (entry) => entry.toLowerCase() === subcategoryName.toLowerCase(),
      )
    ) {
      category.subcategories.push(subcategoryName);
    }
  }

  return merged;
}

export function buildCategoryFilterOptions(
  catalog: ProductCatalogCategory[],
): string[] {
  return ["All", ...getCategoryNames(catalog)];
}

export function buildSubcategoryFilterOptions(
  catalog: ProductCatalogCategory[],
  categoryFilter: string,
): string[] {
  if (categoryFilter === "All") {
    return ["All", ...getAllSubcategories(catalog)];
  }

  return [
    "All",
    ...getSubcategoriesForCategory(catalog, categoryFilter),
  ];
}

export type ProductCatalogUsageGroup = {
  category: string;
  subcategory: string | null;
  productCount: number;
  sampleProductCodes: string[];
};

export type ProductCatalogInUseConflict = ProductCatalogUsageGroup & {
  kind: "category" | "subcategory";
};

const MAX_SAMPLE_PRODUCT_CODES = 3;

function normalizeCatalogKey(value: string): string {
  return value.trim().toLowerCase();
}

export function catalogContainsPair(
  catalog: ProductCatalogCategory[],
  category: string,
  subcategory: string | null,
): boolean {
  const categoryName = category.trim();
  if (!categoryName) {
    return false;
  }

  const match = catalog.find(
    (entry) =>
      normalizeCatalogKey(entry.name) === normalizeCatalogKey(categoryName),
  );
  if (!match) {
    return false;
  }

  const subcategoryName = subcategory?.trim() ?? "";
  if (!subcategoryName) {
    return true;
  }

  return match.subcategories.some(
    (entry) => normalizeCatalogKey(entry) === normalizeCatalogKey(subcategoryName),
  );
}

export function findCatalogInUseConflicts(
  catalog: ProductCatalogCategory[],
  usageGroups: ProductCatalogUsageGroup[],
): ProductCatalogInUseConflict[] {
  const conflicts: ProductCatalogInUseConflict[] = [];

  for (const group of usageGroups) {
    if (catalogContainsPair(catalog, group.category, group.subcategory)) {
      continue;
    }

    const categoryExists = catalog.some(
      (entry) =>
        normalizeCatalogKey(entry.name) === normalizeCatalogKey(group.category),
    );

    conflicts.push({
      ...group,
      kind: categoryExists ? "subcategory" : "category",
    });
  }

  return conflicts;
}

function formatSampleProductCodes(sampleProductCodes: string[]): string {
  const samples = sampleProductCodes.slice(0, MAX_SAMPLE_PRODUCT_CODES);
  if (samples.length === 0) {
    return "";
  }

  const suffix =
    sampleProductCodes.length > MAX_SAMPLE_PRODUCT_CODES ? ", …" : "";
  return ` (${samples.join(", ")}${suffix})`;
}

export function formatProductCatalogInUseError(
  conflicts: ProductCatalogInUseConflict[],
): string {
  if (conflicts.length === 0) {
    return "Cannot save product catalog.";
  }

  const parts = conflicts.map((conflict) => {
    const samples = formatSampleProductCodes(conflict.sampleProductCodes);
    const countLabel =
      conflict.productCount === 1 ? "1 product" : `${conflict.productCount} products`;

    if (conflict.kind === "category") {
      return `Category "${conflict.category}" is used by ${countLabel}${samples}`;
    }

    const subcategoryLabel = conflict.subcategory ?? "(none)";
    return `Subcategory "${subcategoryLabel}" under ${conflict.category} is used by ${countLabel}${samples}`;
  });

  return `Cannot save product catalog. ${parts.join(". ")}. Reassign those products before removing these options.`;
}

export type ProductCatalogRename = {
  fromCategory: string;
  toCategory: string;
  fromSubcategory?: string | null;
  toSubcategory?: string | null;
};

export type ProductCatalogEditableBlock = {
  originalName: string;
  originalSubcategories: string[];
  name: string;
  subcategories: string[];
};

function isPairRename(rename: ProductCatalogRename): boolean {
  return Boolean(rename.fromSubcategory?.trim());
}

export function detectCatalogRenames(
  blocks: ProductCatalogEditableBlock[],
): ProductCatalogRename[] {
  const renames: ProductCatalogRename[] = [];

  for (const block of blocks) {
    const originalName = block.originalName.trim();
    const name = block.name.trim();
    const maxIndex = Math.min(
      block.originalSubcategories.length,
      block.subcategories.length,
    );

    for (let index = 0; index < maxIndex; index += 1) {
      const fromSubcategory = block.originalSubcategories[index]?.trim() ?? "";
      const toSubcategory = block.subcategories[index]?.trim() ?? "";
      if (!fromSubcategory || !toSubcategory || fromSubcategory === toSubcategory) {
        continue;
      }

      renames.push({
        fromCategory: originalName,
        toCategory: name,
        fromSubcategory,
        toSubcategory,
      });
    }

    if (
      originalName &&
      name &&
      normalizeCatalogKey(originalName) !== normalizeCatalogKey(name)
    ) {
      renames.push({
        fromCategory: originalName,
        toCategory: name,
      });
    }
  }

  return renames;
}

export function parseCatalogRenamesFromFormData(
  raw: string,
): ProductCatalogRename[] {
  if (!raw.trim()) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid catalog rename data.");
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Catalog rename ${index + 1} is invalid.`);
    }

    const fromCategory =
      "fromCategory" in entry && typeof entry.fromCategory === "string"
        ? entry.fromCategory.trim()
        : "";
    const toCategory =
      "toCategory" in entry && typeof entry.toCategory === "string"
        ? entry.toCategory.trim()
        : "";
    const fromSubcategory =
      "fromSubcategory" in entry &&
      (typeof entry.fromSubcategory === "string" ||
        entry.fromSubcategory === null)
        ? entry.fromSubcategory?.trim() ?? null
        : null;
    const toSubcategory =
      "toSubcategory" in entry &&
      (typeof entry.toSubcategory === "string" || entry.toSubcategory === null)
        ? entry.toSubcategory?.trim() ?? null
        : null;

    if (!fromCategory || !toCategory) {
      throw new Error(`Catalog rename ${index + 1} is missing category names.`);
    }

    return {
      fromCategory,
      toCategory,
      fromSubcategory,
      toSubcategory,
    };
  });
}

export function validateCatalogRenames(
  renames: ProductCatalogRename[],
  oldCatalog: ProductCatalogCategory[],
  newCatalog: ProductCatalogCategory[],
): string | null {
  for (const rename of renames) {
    if (isPairRename(rename)) {
      const fromSubcategory = rename.fromSubcategory!.trim();
      const toSubcategory = rename.toSubcategory?.trim() ?? "";
      if (!toSubcategory) {
        return `Rename for "${fromSubcategory}" needs a new subcategory name.`;
      }
      if (
        !catalogContainsPair(oldCatalog, rename.fromCategory, fromSubcategory)
      ) {
        return `Subcategory "${fromSubcategory}" under ${rename.fromCategory} was not in the saved catalog.`;
      }
      if (
        !catalogContainsPair(newCatalog, rename.toCategory, toSubcategory)
      ) {
        return `New subcategory "${toSubcategory}" under ${rename.toCategory} is not in the updated catalog.`;
      }
      continue;
    }

    const oldCategoryExists = oldCatalog.some(
      (entry) =>
        normalizeCatalogKey(entry.name) ===
        normalizeCatalogKey(rename.fromCategory),
    );
    if (!oldCategoryExists) {
      return `Category "${rename.fromCategory}" was not in the saved catalog.`;
    }

    const newCategoryExists = newCatalog.some(
      (entry) =>
        normalizeCatalogKey(entry.name) ===
        normalizeCatalogKey(rename.toCategory),
    );
    if (!newCategoryExists) {
      return `Category "${rename.toCategory}" is not in the updated catalog.`;
    }

    if (
      normalizeCatalogKey(rename.fromCategory) ===
      normalizeCatalogKey(rename.toCategory)
    ) {
      return "Invalid category rename.";
    }
  }

  return null;
}

function renameCoversConflict(
  rename: ProductCatalogRename,
  conflict: ProductCatalogInUseConflict,
): boolean {
  if (
    normalizeCatalogKey(rename.fromCategory) !==
    normalizeCatalogKey(conflict.category)
  ) {
    return false;
  }

  if (isPairRename(rename)) {
    const conflictSubcategory = conflict.subcategory?.trim() ?? "";
    return (
      normalizeCatalogKey(rename.fromSubcategory!) ===
      normalizeCatalogKey(conflictSubcategory)
    );
  }

  return true;
}

export function conflictsNotCoveredByRenames(
  conflicts: ProductCatalogInUseConflict[],
  renames: ProductCatalogRename[],
): ProductCatalogInUseConflict[] {
  if (renames.length === 0) {
    return conflicts;
  }

  return conflicts.filter(
    (conflict) =>
      !renames.some((rename) => renameCoversConflict(rename, conflict)),
  );
}

export function countProductsForRename(
  rename: ProductCatalogRename,
  usage: ProductCatalogUsageGroup[],
): number {
  if (isPairRename(rename)) {
    const group = usage.find(
      (entry) =>
        normalizeCatalogKey(entry.category) ===
          normalizeCatalogKey(rename.fromCategory) &&
        normalizeCatalogKey(entry.subcategory ?? "") ===
          normalizeCatalogKey(rename.fromSubcategory!),
    );
    return group?.productCount ?? 0;
  }

  return usage
    .filter(
      (entry) =>
        normalizeCatalogKey(entry.category) ===
        normalizeCatalogKey(rename.fromCategory),
    )
    .reduce((total, entry) => total + entry.productCount, 0);
}

export function renamesAffectingProducts(
  renames: ProductCatalogRename[],
  usage: ProductCatalogUsageGroup[],
): boolean {
  return renames.some((rename) => countProductsForRename(rename, usage) > 0);
}

export function formatCatalogRenameLabel(rename: ProductCatalogRename): string {
  if (isPairRename(rename)) {
    return `Subcategory "${rename.fromSubcategory}" under ${rename.fromCategory} → "${rename.toSubcategory}" under ${rename.toCategory}`;
  }

  return `Category "${rename.fromCategory}" → "${rename.toCategory}"`;
}
