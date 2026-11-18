import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request (see
// job-action-errors.test.ts). The save and the sheet lookups run real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { updateJobNysdotContractNumberAction } from "@/app/jobs/actions";
import { drillSheetDetailInclude } from "@/lib/drill-sheet-detail";
import { prisma } from "@/lib/prisma";
import { rectSheetDetailInclude } from "@/lib/rect-sheet-detail";
import { sheetPinContractNumber } from "@/lib/sheet-pin-contract";

// The NYSDOT contract number is typed once on the job page, and every drill
// sheet of that job prints it: read through the sheet's job (or, for a sheet
// that only hangs off a quote, through that quote's job) when its PDF is made.

const tag = `NYSDOT-${Date.now()}`;
const YEAR = 2096;

let jobId: string;
let quoteId: string;
let jobSheetId: string;
let quoteSheetId: string;

beforeAll(async () => {
  const sequenceNumber = Math.floor(Math.random() * 900000) + 1000;
  const job = await prisma.job.create({
    data: {
      jobNumber: `${tag}-JOB`,
      year: YEAR,
      yearTwoDigit: YEAR % 100,
      sequenceNumber,
      customerName: `${tag} Paving`,
      projectName: `${tag} Route 25 Drainage`,
    },
  });
  jobId = job.id;
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q`,
      jobId,
      customerName: job.customerName,
      projectName: job.projectName,
    },
  });
  quoteId = quote.id;
  const onJob = await prisma.jobStructure.create({
    data: { jobId, structureType: "CUSTOM_STRUCTURE", structureNumber: "CB-1" },
  });
  jobSheetId = onJob.id;
  const onQuote = await prisma.jobStructure.create({
    data: { quoteId, structureType: "CUSTOM_STRUCTURE", structureNumber: "CB-2" },
  });
  quoteSheetId = onQuote.id;
});

afterAll(async () => {
  await prisma.jobStructure.deleteMany({
    where: { id: { in: [jobSheetId, quoteSheetId].filter(Boolean) } },
  });
  if (quoteId) {
    await prisma.quote.deleteMany({ where: { id: quoteId } });
  }
  if (jobId) {
    await prisma.job.deleteMany({ where: { id: jobId } });
  }
});

async function savedNumber() {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    select: { nysdotContractNumber: true },
  });
  return job.nysdotContractNumber;
}

describe("NYSDOT contract number on a job", () => {
  it("starts blank, so sheets of other jobs print nothing", async () => {
    expect(await savedNumber()).toBeNull();
    const sheet = await prisma.jobStructure.findUniqueOrThrow({
      where: { id: jobSheetId },
      include: rectSheetDetailInclude,
    });
    expect(sheetPinContractNumber(sheet)).toBe("");
  });

  it("saves the number typed on the job page, trimmed", async () => {
    await expect(
      updateJobNysdotContractNumberAction(jobId, "  D265123  "),
    ).resolves.toBeUndefined();
    expect(await savedNumber()).toBe("D265123");
  });

  it("reaches a rectangular and a round sheet on the job", async () => {
    const rect = await prisma.jobStructure.findUniqueOrThrow({
      where: { id: jobSheetId },
      include: rectSheetDetailInclude,
    });
    expect(sheetPinContractNumber(rect)).toBe("D265123");

    const round = await prisma.jobStructure.findUniqueOrThrow({
      where: { id: jobSheetId },
      include: drillSheetDetailInclude,
    });
    expect(sheetPinContractNumber(round)).toBe("D265123");
  });

  it("reaches a sheet that only hangs off the job's quote", async () => {
    const sheet = await prisma.jobStructure.findUniqueOrThrow({
      where: { id: quoteSheetId },
      include: rectSheetDetailInclude,
    });
    expect(sheet.jobId).toBeNull();
    expect(sheetPinContractNumber(sheet)).toBe("D265123");
  });

  it("refuses a number that is too long and keeps the saved one", async () => {
    await expect(
      updateJobNysdotContractNumberAction(jobId, "X".repeat(61)),
    ).resolves.toEqual({
      error: "NYSDOT contract number must be 60 characters or fewer.",
    });
    expect(await savedNumber()).toBe("D265123");
  });

  it("clears the number when it is saved blank", async () => {
    await expect(
      updateJobNysdotContractNumberAction(jobId, "   "),
    ).resolves.toBeUndefined();
    expect(await savedNumber()).toBeNull();
  });

  it("reports a job that is gone instead of throwing", async () => {
    await expect(
      updateJobNysdotContractNumberAction(`${tag}-missing`, "D265123"),
    ).resolves.toEqual({ error: expect.stringMatching(/not found/i) });
  });
});
