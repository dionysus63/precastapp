import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyReceiptToPurchaseOrder } from "@/lib/purchase-order-service";
import { prisma } from "@/lib/prisma";

const tag = `POALLOC-${Date.now()}`;

let vendorId: string;
let productId: string;
let otherProductId: string;
let poSequence = 9920;

async function createPo(lineQuantities: number[], status = "ISSUED" as const) {
  poSequence += 1;
  return prisma.purchaseOrder.create({
    data: {
      poNumber: `${tag}-PO-${poSequence}`,
      sequenceNumber: poSequence,
      vendorId,
      status,
      orderDate: new Date(2026, 6, 1),
      lines: {
        create: lineQuantities.map((quantity, index) => ({
          lineNumber: index + 1,
          sortOrder: index,
          productId,
          itemCode: `${tag}-ITEM`,
          quantityOrdered: quantity,
        })),
      },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
}

async function receivedQuantities(purchaseOrderId: string): Promise<number[]> {
  const lines = await prisma.purchaseOrderLine.findMany({
    where: { purchaseOrderId },
    orderBy: { sortOrder: "asc" },
    select: { quantityReceived: true },
  });
  return lines.map((line) => Number(line.quantityReceived));
}

beforeAll(async () => {
  const vendor = await prisma.vendor.create({
    data: { name: `${tag} Vendor` },
  });
  vendorId = vendor.id;

  const category = await prisma.productCategory.create({
    data: { name: `${tag} Category`, productType: "STOCK_PRECAST" },
  });
  const product = await prisma.product.create({
    data: {
      productCode: `${tag}-P1`,
      name: `${tag} Product`,
      categoryId: category.id,
    },
  });
  productId = product.id;
  const other = await prisma.product.create({
    data: {
      productCode: `${tag}-P2`,
      name: `${tag} Other Product`,
      categoryId: category.id,
    },
  });
  otherProductId = other.id;
});

afterAll(async () => {
  await prisma.purchaseOrderLine.deleteMany({
    where: { purchaseOrder: { poNumber: { startsWith: tag } } },
  });
  await prisma.purchaseOrder.deleteMany({
    where: { poNumber: { startsWith: tag } },
  });
  await prisma.vendor.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.product.deleteMany({
    where: { productCode: { startsWith: tag } },
  });
  await prisma.productCategory.deleteMany({
    where: { name: { startsWith: tag } },
  });
});

describe("applyReceiptToPurchaseOrder", () => {
  it("fills matching lines in order, capped at each line's ordered quantity", async () => {
    const po = await createPo([10, 10]);

    await applyReceiptToPurchaseOrder(prisma, po.id, [
      { productId, quantityReceived: 15 },
    ]);

    expect(await receivedQuantities(po.id)).toEqual([10, 5]);

    const refreshed = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: po.id },
    });
    expect(refreshed.status).toBe("PARTIALLY_RECEIVED");
  });

  it("lands over-receipt on the last matching line, not the first", async () => {
    const po = await createPo([10, 10]);

    await applyReceiptToPurchaseOrder(prisma, po.id, [
      { productId, quantityReceived: 25 },
    ]);

    expect(await receivedQuantities(po.id)).toEqual([10, 15]);

    const refreshed = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: po.id },
    });
    expect(refreshed.status).toBe("RECEIVED");
  });

  it("allocates repeated products within one receipt against fresh remainders", async () => {
    const po = await createPo([10, 10]);

    await applyReceiptToPurchaseOrder(prisma, po.id, [
      { productId, quantityReceived: 8 },
      { productId, quantityReceived: 8 },
    ]);

    expect(await receivedQuantities(po.id)).toEqual([10, 6]);
  });

  it("accumulates across separate receipts", async () => {
    const po = await createPo([10, 10]);

    await applyReceiptToPurchaseOrder(prisma, po.id, [
      { productId, quantityReceived: 15 },
    ]);
    await applyReceiptToPurchaseOrder(prisma, po.id, [
      { productId, quantityReceived: 5 },
    ]);

    expect(await receivedQuantities(po.id)).toEqual([10, 10]);
  });

  it("ignores products that are not on the purchase order", async () => {
    const po = await createPo([10]);

    await applyReceiptToPurchaseOrder(prisma, po.id, [
      { productId: otherProductId, quantityReceived: 5 },
    ]);

    expect(await receivedQuantities(po.id)).toEqual([0]);
  });

  it("refuses to receive against a draft purchase order", async () => {
    const po = await createPo([10], "DRAFT" as never);

    await expect(
      applyReceiptToPurchaseOrder(prisma, po.id, [
        { productId, quantityReceived: 5 },
      ]),
    ).rejects.toThrow(/issue the purchase order/i);
  });
});
