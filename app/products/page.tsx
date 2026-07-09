import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CategoryChipBar } from "@/components/common/category-chip-bar";
import { ImportFeedbackBanner } from "@/components/common/import-feedback-banner";
import { ProductsList } from "@/components/products/products-list";
import { mapProductToRow } from "@/lib/product-mapper";
import {
  enrichProductWithDerivedAssemblyValues,
  isPartsModeCastingAssembly,
  loadDerivedAssemblyValues,
} from "@/lib/casting-service";
import { getDefaultPriceList, getProductPricesForList } from "@/lib/price-list-service";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { PRODUCT_SUBMITTAL_DOCUMENT_TYPES } from "@/lib/product-submittals-service";
import { loadEffectiveSubmittalCountsByProductId } from "@/lib/submittal-package";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  productStatusFormOptions,
  productTypeFormOptions,
} from "@/components/products/product-utils";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import type { Prisma } from "@/app/generated/prisma/client";

const VALID_PRODUCT_TYPES = new Set<string>(
  productTypeFormOptions.map((option) => option.value),
);
const VALID_PRODUCT_STATUSES = new Set<string>(
  productStatusFormOptions.map((option) => option.value),
);

const PRODUCT_SORT_COLUMNS = [
  "code",
  "name",
  "type",
  "category",
  "subcategory",
  "unit",
  "price",
  "weight",
  "yards",
  "submittals",
] as const;

type ProductSortColumn = (typeof PRODUCT_SORT_COLUMNS)[number];

