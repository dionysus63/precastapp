import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request: permission
// checks come from the session cookie and revalidatePath needs a request
// store. Everything else (Prisma, transactions, business rules) runs real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
// The products actions pull in server-only modules (the submittals service);
// the guard throws outside a Next server build.
vi.mock("server-only", () => ({}));

import { importProducts } from "@/app/products/actions";
import {
  copyPriceListItems,
  getPriceListCompleteness,
} from "@/lib/price-list-service";
import { prisma } from "@/lib/prisma";

const tag = `BULKIMPORT-${Date.now()}`;
const categoryName = `${tag} category`;

let priceListId: string;
let existingProductId: string;

function importForm(
  rows: Array<{ productCode: string; productName: string; unitPrice: string; weight?: string }>,
) {
  const formData = new FormData();
  formData.set("priceListId", priceListId);
  formData.set("importPreset", "STOCK_PRECAST");
  formData.set(
    "products",
    JSON.stringify(
      rows.map((row) => ({
        productCode: row.productCode,
        productName: row.productName,
        category: categoryName,
        subcategory: "",
        unit: "EA",
        unitPrice: row.unitPrice,
        weight: row.weight ?? "",
        yards: "",
        kindFields: {},
      })),
    ),
  );
  return formData;
}

beforeAll(async () => {
  const category = await prisma.productCategory.create({
    data: { name: categoryName, productType: "STOCK_PRECAST" },
  });
  const priceList = await prisma.priceList.create({
    data: { name: `${tag} list` },
  });
  priceListId = priceList.id;

  const existing = await prisma.product.create({
    data: {
      productCode: `${tag}-EXISTING`,
      name: `${tag} old name`,
      categoryId: category.id,
      description: "Keep this description",
      cost: 50,
      weight: 1200,
      trackInventory: true,
      currentStockQuantity: 12,
      reorderLevel: 3,
      status: "INACTIVE",
      notes: "Keep these notes",
    },
  });
  existingProductId = existing.id;

  await prisma.product.create({
    data: {
      productCode: `${tag}-RING`,
      name: `${tag} drain ring`,
      categoryId: category.id,
      productKind: "DRAIN_RING",
      isDrainRing: true,
    },
  });
});

afterAll(async () => {
  await prisma.priceListItem.deleteMany({
    where: { priceList: { name: { startsWith: tag } } },
  });
  await prisma.priceList.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.product.deleteMany({
    where: { productCode: { startsWith: tag } },
  });
  await prisma.productCategory.deleteMany({ where: { name: categoryName } });
  await prisma.$disconnect();
});

describe("importProducts", () => {
  it("updates catalog fields of an existing product without touching stock or status", async () => {
    const result = await importProducts(
      importForm([
        {
          productCode: `${tag}-EXISTING`,
          productName: `${tag} new name`,
          unitPrice: "275",
        },
        {
          productCode: `${tag}-NEW`,
          productName: `${tag} brand new`,
          unitPrice: "90",
          weight: "300",
        },
      ]),
    );
    expect(result.imported).toBe(1);
    expect(result.updated).toBe(1);

    const updated = await prisma.product.findUniqueOrThrow({
      where: { id: existingProductId },
    });
    expect(updated.name).toBe(`${tag} new name`);
    expect(updated.currentStockQuantity).toBe(12);
    expect(updated.reorderLevel).toBe(3);
    expect(updated.status).toBe("INACTIVE");
    expect(updated.trackInventory).toBe(true);
    expect(updated.notes).toBe("Keep these notes");
    expect(updated.description).toBe("Keep this description");
    expect(Number(updated.cost)).toBe(50);
    // A blank weight cell leaves the stored weight alone.
    expect(Number(updated.weight)).toBe(1200);

    const price = await prisma.priceListItem.findUniqueOrThrow({
      where: {
        priceListId_productId: { priceListId, productId: existingProductId },
      },
    });
    expect(Number(price.unitPrice)).toBe(275);

    const created = await prisma.product.findUniqueOrThrow({
      where: { productCode: `${tag}-NEW` },
    });
    expect(created.status).toBe("ACTIVE");
    expect(Number(created.weight)).toBe(300);
  });

  it("refuses to turn an existing product of another kind into this import's kind", async () => {
    await expect(
      importProducts(
        importForm([
          {
            productCode: `${tag}-RING`,
            productName: `${tag} not a ring`,
            unitPrice: "10",
          },
        ]),
      ),
    ).rejects.toThrow(/different kind of product/i);

    const ring = await prisma.product.findUniqueOrThrow({
      where: { productCode: `${tag}-RING` },
    });
    expect(ring.productKind).toBe("DRAIN_RING");
    expect(ring.name).toBe(`${tag} drain ring`);
  });
});

describe("price list copy and coverage", () => {
  it("copies pickup prices along with delivered prices", async () => {
    await prisma.priceListItem.update({
      where: {
        priceListId_productId: { priceListId, productId: existingProductId },
      },
      data: { pickupPrice: 230 },
    });
    const copy = await prisma.priceList.create({
      data: { name: `${tag} copy` },
    });

    await copyPriceListItems(copy.id, priceListId);

    const copied = await prisma.priceListItem.findUniqueOrThrow({
      where: {
        priceListId_productId: { priceListId: copy.id, productId: existingProductId },
      },
    });
    expect(Number(copied.unitPrice)).toBe(275);
    expect(Number(copied.pickupPrice)).toBe(230);
  });

  it("counts only active products toward a list's coverage", async () => {
    // The list prices the (inactive) existing product and the new active one.
    const completeness = await getPriceListCompleteness(priceListId);
    expect(completeness.listedCount).toBe(1);
  });
});
