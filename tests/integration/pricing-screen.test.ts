import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import { saveDiscountRule, saveListPrices } from "@/app/pricing/actions";
import { writeAuditLog } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  DISCOUNT_GROUP_KEYS,
  discountGroupForProduct,
  type DiscountGroupKey,
} from "@/lib/pricing/discount-groups";
import {
  loadDiscountGroupCounts,
  loadDiscountRateTable,
  loadPricingRows,
  productWhereForDiscountGroup,
} from "@/lib/pricing/pricing-data";

const tag = `PRICING-${Date.now()}`;

let priceListId: string;
let otherPriceListId: string;
let categoryId: string;
let importedSupplierId: string;
let domesticSupplierId: string;
const productIds: Record<string, string> = {};
let originalRules: Awaited<ReturnType<typeof prisma.discountRule.findMany>>;

async function makeProduct(
  key: string,
  productType: string,
  extra: Record<string, unknown> = {},
) {
  const product = await prisma.product.create({
    data: {
      productCode: `${tag}-${key}`,
      name: `${tag} ${key}`,
      productType: productType as never,
      categoryId,
      ...extra,
    },
  });
  productIds[key] = product.id;
}

async function priceOf(key: string, listId = priceListId) {
  return prisma.priceListItem.findUnique({
    where: {
      priceListId_productId: { priceListId: listId, productId: productIds[key] },
    },
  });
}

beforeAll(async () => {
  originalRules = await prisma.discountRule.findMany();
  priceListId = (await prisma.priceList.create({ data: { name: `${tag} list` } })).id;
  otherPriceListId = (await prisma.priceList.create({ data: { name: `${tag} other list` } })).id;
  categoryId = (
    await prisma.productCategory.create({
      data: { name: `${tag} category`, productType: "STOCK_PRECAST" },
    })
  ).id;
  importedSupplierId = (
    await prisma.castingSupplier.create({ data: { name: `${tag} imported`, origin: "IMPORTED" } })
  ).id;
  domesticSupplierId = (
    await prisma.castingSupplier.create({ data: { name: `${tag} domestic`, origin: "DOMESTIC" } })
  ).id;

  await makeProduct("precast-a", "STOCK_PRECAST");
  await makeProduct("precast-b", "STOCK_PRECAST");
  await makeProduct("precast-old", "STOCK_PRECAST", { status: "DISCONTINUED" });
  await makeProduct("iron-imported", "CASTING", { isCasting: true, castingSupplierId: importedSupplierId });
  await makeProduct("iron-domestic", "CASTING", { isCasting: true, castingSupplierId: domesticSupplierId });
  await makeProduct("iron-unknown", "CASTING", { isCasting: true });
  await makeProduct("ads", "ADS_PIPE", { unit: "LF" });
  await makeProduct("rcp", "PRECAST_PIPE", { unit: "LF" });
  await makeProduct("accessory", "ACCESSORY");
  await makeProduct("configurable", "CONFIGURABLE");
  await makeProduct("service", "SERVICE");
});

afterAll(async () => {
  await prisma.priceListItem.deleteMany({
    where: { priceListId: { in: [priceListId, otherPriceListId] } },
  });
  await prisma.product.deleteMany({ where: { productCode: { startsWith: tag } } });
  await prisma.priceList.deleteMany({ where: { id: { in: [priceListId, otherPriceListId] } } });
  await prisma.castingSupplier.deleteMany({
    where: { id: { in: [importedSupplierId, domesticSupplierId] } },
  });
  await prisma.productCategory.delete({ where: { id: categoryId } });
  // Put the discount table back the way the migration (or an earlier test) left it.
  await prisma.discountRule.deleteMany();
  if (originalRules.length > 0) {
    await prisma.discountRule.createMany({ data: originalRules });
  }
});

describe("the discount table the migration fills in", () => {
  it("starts with the company's standing rules", async () => {
    const byGroup = new Map(originalRules.map((rule) => [rule.group, rule]));
    expect(Number(byGroup.get("STOCK_PRECAST")?.deliveredPercent)).toBe(10);
    expect(Number(byGroup.get("STOCK_PRECAST")?.pickupPercent)).toBe(20);
    expect(Number(byGroup.get("CASTING_IMPORTED")?.deliveredPercent)).toBe(10);
    expect(Number(byGroup.get("CASTING_IMPORTED")?.pickupPercent)).toBe(10);
    for (const group of ["CASTING_DOMESTIC", "ADS_PIPE", "RCP_PIPE", "OTHER"] as const) {
      expect(Number(byGroup.get(group)?.deliveredPercent)).toBe(0);
      expect(Number(byGroup.get(group)?.pickupPercent)).toBe(0);
    }
  });
});

