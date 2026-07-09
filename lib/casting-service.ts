import type { PrismaClient } from "@/app/generated/prisma/client";
import type { CastingComponentOption } from "@/lib/casting-utils";

type DbClient = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type DerivedAssemblyValues = {
  derivedWeight: number | null;
  derivedCost: number | null;
};

/**
 * Parts-mode assemblies (not one-piece units) fall back to their BOM for
 * weight and cost when their own field is blank or 0. Price never derives
 * from parts — it is always the assembly's own entered price.
 */
export function isPartsModeCastingAssembly(product: {
  castingRole?: string | null;
  castingSoldAsUnit?: boolean;
}): boolean {
  return product.castingRole === "ASSEMBLY" && !product.castingSoldAsUnit;
}

function isBlankOrZero(value: { toString(): string } | null | undefined): boolean {
  return value == null || Number(value.toString()) === 0;
}

function sumBomQuantityField(
  rows: Array<{ quantity: number; value: number | null }>,
  options?: { treatMissingAsZero?: boolean },
): number | null {
  if (rows.length === 0) {
    return options?.treatMissingAsZero ? 0 : null;
  }
  let sum = 0;
  for (const row of rows) {
    if (row.value == null) {
      if (!options?.treatMissingAsZero) {
        return null;
      }
    }
    sum += row.quantity * (row.value ?? 0);
  }
  return sum;
}

/** Batched live BOM weight/cost totals for parts-mode assemblies. */
export async function loadDerivedAssemblyValues(
  client: DbClient,
  assemblyIds: string[],
): Promise<Map<string, DerivedAssemblyValues>> {
  const result = new Map<string, DerivedAssemblyValues>();
  if (assemblyIds.length === 0) {
    return result;
  }

  const assemblies = await client.product.findMany({
    where: { id: { in: assemblyIds } },
    select: {
      id: true,
      castingRole: true,
      castingSoldAsUnit: true,
    },
  });

  const partsModeIds = assemblies
    .filter((assembly) => isPartsModeCastingAssembly(assembly))
    .map((assembly) => assembly.id);

  if (partsModeIds.length === 0) {
    return result;
  }

  const bomRows = await client.productCastingComponent.findMany({
    where: { assemblyId: { in: partsModeIds } },
    select: {
      assemblyId: true,
      quantity: true,
      component: {
        select: {
          weight: true,
          cost: true,
        },
      },
    },
  });

  const rowsByAssembly = new Map<
    string,
    Array<{
      quantity: number;
      weight: number | null;
      cost: number | null;
    }>
  >();

  for (const row of bomRows) {
    const componentRows = rowsByAssembly.get(row.assemblyId) ?? [];
    componentRows.push({
      quantity: row.quantity,
      weight: row.component.weight != null ? Number(row.component.weight) : null,
      cost: row.component.cost != null ? Number(row.component.cost) : null,
    });
    rowsByAssembly.set(row.assemblyId, componentRows);
  }

  for (const assemblyId of partsModeIds) {
    const componentRows = rowsByAssembly.get(assemblyId) ?? [];
    result.set(assemblyId, {
      derivedWeight: sumBomQuantityField(
        componentRows.map((row) => ({ quantity: row.quantity, value: row.weight })),
        { treatMissingAsZero: true },
      ),
      derivedCost: sumBomQuantityField(
        componentRows.map((row) => ({ quantity: row.quantity, value: row.cost })),
      ),
    });
  }

  return result;
}

/**
 * Parts-mode assembly weight: the assembly's own weight wins; blank or 0
 * falls back to the combined parts weight.
 */
export function resolveEffectiveAssemblyWeight(
  product: {
    weight?: { toString(): string } | null;
    castingRole?: string | null;
    castingSoldAsUnit?: boolean;
  },
  derived?: DerivedAssemblyValues | null,
): number | null {
  if (isPartsModeCastingAssembly(product) && isBlankOrZero(product.weight)) {
    return derived?.derivedWeight ?? 0;
  }
  if (product.weight != null) {
    return Number(product.weight);
  }
  return null;
}

export function enrichProductWithDerivedAssemblyValues<
  T extends {
    id: string;
    weight?: { toString(): string } | null;
    cost?: { toString(): string } | null;
    castingRole?: string | null;
    castingSoldAsUnit?: boolean;
  },
