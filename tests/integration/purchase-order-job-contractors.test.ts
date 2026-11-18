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
    include: { contractors: { orderBy: { sortOrder: "asc" } } },
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

describe("contractors, job and internal notes on a purchase order", () => {
  it("saves none of them when they are left out", async () => {
    const id = await prisma.$transaction((tx) => createPurchaseOrderRecord(tx, base()));
    const saved = await load(id);
    expect(saved.contractors).toEqual([]);
    expect(saved).toMatchObject({
      contractorNames: null,
      jobId: null,
      jobName: null,
      internalNotes: null,
    });
  });

  it("saves contractors in the order picked, once each, with a job on file", async () => {
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, {
        ...base(),
        internalNotes: "Call before delivery",
        contractorIds: [betaId, alphaId, betaId],
        job: { id: jobId },
      }),
    );
    const saved = await load(id);
    expect(saved.contractors.map((entry) => entry.customerId)).toEqual([betaId, alphaId]);
    expect(saved.contractorNames).toBe(`${tag} Beta Excavating, ${tag} Alpha Paving`);
    expect(saved).toMatchObject({
      jobId,
      jobName: jobLabel,
      internalNotes: "Call before delivery",
    });
  });

  it("keeps them on an edit that does not send them, and changes them on one that does", async () => {
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, {
        ...base(),
        internalNotes: "First note",
        contractorIds: [alphaId],
        job: { id: jobId },
      }),
    );

    await prisma.$transaction((tx) => updatePurchaseOrderRecord(tx, id, base()));
    let saved = await load(id);
    expect(saved.contractors.map((entry) => entry.customerId)).toEqual([alphaId]);
    expect(saved).toMatchObject({ jobId, internalNotes: "First note" });

    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, id, {
        ...base(),
        internalNotes: "",
        contractorIds: [betaId],
        job: { name: "  Yard stock " },
      }),
    );
    saved = await load(id);
    expect(saved.contractors.map((entry) => entry.customerId)).toEqual([betaId]);
    expect(saved).toMatchObject({
      contractorNames: `${tag} Beta Excavating`,
      jobId: null,
      jobName: "Yard stock",
      internalNotes: null,
    });

    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, id, { ...base(), contractorIds: [], job: null }),
    );
    saved = await load(id);
    expect(saved.contractors).toEqual([]);
    expect(saved).toMatchObject({ contractorNames: null, jobId: null, jobName: null });
  });

  it("refuses a contractor or a job that is not on file", async () => {
    await expect(
      prisma.$transaction((tx) =>
        createPurchaseOrderRecord(tx, { ...base(), contractorIds: ["missing"] }),
      ),
    ).rejects.toThrow(/contractor/i);
    await expect(
      prisma.$transaction((tx) =>
        createPurchaseOrderRecord(tx, { ...base(), job: { id: "missing" } }),
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
        job: { id: job.id },
      }),
    );
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    const saved = await load(id);
    expect(saved.contractors).toEqual([]);
    expect(saved.jobId).toBeNull();
    // What was saved with the order still says who and what it was for.
    expect(saved.contractorNames).toBe(`${tag} Gone Inc`);
    expect(saved.jobName).toBe(purchaseOrderJobLabel(job));
  });

  it("is found by the list's contractor and job filters, and sorts by them", async () => {
    await prisma.purchaseOrder.deleteMany({ where: { vendorId } });
    const make = (extra: object) =>
      prisma.$transaction((tx) => createPurchaseOrderRecord(tx, { ...base(), ...extra }));
    const withAlpha = await make({ contractorIds: [alphaId], job: { id: jobId } });
    const withBeta = await make({ contractorIds: [betaId], job: { name: `${tag} yard` } });
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
    expect(await find({ q: `${tag} beta` })).toEqual([withBeta]);
    expect(await find({ q: `${tag} main st` })).toEqual([withAlpha]);
    // Z to A, and the order with neither still comes last.
    expect(await find({}, "contractor")).toEqual([withBeta, withAlpha, bare]);
    expect((await find({}, "job")).at(-1)).toBe(bare);
  });
});
