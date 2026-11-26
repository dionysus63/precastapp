import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request: permission
// checks come from the session cookie, revalidatePath/redirect need a request
// store, and createJob would otherwise make real job folders on disk.
// Numbering, transactions and the sequence tables run real.
// A new job records its creator, so the signed-in user must be a real user
// row: filled in beforeAll.
const actor = vi.hoisted(() => ({ id: "", displayName: "Test User" }));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn(async () => actor),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/job-folders", () => ({
  createJobFoldersForJob: vi.fn().mockResolvedValue("C:\\test-job-folders\\job"),
}));

import { createJob } from "@/app/jobs/actions";
import {
  allocatePurchaseOrderNumber,
  formatPurchaseOrderNumber,
  peekNextPurchaseOrderNumber,
  purchaseOrderPrefix,
} from "@/lib/purchase-order-number";
import {
  createPurchaseOrderRecord,
  updatePurchaseOrderRecord,
} from "@/lib/purchase-order-service";
import { prisma } from "@/lib/prisma";

const tag = `NUMBERING-${Date.now()}`;

let vendorId: string;

function expectConsecutive(numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  expect(new Set(sorted).size).toBe(sorted.length);
  expect(sorted[sorted.length - 1]! - sorted[0]!).toBe(sorted.length - 1);
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username: `${tag}-user`.toLowerCase(),
      displayName: `${tag} User`,
      initials: "TU",
      role: "MANAGER",
    },
  });
  actor.id = user.id;
  const vendor = await prisma.vendor.create({
    data: { name: `${tag} Vendor` },
  });
  vendorId = vendor.id;
});

afterAll(async () => {
  await prisma.purchaseOrderLine.deleteMany({
    where: { purchaseOrder: { vendorId } },
  });
  await prisma.purchaseOrder.deleteMany({ where: { vendorId } });
  await prisma.vendor.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.job.deleteMany({
    where: { projectName: { startsWith: tag } },
  });
  await prisma.user.deleteMany({ where: { id: actor.id } });
  await prisma.$disconnect();
});

describe("job number allocation", () => {
  async function createTaggedJob(name: string) {
    const form = new FormData();
    form.set("projectName", `${tag} ${name}`);
    form.set("customerName", `${tag} Customer`);
    const result = await createJob(form);
    // Success redirects (mocked here), so there is no `{ error }`.
    expect(result).toBeUndefined();
    return prisma.job.findFirstOrThrow({
      where: { projectName: `${tag} ${name}` },
    });
  }

  it("allocates sequential yy-NNN numbers for the current year", async () => {
    const first = await createTaggedJob("seq 1");
    const second = await createTaggedJob("seq 2");

    const year = new Date().getFullYear();
    const yy = String(year % 100).padStart(2, "0");
    expect(first.year).toBe(year);
    expect(first.yearTwoDigit).toBe(year % 100);
    expect(first.jobNumber).toBe(
      `${yy}-${String(first.sequenceNumber).padStart(3, "0")}`,
    );
    expect(second.sequenceNumber).toBe(first.sequenceNumber + 1);
    expect(second.jobNumber).toBe(
      `${yy}-${String(first.sequenceNumber + 1).padStart(3, "0")}`,
    );
    expect(first.folderPath).toBe("C:\\test-job-folders\\job");
    // The signed-in user is recorded as the creator ("My Open" tab).
    expect(first.createdById).toBe(actor.id);
  });

  it("never hands out the same number to concurrent creates", async () => {
    const jobs = await Promise.all(
      ["par A", "par B", "par C"].map((name) => createTaggedJob(name)),
    );

    expect(new Set(jobs.map((job) => job.jobNumber)).size).toBe(3);
    expectConsecutive(jobs.map((job) => job.sequenceNumber));
  });
});

