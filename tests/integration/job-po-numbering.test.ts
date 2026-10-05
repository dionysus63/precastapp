import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request: permission
// checks come from the session cookie, revalidatePath/redirect need a request
// store, and createJob would otherwise make real job folders on disk.
// Numbering, transactions and the sequence tables run real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
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
} from "@/lib/purchase-order-number";
import { createPurchaseOrderRecord } from "@/lib/purchase-order-service";
import { prisma } from "@/lib/prisma";

const tag = `NUMBERING-${Date.now()}`;

let vendorId: string;

function expectConsecutive(numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  expect(new Set(sorted).size).toBe(sorted.length);
  expect(sorted[sorted.length - 1]! - sorted[0]!).toBe(sorted.length - 1);
}

beforeAll(async () => {
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
  it("allocates sequential PO numbers from the global counter", async () => {
    const first = await prisma.$transaction((tx) =>
      allocatePurchaseOrderNumber(tx),
    );
    const second = await prisma.$transaction((tx) =>
      allocatePurchaseOrderNumber(tx),
    );

    expect(first.poNumber).toMatch(/^PO\d{5,}$/);
    expect(first.poNumber).toBe(formatPurchaseOrderNumber(first.sequenceNumber));
    expect(second.sequenceNumber).toBe(first.sequenceNumber + 1);
    expect(second.poNumber).toBe(
      formatPurchaseOrderNumber(first.sequenceNumber + 1),
    );
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
    expect(orders).toHaveLength(4);
    expect(new Set(orders.map((order) => order.poNumber)).size).toBe(4);
    for (const order of orders) {
      expect(order.poNumber).toBe(formatPurchaseOrderNumber(order.sequenceNumber));
    }
    expectConsecutive(orders.map((order) => order.sequenceNumber));
  });
});