describe("which products each price sheet shows", () => {
  it("puts every product on exactly the sheet its discount group names", async () => {
    const mine = await prisma.product.findMany({
      where: { productCode: { startsWith: tag } },
      select: {
        id: true,
        productType: true,
        castingSupplier: { select: { origin: true } },
      },
    });
    for (const product of mine) {
      const expected = discountGroupForProduct({
        productType: product.productType,
        castingOrigin: product.castingSupplier?.origin ?? null,
      });
      const found: DiscountGroupKey[] = [];
      for (const group of DISCOUNT_GROUP_KEYS) {
        const hit = await prisma.product.count({
          where: { id: product.id, ...productWhereForDiscountGroup(group) },
        });
        if (hit > 0) {
          found.push(group);
        }
      }
      expect(found, `${product.productType} landed on ${found.join(", ")}`).toEqual([expected]);
    }
  });

  it("lists active products only, with the price on the chosen list", async () => {
    await saveListPrices(priceListId, [{ productId: productIds["precast-a"], price: "1450" }]);
    await saveListPrices(otherPriceListId, [{ productId: productIds["precast-a"], price: "1500" }]);

    const rows = (await loadPricingRows("STOCK_PRECAST", priceListId)).filter((row) =>
      row.productCode.startsWith(tag),
    );
    expect(rows.map((row) => row.productCode)).toEqual([
      `${tag}-precast-a`,
      `${tag}-precast-b`,
    ]);
    expect(rows[0].listPrice).toBe("1450.00");
    expect(rows[1].listPrice).toBeNull();

    const otherRows = await loadPricingRows("STOCK_PRECAST", otherPriceListId);
    expect(
      otherRows.find((row) => row.id === productIds["precast-a"])?.listPrice,
    ).toBe("1500.00");
  });

  it("marks a casting that has no supplier", async () => {
    const rows = await loadPricingRows("OTHER", priceListId);
    expect(rows.find((row) => row.id === productIds["iron-unknown"])?.castingWithoutSupplier).toBe(true);
    expect(rows.find((row) => row.id === productIds["accessory"])?.castingWithoutSupplier).toBe(false);
  });

  it("counts products and the ones still without a price", async () => {
    const before = await loadDiscountGroupCounts(priceListId);
    await saveListPrices(priceListId, [{ productId: productIds["ads"], price: "14.25" }]);
    const after = await loadDiscountGroupCounts(priceListId);
    expect(after.ADS_PIPE.products).toBe(before.ADS_PIPE.products);
    expect(after.ADS_PIPE.unpriced).toBe(before.ADS_PIPE.unpriced - 1);
  });
});

