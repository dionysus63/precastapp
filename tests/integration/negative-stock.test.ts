import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adjustInventory } from "@/lib/inventory-service";
import { prisma } from "@/lib/prisma";

const tag = `NEGSTOCK-${Date.now()}`;

let productId: string;

beforeAll(async () => {
  const category = await prisma.productCategory.create({
    data: { name: `${tag} Category`, productType: "STOCK_PRECAST" },
  });
  const product = await prisma.product.create({
    data: {
      productCode: `${tag}-P1`,
      name: `${tag} Product`,
      categoryId: category.id,
      trackInventory: true,
      currentStockQuantity: 3,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.inventoryTransaction.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({
    where: { productCode: { startsWith: tag } },
  });
  await prisma.productCategory.deleteMany({
    where: { name: { startsWith: tag } },
  });
});

/**
 * Policy: deliveries may drive stock negative ("deliver anyway, reconcile
 * counts later"); manual adjustments may not. The old DB CHECK constraint
 * contradicted the first half and would have failed delivery completion
 * with a raw constraint error — migration 20260712210000 removed it.
 */
describe("negative stock policy", () => {
  it("the database accepts a negative on-hand quantity (delivery path)", async () => {
    // Regression for the dropped Product_currentStockQuantity_nonneg CHECK:
    // this write is exactly what a short-stock delivery deduction performs.
    await expect(
      prisma.product.update({
        where: { id: productId },
        data: { currentStockQuantity: -5 },
      }),
    ).resolves.toBeTruthy();

    await prisma.product.update({
      where: { id: productId },
      data: { currentStockQuantity: 3 },
    });
  });

  it("manual adjustments still refuse to go below zero", async () => {
    await expect(
      adjustInventory(prisma, {
        productId,
        quantityChange: -10,
        notes: "test shortage",
      }),
    ).rejects.toThrow(/insufficient stock/i);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(product.currentStockQuantity).toBe(3);
  });
});