>(
  product: T,
  storedUnitPrice: { toString(): string } | null | undefined,
  derived?: DerivedAssemblyValues | null,
): T & {
  unitPrice: { toString(): string } | null;
  weight: { toString(): string } | null;
  cost: { toString(): string } | null;
  weightDerivedFromParts: boolean;
} {
  const partsMode = isPartsModeCastingAssembly(product);
  const weightFromParts = partsMode && isBlankOrZero(product.weight);
  const costFromParts = partsMode && isBlankOrZero(product.cost);

  return {
    ...product,
    unitPrice: storedUnitPrice ?? null,
    weight: weightFromParts
      ? { toString: () => String(derived?.derivedWeight ?? 0) }
      : (product.weight ?? null),
    cost: costFromParts
      ? derived?.derivedCost != null
        ? { toString: () => String(derived.derivedCost) }
        : null
      : (product.cost ?? null),
    weightDerivedFromParts: weightFromParts,
  };
}

export async function loadCastingComponentOptionsForAssembly(
  client: DbClient,
  assemblyId: string,
): Promise<CastingComponentOption[]> {
  const byAssembly = await loadCastingComponentOptionsByAssembly(client, [
    assemblyId,
  ]);
  return byAssembly.get(assemblyId) ?? [];
}

/** Batched BOM lookup: one query for any number of assemblies. */
export async function loadCastingComponentOptionsByAssembly(
  client: DbClient,
  assemblyIds: string[],
): Promise<Map<string, CastingComponentOption[]>> {
  const result = new Map<string, CastingComponentOption[]>();
  if (assemblyIds.length === 0) {
    return result;
  }

  const rows = await client.productCastingComponent.findMany({
    where: { assemblyId: { in: assemblyIds } },
    orderBy: [{ sortOrder: "asc" }, { pieceRole: "asc" }],
    include: {
      component: {
        select: {
          id: true,
          productCode: true,
          name: true,
          weight: true,
          currentStockQuantity: true,
          trackInventory: true,
        },
      },
    },
  });

  for (const row of rows) {
    const option: CastingComponentOption = {
      productId: row.component.id,
      productCode: row.component.productCode,
      name: row.component.name,
      pieceRole: row.pieceRole,
      quantity: row.quantity,
      weightEach: row.component.weight ? Number(row.component.weight) : null,
      currentStock: row.component.trackInventory
        ? row.component.currentStockQuantity
        : null,
      trackInventory: row.component.trackInventory,
    };
    const options = result.get(row.assemblyId) ?? [];
    options.push(option);
    result.set(row.assemblyId, options);
  }

  return result;
}

export async function loadCastingAssembliesWithBom(client: DbClient) {
  return client.product.findMany({
    where: {
      castingRole: "ASSEMBLY",
      castingSoldAsUnit: false,
      status: "ACTIVE",
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      productCode: true,
      name: true,
      manufacturerCode: true,
      castingSupplierId: true,
      castingAssemblyComponents: {
        orderBy: [{ sortOrder: "asc" }, { pieceRole: "asc" }],
        select: {
          pieceRole: true,
          quantity: true,
          component: {
            select: {
              id: true,
              productCode: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

export async function listCastingComponentProducts(
  client: DbClient,
  priceListId?: string | null,
) {
  return client.product.findMany({
    where: { castingRole: "COMPONENT", status: "ACTIVE" },
    orderBy: { productCode: "asc" },
    select: {
      id: true,
      productCode: true,
      name: true,
      castingPieceRole: true,
      weight: true,
      priceListItems: priceListId
        ? {
            where: { priceListId },
            select: { unitPrice: true },
            take: 1,
          }
        : false,
    },
  });
}

export async function listActiveCastingSuppliers(client: DbClient) {
  return client.castingSupplier.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, origin: true },
  });
}

export function mapCastingComponentsForForm(
  components: Awaited<ReturnType<typeof listCastingComponentProducts>>,
) {
  return components.map((component) => ({
    id: component.id,
    productCode: component.productCode,
    name: component.name,
    castingPieceRole: component.castingPieceRole,
    weight: component.weight != null ? Number(component.weight) : null,
    unitPrice:
      Array.isArray(component.priceListItems) &&
      component.priceListItems[0]?.unitPrice != null
        ? Number(component.priceListItems[0].unitPrice)
        : null,
  }));
}

export function formatCastingReceiptLabel(product: {
  productCode: string;
  name: string;
  manufacturerCode?: string | null;
}) {
  const manufacturerCode = product.manufacturerCode?.trim();
  if (manufacturerCode) {
    return `${manufacturerCode} (ours: ${product.productCode}) — ${product.name}`;
  }
  return `${product.productCode} — ${product.name}`;
}
