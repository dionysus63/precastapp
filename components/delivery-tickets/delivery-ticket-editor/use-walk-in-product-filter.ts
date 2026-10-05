"use client";

import { useMemo, useState } from "react";
import { WALK_IN_RESULT_LIMIT } from "./editor-styles";
import type { ProductGroupOption, ProductOption } from "./types";

/** Walk-in product picker filters: search text, built-in categories vs
 * custom groups (a product can be in several groups — Settings → Product
 * Groups), and the derived category/group lists + filtered results. */
export function useWalkInProductFilter(
  products: ProductOption[],
  productGroups: ProductGroupOption[],
) {
  const [walkInSearch, setWalkInSearch] = useState("");
  // Picker filter mode: built-in categories vs custom groups (a product can
  // be in several groups — Settings → Product Groups).
  const [walkInPickerMode, setWalkInPickerMode] = useState<
    "categories" | "groups"
  >("categories");
  const [walkInGroupId, setWalkInGroupId] = useState<string | null>(null);
  const [walkInSubgroupId, setWalkInSubgroupId] = useState<string | null>(null);
  const [walkInCategoryId, setWalkInCategoryId] = useState("all");
  const [walkInSubcategoryId, setWalkInSubcategoryId] = useState<string | null>(
    null,
  );

  const walkInCategories = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; sortOrder: number; count: number }
    >();
    for (const product of products) {
      const existing = map.get(product.categoryId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(product.categoryId, {
          id: product.categoryId,
          name: product.categoryName,
          sortOrder: product.categorySortOrder,
          count: 1,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }, [products]);

  const walkInSubcategories = useMemo(() => {
    if (walkInCategoryId === "all") {
      return [];
    }
    const map = new Map<
      string,
      { id: string; name: string; sortOrder: number; count: number }
    >();
    let withoutSubcategory = 0;
    for (const product of products) {
      if (product.categoryId !== walkInCategoryId) {
        continue;
      }
      if (!product.subcategoryId) {
        withoutSubcategory += 1;
        continue;
      }
      const existing = map.get(product.subcategoryId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(product.subcategoryId, {
          id: product.subcategoryId,
          name: product.subcategoryName ?? "Other",
          sortOrder: product.subcategorySortOrder ?? 0,
          count: 1,
        });
      }
    }
    const list = [...map.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    if (list.length > 0 && withoutSubcategory > 0) {
      list.push({
        id: "__none__",
        name: "Other",
        sortOrder: Number.MAX_SAFE_INTEGER,
        count: withoutSubcategory,
      });
    }
    return list;
  }, [products, walkInCategoryId]);

  const topLevelGroups = useMemo(
    () => productGroups.filter((group) => group.parentId == null),
    [productGroups],
  );
  const subgroupsByParent = useMemo(() => {
    const map = new Map<string, typeof productGroups>();
    for (const group of productGroups) {
      if (group.parentId) {
        const list = map.get(group.parentId) ?? [];
        list.push(group);
        map.set(group.parentId, list);
      }
    }
    return map;
  }, [productGroups]);
  /** Ids a group filter matches: the group itself plus its sub-groups. */
  const groupFilterIds = useMemo(() => {
    if (!walkInGroupId) {
      return null;
    }
    if (walkInSubgroupId) {
      return new Set([walkInSubgroupId]);
    }
    return new Set([
      walkInGroupId,
      ...(subgroupsByParent.get(walkInGroupId) ?? []).map((group) => group.id),
    ]);
  }, [walkInGroupId, walkInSubgroupId, subgroupsByParent]);
  const productCountByGroupId = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      for (const membership of product.groupMemberships ?? []) {
        map.set(membership.groupId, (map.get(membership.groupId) ?? 0) + 1);
      }
    }
    return map;
  }, [products]);
  const countForGroup = (groupId: string) => {
    const ids = [
      groupId,
      ...(subgroupsByParent.get(groupId) ?? []).map((group) => group.id),
    ];
    const idSet = new Set(ids);
    return products.filter((product) =>
      (product.groupMemberships ?? []).some((membership) =>
        idSet.has(membership.groupId),
      ),
    ).length;
  };

  const walkInFiltered = useMemo(() => {
    const q = walkInSearch.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (walkInPickerMode === "categories") {
        if (
          walkInCategoryId !== "all" &&
          product.categoryId !== walkInCategoryId
        ) {
          return false;
        }
        if (walkInSubcategoryId) {
          const matches =
            walkInSubcategoryId === "__none__"
              ? product.subcategoryId == null
              : product.subcategoryId === walkInSubcategoryId;
          if (!matches) {
            return false;
          }
        }
      } else if (groupFilterIds) {
        if (
          !(product.groupMemberships ?? []).some((membership) =>
            groupFilterIds.has(membership.groupId),
          )
        ) {
          return false;
        }
      }
      if (q && !`${product.productCode} ${product.name}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    if (walkInPickerMode !== "groups" || !groupFilterIds) {
      return filtered;
    }
    // A group filter is active: list products in the order set on the group
    // (Settings → Product Groups); ties keep the catalog code order.
    const rank = (product: ProductOption) =>
      Math.min(
        ...(product.groupMemberships ?? [])
          .filter((membership) => groupFilterIds.has(membership.groupId))
          .map((membership) => membership.sortOrder),
      );
    return [...filtered].sort((a, b) => rank(a) - rank(b));
  }, [
    products,
    walkInSearch,
    walkInPickerMode,
    walkInCategoryId,
    walkInSubcategoryId,
    groupFilterIds,
  ]);

  const walkInResults = walkInFiltered.slice(0, WALK_IN_RESULT_LIMIT);

  function selectWalkInCategory(categoryId: string) {
    setWalkInCategoryId(categoryId);
    setWalkInSubcategoryId(null);
  }

  function selectWalkInPickerMode(mode: "categories" | "groups") {
    setWalkInPickerMode(mode);
    setWalkInCategoryId("all");
    setWalkInSubcategoryId(null);
    setWalkInGroupId(null);
    setWalkInSubgroupId(null);
  }

  function selectWalkInGroup(groupId: string | null) {
    setWalkInGroupId(groupId);
    setWalkInSubgroupId(null);
  }

  return {
    walkInSearch,
    setWalkInSearch,
    walkInPickerMode,
    walkInGroupId,
    walkInSubgroupId,
    setWalkInSubgroupId,
    walkInCategoryId,
    walkInSubcategoryId,
    setWalkInSubcategoryId,
    walkInCategories,
    walkInSubcategories,
    topLevelGroups,
    subgroupsByParent,
    productCountByGroupId,
    countForGroup,
    walkInFiltered,
    walkInResults,
    selectWalkInCategory,
    selectWalkInPickerMode,
    selectWalkInGroup,
  };
}

export type WalkInProductFilter = ReturnType<typeof useWalkInProductFilter>;
