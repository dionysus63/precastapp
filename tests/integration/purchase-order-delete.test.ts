import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createPurchaseOrderRecord,
  deletePurchaseOrderRecord,
} from "@/lib/purchase-order-service";
import { prisma } from "@/lib/prisma";

const tag = `PODELETE-${Date.now()}`;
// Letters no other test or seed vendor uses, so the run of numbers is ours.
const prefix = "Z9";

let vendorId: string;

const orderDate = new Date(Date.UTC(2099, 0, 1));
const lines = [{ itemCode: `${tag}-ITEM`, quantityOrdered: 2, unitPrice: 10 }];

const create = () =>
  prisma.$transaction((tx) =>
    createPurchaseOrderRecord(tx, { vendorId, orderDate, lines }),
  );
const remove = (id: string) =>
  prisma.$transaction((tx) => deletePurchaseOrderRecord(tx, id));
const numberOf = async (id: string) =>
  (await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } })).poNumber;

beforeAll(async () => {
  await prisma.purchaseOrderPrefixSequence.deleteMany({ where: { prefix } });
  const vendor = await prisma.vendor.create({
    data: { name: `${prefix} ${tag} Vendor` },
  });
  vendorId = vendor.id;
});

afterAll(async () => {
  await prisma.purchaseReceiptEntry.deleteMany({
    where: { batchLabel: { startsWith: tag } },
  });
  await prisma.purchaseOrder.deleteMany({ where: { vendorId } });
  await prisma.vendor.deleteMany({ where: { id: vendorId } });
  await prisma.purchaseOrderPrefixSequence.deleteMany({ where: { prefix } });
  await prisma.$disconnect();
});

describe("deleting a purchase order", () => {
  it("removes the order and its lines, and gives the newest number back", async () => {
    const first = await create();
    const second = await create();
    expect(await numberOf(first)).toBe("Z9-0001");
    expect(await numberOf(second)).toBe("Z9-0002");

    const deleted = await remove(second);
    expect(deleted).toMatchObject({ poNumber: "Z9-0002", numberReleased: true });
    expect(await prisma.purchaseOrder.findUnique({ where: { id: second } })).toBeNull();
    expect(
      await prisma.purchaseOrderLine.count({ where: { purchaseOrderId: second } }),
    ).toBe(0);

    // The next order takes the number again instead of leaving a gap.
    const again = await create();
    expect(await numberOf(again)).toBe("Z9-0002");
    await remove(again);
    await remove(first);
  });

  it("leaves a gap when a newer number is in use", async () => {
    const older = await create();
    const newer = await create();
    const deleted = await remove(older);
    expect(deleted.numberReleased).toBe(false);
    const next = await create();
    expect(await numberOf(next)).not.toBe(deleted.poNumber);
    expect(await numberOf(next)).not.toBe(await numberOf(newer));
  });

  it("leaves the run of numbers alone for an old style number", async () => {
    const before = await prisma.purchaseOrderPrefixSequence.findUniqueOrThrow({
      where: { prefix },
    });
    const old = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO${tag}`,
        sequenceNumber: before.lastNumber,
        vendorId,
        orderDate,
      },
    });
    expect((await remove(old.id)).numberReleased).toBe(false);
    const after = await prisma.purchaseOrderPrefixSequence.findUniqueOrThrow({
      where: { prefix },
    });
    expect(after.lastNumber).toBe(before.lastNumber);
  });

  it("refuses once a delivery was received against it", async () => {
    const id = await create();
    await prisma.purchaseReceiptEntry.create({
      data: { receiptDate: orderDate, purchaseOrderId: id, batchLabel: `${tag}-R1` },
    });
    await expect(remove(id)).rejects.toThrow("cannot be deleted. Cancel it instead.");
    expect(await prisma.purchaseOrder.findUnique({ where: { id } })).not.toBeNull();
  });

  it("refuses when a line shows a received quantity", async () => {
    const id = await create();
    await prisma.purchaseOrderLine.updateMany({
      where: { purchaseOrderId: id },
      data: { quantityReceived: 1 },
    });
    await expect(remove(id)).rejects.toThrow("cannot be deleted");
  });

  it("says so when the order is already gone", async () => {
    await expect(remove("no-such-id")).rejects.toThrow("Purchase order not found.");
  });
});
