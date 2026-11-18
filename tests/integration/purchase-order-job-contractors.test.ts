import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createPurchaseOrderRecord,
  updatePurchaseOrderRecord,
} from "@/lib/purchase-order-service";
import {
  buildPurchaseOrderListOrderBy,
  buildPurchaseOrderListWhere,
  parsePurchaseOrderListFilters,
} from "@/lib/purchase-order-list-search";
import { purchaseOrderJobLabel } from "@/lib/purchase-order-utils";
import { prisma } from "@/lib/prisma";

const tag = `POLINKS-${Date.now()}`;
// Letters no other test or seed vendor uses, so the run of numbers is ours.
const prefix = "Z8";

let vendorId: string;
let alphaId: string;
let betaId: string;
let jobId: string;
let jobLabel: string;

const orderDate = new Date(Date.UTC(2099, 0, 1));
const lines = [{ itemCode: `${tag}-ITEM`, quantityOrdered: 2, unitPrice: 10 }];
const base = () => ({ vendorId, orderDate, lines });

const load = (id: string) =>
  prisma.purchaseOrder.findUniqueOrThrow({
    where: { id },
    include: {
      contractors: { orderBy: { sortOrder: "asc" } },
      jobs: { orderBy: { sortOrder: "asc" }, select: { jobId: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

beforeAll(async () => {
  await prisma.purchaseOrderPrefixSequence.deleteMany({ where: { prefix } });
  const vendor = await prisma.vendor.create({ data: { name: `${prefix} ${tag} Vendor` } });
  vendorId = vendor.id;
  alphaId = (await prisma.customer.create({ data: { name: `${tag} Alpha Paving` } })).id;
  betaId = (await prisma.customer.create({ data: { name: `${tag} Beta Excavating` } })).id;
  const job = await prisma.job.create({
    data: {
      jobNumber: `${tag}-J`,
      year: 2099,
      yearTwoDigit: 99,
      sequenceNumber: 1,
      customerName: `${tag} Alpha Paving`,
      projectName: `${tag} Main St`,
    },
  });
  jobId = job.id;
  jobLabel = purchaseOrderJobLabel(job);
});

afterAll(async () => {
  await prisma.purchaseOrder.deleteMany({ where: { vendorId } });
  await prisma.job.deleteMany({ where: { id: jobId } });
  await prisma.customer.deleteMany({ where: { id: { in: [alphaId, betaId] } } });
  await prisma.vendor.deleteMany({ where: { id: vendorId } });
  await prisma.purchaseOrderPrefixSequence.deleteMany({ where: { prefix } });
  await prisma.$disconnect();
});

describe("contractors, jobs and internal notes on a purchase order", () => {
  it("saves none of them when they are left out", async () => {
    const id = await prisma.$transaction((tx) => createPurchaseOrderRecord(tx, base()));
    const saved = await load(id);
    expect(saved.contractors).toEqual([]);
    expect(saved.jobs).toEqual([]);
    expect(saved).toMatchObject({
      contractorNames: null,
      jobNames: null,
      internalNotes: null,
    });
  });

  it("saves contractors in the order picked, once each, with a job on file", async () => {
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, {
        ...base(),
        internalNotes: "Call before delivery",
        contractorIds: [betaId, alphaId, betaId],
        jobs: [{ id: jobId }],
      }),
    );
    const saved = await load(id);
    expect(saved.contractors.map((entry) => entry.customerId)).toEqual([betaId, alphaId]);
    expect(saved.contractorNames).toBe(`${tag} Beta Excavating, ${tag} Alpha Paving`);
    expect(saved.jobs).toEqual([{ jobId, name: jobLabel }]);
    expect(saved).toMatchObject({
      jobNames: jobLabel,
      internalNotes: "Call before delivery",
    });
  });

  it("saves several jobs in the order picked, on file and typed, once each", async () => {
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, {
        ...base(),
        jobs: [
          { name: " Yard stock " },
          { id: jobId },
          { name: "yard STOCK" },
          { id: jobId },
          { name: "   " },
          { name: "Bridge repair" },
        ],
      }),
    );
    const saved = await load(id);
    expect(saved.jobs).toEqual([
      { jobId: null, name: "Yard stock" },
      { jobId, name: jobLabel },
      { jobId: null, name: "Bridge repair" },
    ]);
    expect(saved.jobNames).toBe(`Yard stock, ${jobLabel}, Bridge repair`);
  });

  it("keeps them on an edit that does not send them, and changes them on one that does", async () => {
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, {
        ...base(),
        internalNotes: "First note",
        contractorIds: [alphaId],
        jobs: [{ id: jobId }],
      }),
    );

    await prisma.$transaction((tx) => updatePurchaseOrderRecord(tx, id, base()));
    let saved = await load(id);
    expect(saved.contractors.map((entry) => entry.customerId)).toEqual([alphaId]);
    expect(saved.jobs).toEqual([{ jobId, name: jobLabel }]);
    expect(saved).toMatchObject({ internalNotes: "First note" });

    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, id, {
        ...base(),
        internalNotes: "",
        contractorIds: [betaId],
        jobs: [{ name: "  Yard stock " }, { id: jobId }],
      }),
    );
    saved = await load(id);
    expect(saved.contractors.map((entry) => entry.customerId)).toEqual([betaId]);
    expect(saved.jobs).toEqual([
      { jobId: null, name: "Yard stock" },
      { jobId, name: jobLabel },
    ]);
    expect(saved).toMatchObject({
      contractorNames: `${tag} Beta Excavating`,
      jobNames: `Yard stock, ${jobLabel}`,
      internalNotes: null,
    });

    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, id, { ...base(), contractorIds: [], jobs: [] }),
    );
    saved = await load(id);
    expect(saved.contractors).toEqual([]);
    expect(saved.jobs).toEqual([]);
    expect(saved).toMatchObject({ contractorNames: null, jobNames: null });
  });

  it("refuses a contractor or a job that is not on file", async () => {
    await expect(
      prisma.$transaction((tx) =>
        createPurchaseOrderRecord(tx, { ...base(), contractorIds: ["missing"] }),
      ),
    ).rejects.toThrow(/contractor/i);
    await expect(
      prisma.$transaction((tx) =>
        createPurchaseOrderRecord(tx, { ...base(), jobs: [{ id: "missing" }] }),
      ),
    ).rejects.toThrow(/job/i);
  });

  it("keeps the order when its customer or job is deleted", async () => {
    const customer = await prisma.customer.create({ data: { name: `${tag} Gone Inc` } });
    const job = await prisma.job.create({
      data: {
        jobNumber: `${tag}-GONE`,
        year: 2099,
        yearTwoDigit: 99,
        sequenceNumber: 2,
        customerName: "Gone",
        projectName: `${tag} Gone project`,
      },
    });
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, {
        ...base(),
        contractorIds: [customer.id],
        jobs: [{ id: job.id }],
      }),
    );
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    const saved = await load(id);
    expect(saved.contractors).toEqual([]);
    // The job stays on the order as a name; what was saved still says who
    // and what it was for.
    expect(saved.jobs).toEqual([{ jobId: null, name: purchaseOrderJobLabel(job) }]);
    expect(saved.contractorNames).toBe(`${tag} Gone Inc`);
    expect(saved.jobNames).toBe(purchaseOrderJobLabel(job));
  });

  it("is found by the list's contractor and job filters, and sorts by them", async () => {
    await prisma.purchaseOrder.deleteMany({ where: { vendorId } });
    const make = (extra: object) =>
      prisma.$transaction((tx) => createPurchaseOrderRecord(tx, { ...base(), ...extra }));
    const withAlpha = await make({ contractorIds: [alphaId], jobs: [{ id: jobId }] });
    const withBeta = await make({
      contractorIds: [betaId],
      jobs: [{ name: `${tag} yard` }, { name: `${tag} second job` }],
    });
    const bare = await make({});

    const find = async (params: Record<string, string>, sortColumn?: "contractor" | "job") => {
      const where = buildPurchaseOrderListWhere(
        parsePurchaseOrderListFilters({ vendor: vendorId, ...params }),
      );
      const rows = await prisma.purchaseOrder.findMany({
        where,
        orderBy: buildPurchaseOrderListOrderBy(
          sortColumn ? { column: sortColumn, direction: "desc" } : null,
        ),
        select: { id: true },
      });
      return rows.map((row) => row.id);
    };

    expect(await find({ contractor: alphaId })).toEqual([withAlpha]);
    expect(await find({ job: `id:${jobId}` })).toEqual([withAlpha]);
    expect(await find({ job: `name:${tag.toLowerCase()} YARD` })).toEqual([withBeta]);
    // The second job of an order finds it too.
    expect(await find({ job: `name:${tag} second job` })).toEqual([withBeta]);
    expect(await find({ q: `${tag} second` })).toEqual([withBeta]);
    expect(await find({ q: `${tag} beta` })).toEqual([withBeta]);
    expect(await find({ q: `${tag} main st` })).toEqual([withAlpha]);
    // Z to A, and the order with neither still comes last.
    expect(await find({}, "contractor")).toEqual([withBeta, withAlpha, bare]);
    expect((await find({}, "job")).at(-1)).toBe(bare);
  });
});