describe("saveListPrices", () => {
  it("adds, changes and takes off prices in one save", async () => {
    await saveListPrices(priceListId, [
      { productId: productIds["precast-a"], price: "1450" },
      { productId: productIds["precast-b"], price: "618" },
    ]);
    const result = await saveListPrices(priceListId, [
      { productId: productIds["precast-a"], price: "$1,500.50" },
      { productId: productIds["precast-b"], price: "" },
      { productId: productIds["rcp"], price: "38.5" },
    ]);
    expect(result).toEqual({
      saved: [
        { productId: productIds["precast-a"], price: "1500.50" },
        { productId: productIds["precast-b"], price: null },
        { productId: productIds["rcp"], price: "38.50" },
      ],
    });
    expect((await priceOf("precast-a"))?.unitPrice.toFixed(2)).toBe("1500.50");
    expect(await priceOf("precast-b")).toBeNull();
    expect((await priceOf("rcp"))?.unitPrice.toFixed(2)).toBe("38.50");
  });

  it("saves nothing when one price in the batch is bad", async () => {
    await saveListPrices(priceListId, [{ productId: productIds["precast-a"], price: "1450" }]);
    const result = await saveListPrices(priceListId, [
      { productId: productIds["precast-a"], price: "1600" },
      { productId: productIds["accessory"], price: "twelve" },
    ]);
    expect(result).toEqual({ error: "Type a price such as 1450 or 618.50." });
    expect((await priceOf("precast-a"))?.unitPrice.toFixed(2)).toBe("1450.00");
    expect(await priceOf("accessory")).toBeNull();
  });

  it("saves nothing when a product is gone", async () => {
    const result = await saveListPrices(priceListId, [
      { productId: productIds["service"], price: "75" },
      { productId: "no-such-product", price: "10" },
    ]);
    expect(result).toHaveProperty("error");
    expect(await priceOf("service")).toBeNull();
  });

  it("leaves another list and a typed pickup price alone", async () => {
    await saveListPrices(priceListId, [{ productId: productIds["iron-imported"], price: "520" }]);
    await prisma.priceListItem.update({
      where: {
        priceListId_productId: { priceListId, productId: productIds["iron-imported"] },
      },
      data: { pickupPrice: 480 },
    });
    await saveListPrices(otherPriceListId, [{ productId: productIds["iron-imported"], price: "540" }]);
    await saveListPrices(priceListId, [{ productId: productIds["iron-imported"], price: "525" }]);

    const item = await priceOf("iron-imported");
    expect(item?.unitPrice.toFixed(2)).toBe("525.00");
    expect(item?.pickupPrice?.toFixed(2)).toBe("480.00");
    expect((await priceOf("iron-imported", otherPriceListId))?.unitPrice.toFixed(2)).toBe("540.00");
  });

  it("refuses a price list that does not exist", async () => {
    const result = await saveListPrices("no-such-list", [
      { productId: productIds["precast-a"], price: "1" },
    ]);
    expect(result).toEqual({ error: "That price list no longer exists." });
  });

  it("asks for the products permission and writes an audit line", async () => {
    vi.mocked(requirePermission).mockClear();
    vi.mocked(writeAuditLog).mockClear();
    await saveListPrices(priceListId, [{ productId: productIds["precast-a"], price: "1450" }]);
    expect(requirePermission).toHaveBeenCalledWith("PRODUCTS_MANAGE");
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns the refusal when the person may not change prices", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new Error("You don't have permission to do that."),
    );
    const result = await saveListPrices(priceListId, [
      { productId: productIds["precast-a"], price: "9999" },
    ]);
    expect(result).toEqual({ error: "You don't have permission to do that." });
    expect((await priceOf("precast-a"))?.unitPrice.toFixed(2)).toBe("1450.00");
  });
});

describe("saveDiscountRule", () => {
  it("saves both percentages for a group and reads them back", async () => {
    const result = await saveDiscountRule("STOCK_PRECAST", "12.5", "25%");
    expect(result).toEqual({ deliveredPercent: "12.5", pickupPercent: "25" });
    const table = await loadDiscountRateTable();
    expect(table.STOCK_PRECAST).toEqual({ deliveredPercent: 12.5, pickupPercent: 25 });
    await saveDiscountRule("STOCK_PRECAST", "10", "20");
  });

  it("reads blank as no discount", async () => {
    await saveDiscountRule("OTHER", "5", "5");
    expect(await saveDiscountRule("OTHER", "", " ")).toEqual({
      deliveredPercent: "0",
      pickupPercent: "0",
    });
    expect((await loadDiscountRateTable()).OTHER).toEqual({
      deliveredPercent: 0,
      pickupPercent: 0,
    });
  });

  it("treats a group with no row as no discount", async () => {
    await prisma.discountRule.deleteMany({ where: { group: "RCP_PIPE" } });
    expect((await loadDiscountRateTable()).RCP_PIPE).toEqual({
      deliveredPercent: 0,
      pickupPercent: 0,
    });
    // And saving brings the row back.
    await saveDiscountRule("RCP_PIPE", "0", "0");
    expect(await prisma.discountRule.count({ where: { group: "RCP_PIPE" } })).toBe(1);
  });

  it("refuses a bad percentage or an unknown group and changes nothing", async () => {
    const before = await loadDiscountRateTable();
    expect(await saveDiscountRule("STOCK_PRECAST", "110", "20")).toEqual({
      error: "Delivered: A discount cannot be more than 100%.",
    });
    expect(await saveDiscountRule("STOCK_PRECAST", "10", "lots")).toEqual({
      error: "Picked Up: Type a percentage such as 10 or 12.5.",
    });
    expect(await saveDiscountRule("NOT_A_GROUP", "10", "20")).toEqual({
      error: "That discount group does not exist.",
    });
    expect(await loadDiscountRateTable()).toEqual(before);
  });

  it("asks for the settings permission", async () => {
    vi.mocked(requirePermission).mockClear();
    await saveDiscountRule("ADS_PIPE", "0", "0");
    expect(requirePermission).toHaveBeenCalledWith("SETTINGS_MANAGE");
  });
});