function buildProductOrderBy(
  column: ProductSortColumn,
  dir: "asc" | "desc",
): Prisma.ProductOrderByWithRelationInput[] {
  switch (column) {
    case "code":
      return [{ productCode: dir }];
    case "type":
      return [{ productType: dir }, { name: "asc" }];
    case "category":
      return [{ productCategory: { name: dir } }, { name: "asc" }];
    case "subcategory":
      return [{ subcategory: { name: dir } }, { name: "asc" }];
    case "unit":
      return [{ unit: dir }, { name: "asc" }];
    case "weight":
      return [{ weight: { sort: dir, nulls: "last" } }, { name: "asc" }];
    case "yards":
      return [{ yards: { sort: dir, nulls: "last" } }, { name: "asc" }];
    default:
      return [{ name: dir }];
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const search = parseStringParam(params.q);
  const typeParam = parseStringParam(params.type);
  const categoryParam = parseStringParam(params.category);
  const subcategoryParam = parseStringParam(params.subcategory);
  const statusParam = parseStringParam(params.status);
  const submittalsParam = parseStringParam(params.submittals);
  const castingOriginParam = parseStringParam(params.castingOrigin);
  const sortParam = parseStringParam(params.sort);
  const dirParam = parseStringParam(params.dir);
  const requestedPage = parsePageParam(params.page);

  const sortColumn: ProductSortColumn = PRODUCT_SORT_COLUMNS.includes(
    sortParam as ProductSortColumn,
  )
    ? (sortParam as ProductSortColumn)
    : "name";
  const sortDirection: "asc" | "desc" = dirParam === "desc" ? "desc" : "asc";
  // Price and submittal counts aren't product columns (price-list entry and
  // effective count with the assembly→components fallback), so those sorts
  // order matching ids in memory instead of in SQL.
  const isComputedSort = sortColumn === "price" || sortColumn === "submittals";
  const importedCount = Number.parseInt(parseStringParam(params.imported) ?? "", 10);
  const updatedCount = Number.parseInt(parseStringParam(params.updated) ?? "", 10);
  const imported =
    Number.isFinite(importedCount) && importedCount > 0 ? importedCount : 0;
  const updated =
    Number.isFinite(updatedCount) && updatedCount > 0 ? updatedCount : 0;

  const submittalDocFilter = {
    documentType: { in: PRODUCT_SUBMITTAL_DOCUMENT_TYPES },
  };

  // Everything except the category/subcategory conditions — chip counts are
  // computed against this so each chip shows what selecting it would yield.
  const whereWithoutTaxonomy: Prisma.ProductWhereInput = {
    ...(typeParam && VALID_PRODUCT_TYPES.has(typeParam)
      ? { productType: typeParam as Prisma.ProductWhereInput["productType"] }
      : {}),
    ...(statusParam && VALID_PRODUCT_STATUSES.has(statusParam)
      ? { status: statusParam as Prisma.ProductWhereInput["status"] }
      : {}),
    ...(submittalsParam === "Has submittals"
      ? { documents: { some: submittalDocFilter } }
      : submittalsParam === "Missing submittals"
        ? { documents: { none: submittalDocFilter } }
        : {}),
    ...(typeParam === "CASTING" && castingOriginParam === "Domestic"
      ? { castingSupplier: { origin: "DOMESTIC" } }
      : typeParam === "CASTING" && castingOriginParam === "Imported"
        ? { castingSupplier: { origin: "IMPORTED" } }
        : {}),
    ...(search
      ? {
          OR: [
            { productCode: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { productCategory: { name: { contains: search, mode: "insensitive" } } },
            { subcategory: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const categorySelected =
    categoryParam && categoryParam !== "All" ? categoryParam : null;
  const subcategorySelected =
    subcategoryParam && subcategoryParam !== "All" ? subcategoryParam : null;

  const where: Prisma.ProductWhereInput = {
    ...whereWithoutTaxonomy,
    ...(categorySelected ? { categoryId: categorySelected } : {}),
    ...(subcategorySelected
      ? { subcategoryId: subcategorySelected === "none" ? null : subcategorySelected }
      : {}),
  };

  const [total, defaultPriceList] = await withDatabaseRetry((prisma) =>
    Promise.all([prisma.product.count({ where }), getDefaultPriceList(prisma)]),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  // Computed sorts: order every matching id in memory, then page over the ids.
  let orderedPageIds: string[] | null = null;
  if (isComputedSort) {
    const idRows = await withDatabaseRetry((prisma) =>
      prisma.product.findMany({ where, select: { id: true, name: true } }),
    );
    const valueById = new Map<string, number>();
    if (sortColumn === "price") {
      const priceMap = await getProductPricesForList(
        idRows.map((row) => row.id),
        defaultPriceList?.id ?? null,
      );
      for (const [id, price] of priceMap) {
        valueById.set(id, Number(price));
      }
    } else {
      const counts = await withDatabaseRetry((prisma) =>
        loadEffectiveSubmittalCountsByProductId(
          prisma,
          idRows.map((row) => row.id),
        ),
      );
      for (const [id, count] of counts) {
        valueById.set(id, count);
      }
    }
    idRows.sort((a, b) => {
      const aValue = valueById.get(a.id) ?? null;
      const bValue = valueById.get(b.id) ?? null;
      // Missing values (no price on the list) always sort last.
      if (aValue == null && bValue == null) {
        return a.name.localeCompare(b.name);
      }
      if (aValue == null) {
        return 1;
      }
      if (bValue == null) {
        return -1;
      }
      const diff = sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
    orderedPageIds = idRows
      .slice(pageInfo.skip, pageInfo.skip + pageInfo.take)
      .map((row) => row.id);
  }

  const [fetchedProducts, taxonomy, categoryGroups, subcategoryGroups] =
    await withDatabaseRetry((prisma) =>
      Promise.all([
        prisma.product.findMany({
          where: orderedPageIds ? { id: { in: orderedPageIds } } : where,
          orderBy: buildProductOrderBy(sortColumn, sortDirection),
          ...(orderedPageIds
            ? {}
            : { skip: pageInfo.skip, take: pageInfo.take }),
          include: {
            productCategory: { select: { name: true } },
            subcategory: { select: { name: true } },
            castingSupplier: { select: { origin: true } },
            _count: {
              select: {
                documents: { where: submittalDocFilter },
              },
            },
          },
        }),
        listProductTaxonomy(),
        prisma.product.groupBy({
          by: ["categoryId"],
          where: whereWithoutTaxonomy,
          _count: { _all: true },
        }),
        categorySelected
          ? prisma.product.groupBy({
              by: ["subcategoryId"],
              where: { ...whereWithoutTaxonomy, categoryId: categorySelected },
              _count: { _all: true },
            })
          : Promise.resolve(
              [] as { subcategoryId: string | null; _count: { _all: number } }[],
            ),
      ]),
    );

  // `id: { in: ... }` loses the computed order — restore it.
  const products = orderedPageIds
    ? [...fetchedProducts].sort(
        (a, b) => orderedPageIds.indexOf(a.id) - orderedPageIds.indexOf(b.id),
      )
    : fetchedProducts;

  const categoryCountById = new Map(
    categoryGroups.map((group) => [group.categoryId, group._count._all]),
  );
  const categoryChips = taxonomy
    .filter(
      (category) =>
        (categoryCountById.get(category.id) ?? 0) > 0 ||
        category.id === categorySelected,
    )
    .map((category) => ({
      id: category.id,
      name: category.name,
      count: categoryCountById.get(category.id) ?? 0,
    }));

  const selectedCategory = taxonomy.find(
    (category) => category.id === categorySelected,
  );
  const subcategoryCountById = new Map(
    subcategoryGroups.map((group) => [
      group.subcategoryId ?? "none",
      group._count._all,
    ]),
  );
  const subcategoryChips = selectedCategory
    ? [
        ...selectedCategory.subcategories
          .filter(
            (subcategory) =>
              (subcategoryCountById.get(subcategory.id) ?? 0) > 0 ||
              subcategory.id === subcategorySelected,
          )
          .map((subcategory) => ({
            id: subcategory.id,
            name: subcategory.name,
            count: subcategoryCountById.get(subcategory.id) ?? 0,
          })),
        ...((subcategoryCountById.get("none") ?? 0) > 0 &&
        selectedCategory.subcategories.length > 0
          ? [
              {
                id: "none",
                name: "Other",
                count: subcategoryCountById.get("none") ?? 0,
              },
            ]
          : []),
      ]
    : [];

  // All three enrichments depend only on the fetched page of products, not on
  // each other — load them in parallel instead of three sequential waits.
  const partsAssemblyIds = products
    .filter((product) => isPartsModeCastingAssembly(product))
    .map((product) => product.id);
  const [priceMap, derivedMap, effectiveSubmittalCounts] = await Promise.all([
    defaultPriceList
      ? getProductPricesForList(
          products.map((product) => product.id),
          defaultPriceList.id,
        )
      : Promise.resolve(new Map()),
    partsAssemblyIds.length
      ? withDatabaseRetry((client) =>
          loadDerivedAssemblyValues(client, partsAssemblyIds),
        )
      : Promise.resolve(new Map()),
    withDatabaseRetry((client) =>
      loadEffectiveSubmittalCountsByProductId(
        client,
        products.map((product) => product.id),
      ),
    ),
  ]);

  const rows = products.map((product) =>
    mapProductToRow({
      ...enrichProductWithDerivedAssemblyValues(
        product,
        priceMap.get(product.id),
        derivedMap.get(product.id),
      ),
      _count: {
        documents: effectiveSubmittalCounts.get(product.id) ?? product._count.documents,
      },
    }),
  );

  return (
    <DashboardShell
      title="Products"
      subtitle="Manage precast product catalog, pricing, and inventory tracking."
    >
      <ImportFeedbackBanner
        imported={imported}
        updated={updated}
        noun="product"
      />
      <div className="mb-4">
        <CategoryChipBar
          categories={categoryChips}
          subcategories={subcategoryChips}
          selectedCategoryId={categorySelected}
          selectedSubcategoryId={subcategorySelected}
        />
      </div>
      <ProductsList
        products={rows}
        pageInfo={pageInfo}
        filters={{
          search,
          type: typeParam,
          status: statusParam,
          submittals: submittalsParam,
          castingOrigin: castingOriginParam,
        }}
        sort={{ column: sortColumn, direction: sortDirection }}
      />
    </DashboardShell>
  );
}