describe("editing a purchase order after deliveries came in", () => {
  it("changes the details and leaves the vendor, the lines and what was received alone", async () => {
    const otherVendor = await prisma.vendor.create({
      data: { name: `${prefix} ${tag} Other Vendor` },
    });
    const id = await prisma.$transaction((tx) => createPurchaseOrderRecord(tx, base()));
    const before = await load(id);
    await prisma.purchaseOrderLine.update({
      where: { id: before.lines[0]!.id },
      data: { quantityReceived: 1 },
    });
    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "PARTIALLY_RECEIVED" },
    });

    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, id, {
        vendorId: otherVendor.id,
        category: "RCP",
        orderDate,
        expectedDate: new Date(Date.UTC(2099, 1, 1)),
        notes: "New note",
        internalNotes: "Office note",
        contractorIds: [alphaId],
        jobs: [{ id: jobId }, { name: "Yard stock" }],
        // Not even read: what is ordered is locked.
        lines: [{ itemCode: "OTHER", quantityOrdered: 0, unitPrice: -5 }],
      }),
    );

    const saved = await load(id);
    expect(saved).toMatchObject({
      status: "PARTIALLY_RECEIVED",
      vendorId,
      category: null,
      poNumber: before.poNumber,
      notes: "New note",
      internalNotes: "Office note",
      contractorNames: `${tag} Alpha Paving`,
      jobNames: `${jobLabel}, Yard stock`,
    });
    expect(saved.expectedDate?.toISOString()).toBe("2099-02-01T00:00:00.000Z");
    expect(saved.total.toNumber()).toBe(before.total.toNumber());
    expect(saved.lines).toHaveLength(1);
    expect(saved.lines[0]).toMatchObject({ id: before.lines[0]!.id, itemCode: `${tag}-ITEM` });
    expect(saved.lines[0]!.quantityReceived.toNumber()).toBe(1);

    await prisma.purchaseOrder.delete({ where: { id } });
    await prisma.vendor.delete({ where: { id: otherVendor.id } });
  });

  it("still changes what is ordered on an issued purchase order", async () => {
    const id = await prisma.$transaction((tx) => createPurchaseOrderRecord(tx, base()));
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "ISSUED" } });
    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, id, {
        ...base(),
        lines: [{ itemCode: `${tag}-NEW`, quantityOrdered: 3, unitPrice: 5 }],
      }),
    );
    const saved = await load(id);
    expect(saved.status).toBe("ISSUED");
    expect(saved.lines.map((line) => line.itemCode)).toEqual([`${tag}-NEW`]);
    expect(saved.total.toNumber()).toBe(15);
  });
});
