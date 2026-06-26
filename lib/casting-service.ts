import type { PrismaClient } from "@/app/generated/prisma/client";
import type { CastingComponentOption } from "@/lib/casting-utils";

type DbClient = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function loadCastingComponentOptionsForAssembly(
  client: DbClient,
  assemblyId: string,
): Promise<CastingComponentOption[]> {
  const rows = await client.productCastingComponent.findMany({
    where: { assemblyId },
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

  return rows.map((row) => ({
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
  }));
}

export async function loadCastingAssembliesWithBom(client: DbClient) {
  return client.product.findMany({
    where: { castingRole: "ASSEMBLY", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      productCode: true,
      name: true,
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

export async function listCastingComponentProducts(client: DbClient) {
  return client.product.findMany({
    where: { castingRole: "COMPONENT", status: "ACTIVE" },
    orderBy: { productCode: "asc" },
    select: {
      id: true,
      productCode: true,
      name: true,
      castingPieceRole: true,
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