describe("purchase order number allocation", () => {
  // A prefix no real vendor name gives (it would need two leading digits).
  const prefixVendor = "90 Numbering Test";

  afterAll(async () => {
    await prisma.purchaseOrderPrefixSequence.deleteMany({
      where: { prefix: { in: ["90", purchaseOrderPrefix(`${tag} Vendor`)] } },
    });
  });

  it("allocates sequential numbers per vendor prefix", async () => {
    const first = await prisma.$transaction((tx) =>
      allocatePurchaseOrderNumber(tx, prefixVendor),
    );
    const second = await prisma.$transaction((tx) =>
      allocatePurchaseOrderNumber(tx, "9-0 Another Vendor"),
    );

    expect(first.prefix).toBe("90");
    expect(first.poNumber).toMatch(/^90-\d{4,}$/);
    expect(first.poNumber).toBe(
      formatPurchaseOrderNumber("90", first.sequenceNumber),
    );
    // Two vendors with the same first two characters share one run.
    expect(second.sequenceNumber).toBe(first.sequenceNumber + 1);
    expect(second.poNumber).toBe(
      formatPurchaseOrderNumber("90", first.sequenceNumber + 1),
    );
    expect(await peekNextPurchaseOrderNumber(prisma, prefixVendor)).toBe(
      formatPurchaseOrderNumber("90", second.sequenceNumber + 1),
    );
  });

  it("gives a number back when the save fails", async () => {
    const before = await peekNextPurchaseOrderNumber(prisma, prefixVendor);
    await expect(
      prisma.$transaction(async (tx) => {
        await allocatePurchaseOrderNumber(tx, prefixVendor);
        throw new Error("save failed");
      }),
    ).rejects.toThrow("save failed");
    expect(await peekNextPurchaseOrderNumber(prisma, prefixVendor)).toBe(before);
  });

  it("never hands out the same number to concurrent purchase orders", async () => {
    const ids = await Promise.all(
      [1, 2, 3, 4].map((index) =>
        prisma.$transaction((tx) =>
          createPurchaseOrderRecord(tx, {
            vendorId,
            orderDate: new Date(2099, 0, 1),
            notes: `${tag} concurrent ${index}`,
            lines: [
              {
                itemCode: `${tag}-ITEM`,
                quantityOrdered: index,
                unitPrice: 10,
              },
            ],
          }),
        ),
      ),
    );

    const orders = await prisma.purchaseOrder.findMany({
      where: { id: { in: ids } },
      select: { poNumber: true, sequenceNumber: true },
    });
    const prefix = purchaseOrderPrefix(`${tag} Vendor`);
    expect(orders).toHaveLength(4);
    expect(new Set(orders.map((order) => order.poNumber)).size).toBe(4);
    for (const order of orders) {
      expect(order.poNumber).toBe(
        formatPurchaseOrderNumber(prefix, order.sequenceNumber),
      );
    }
    expectConsecutive(orders.map((order) => order.sequenceNumber));
  });

  it("renumbers a purchase order only when it moves to a vendor with other letters", async () => {
    const sameLetters = await prisma.vendor.create({
      data: { name: `${tag} Vendor Two` },
    });
    const otherLetters = await prisma.vendor.create({
      data: { name: `9.0 ${tag} Vendor` },
    });
    const lines = [{ itemCode: `${tag}-ITEM`, quantityOrdered: 1, unitPrice: 10 }];
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, {
        vendorId,
        orderDate: new Date(2099, 0, 1),
        lines,
      }),
    );
    const created = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });

    try {
      // Same vendor: the number stays.
      await prisma.$transaction((tx) =>
        updatePurchaseOrderRecord(tx, id, {
          vendorId,
          orderDate: new Date(2099, 0, 2),
          lines,
        }),
      );
      // Another vendor with the same two letters: the number stays.
      await prisma.$transaction((tx) =>
        updatePurchaseOrderRecord(tx, id, {
          vendorId: sameLetters.id,
          orderDate: new Date(2099, 0, 2),
          lines,
        }),
      );
      const kept = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
      expect(kept.poNumber).toBe(created.poNumber);

      // A vendor with other letters: the next number of that prefix.
      const expected = await peekNextPurchaseOrderNumber(prisma, otherLetters.name);
      await prisma.$transaction((tx) =>
        updatePurchaseOrderRecord(tx, id, {
          vendorId: otherLetters.id,
          orderDate: new Date(2099, 0, 2),
          lines,
        }),
      );
      const moved = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
      expect(expected).toMatch(/^90-\d{4,}$/);
      expect(moved.poNumber).toBe(expected);
    } finally {
      await prisma.purchaseOrder.deleteMany({ where: { id } });
      await prisma.vendor.deleteMany({
        where: { id: { in: [sameLetters.id, otherLetters.id] } },
      });
    }
  });

  it("leaves an old style number alone while the vendor stays", async () => {
    const lines = [{ itemCode: `${tag}-ITEM`, quantityOrdered: 1, unitPrice: 10 }];
    const old = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO${String(Date.now()).slice(-8)}`,
        sequenceNumber: 10001,
        vendorId,
        orderDate: new Date(2099, 0, 1),
      },
    });
    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, old.id, {
        vendorId,
        orderDate: new Date(2099, 0, 2),
        lines,
      }),
    );
    const after = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(after.poNumber).toBe(old.poNumber);
  });
});
