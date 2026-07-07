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

import { awardJob } from "@/app/jobs/bid-actions";
import { prisma } from "@/lib/prisma";

const tag = `AWARDTEST-${Date.now()}`;

let jobId: string;
let winnerBidderId: string;
let loserBidderId: string;
let winnerQuoteId: string;
let loserQuoteId: string;
let masterQuoteId: string;
let winnerCustomerId: string;
let loserCustomerId: string;

beforeAll(async () => {
  const winnerCustomer = await prisma.customer.create({
    data: {
      name: `${tag} Winner Co`,
      primaryContactName: "Winner Contact",
      email: "winner@example.com",
      phone: "555-0001",
    },
  });
  const loserCustomer = await prisma.customer.create({
    data: { name: `${tag} Loser Co` },
  });
  winnerCustomerId = winnerCustomer.id;
  loserCustomerId = loserCustomer.id;

  const job = await prisma.job.create({
    data: {
      jobNumber: `${tag}-JOB`,
      year: 2026,
      yearTwoDigit: 26,
      sequenceNumber: 9901,
      customerName: "Unassigned",
      projectName: `${tag} project`,
      status: "QUOTING",
    },
  });
  jobId = job.id;

  const winnerBidder = await prisma.jobBidder.create({
    data: { jobId, customerId: winnerCustomer.id, sortOrder: 0 },
  });
  const loserBidder = await prisma.jobBidder.create({
    data: { jobId, customerId: loserCustomer.id, sortOrder: 1 },
  });
  winnerBidderId = winnerBidder.id;
  loserBidderId = loserBidder.id;

  const winnerQuote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q1`,
      jobId,
      jobBidderId: winnerBidder.id,
      customerId: winnerCustomer.id,
      customerName: winnerCustomer.name,
      projectName: `${tag} project`,
      status: "SENT",
      contactName: "Quote Contact",
      contactEmail: "quotecontact@example.com",
    },
  });
  const loserQuote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q2`,
      jobId,
      jobBidderId: loserBidder.id,
      customerId: loserCustomer.id,
      customerName: loserCustomer.name,
      projectName: `${tag} project`,
      status: "SENT",
    },
  });
  const masterQuote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-MASTER`,
      jobId,
      customerName: "Unassigned",
      projectName: `${tag} project`,
      status: "DRAFT",
    },
  });
  winnerQuoteId = winnerQuote.id;
  loserQuoteId = loserQuote.id;
  masterQuoteId = masterQuote.id;
});

afterAll(async () => {
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.jobBidder.deleteMany({ where: { jobId } });
  await prisma.job.deleteMany({ where: { jobNumber: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("awardJob", () => {
  it("rejects a quote that is not awardable", async () => {
    await prisma.quote.update({
      where: { id: winnerQuoteId },
      data: { status: "CANCELLED" },
    });

    const result = await awardJob(jobId, winnerBidderId, winnerQuoteId);
    expect(result).toEqual({
      error: "This quote cannot be used to award the job.",
    });

    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("QUOTING");
    expect(job.awardedDate).toBeNull();

    await prisma.quote.update({
      where: { id: winnerQuoteId },
      data: { status: "SENT" },
    });
  });

  it("awards the job: winner WON, other bidder quotes LOST_BC", async () => {
    const result = await awardJob(jobId, winnerBidderId, winnerQuoteId);
    expect(result).toEqual({ success: true });

    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("AWARDED");
    expect(job.awardedDate).not.toBeNull();
    expect(job.customerId).toBe(winnerCustomerId);
    expect(job.customerName).toBe(`${tag} Winner Co`);
    // Contact prefers the quote's contact over the customer header
    expect(job.contactName).toBe("Quote Contact");
    expect(job.contactEmail).toBe("quotecontact@example.com");

    const winnerQuote = await prisma.quote.findUniqueOrThrow({
      where: { id: winnerQuoteId },
    });
    const loserQuote = await prisma.quote.findUniqueOrThrow({
      where: { id: loserQuoteId },
    });
    expect(winnerQuote.status).toBe("WON");
    expect(loserQuote.status).toBe("LOST_BC");

    const winnerBidder = await prisma.jobBidder.findUniqueOrThrow({
      where: { id: winnerBidderId },
    });
    const loserBidder = await prisma.jobBidder.findUniqueOrThrow({
      where: { id: loserBidderId },
    });
    expect(winnerBidder.isWinner).toBe(true);
    expect(loserBidder.isWinner).toBe(false);
  });

  it("leaves the master quote (no bidder) untouched", async () => {
    const masterQuote = await prisma.quote.findUniqueOrThrow({
      where: { id: masterQuoteId },
    });
    expect(masterQuote.status).toBe("DRAFT");
  });

  it("refuses to award the same job twice", async () => {
    const result = await awardJob(jobId, loserBidderId, loserQuoteId);
    expect(result).toEqual({ error: "This job has already been awarded." });

    // Loser state unchanged by the failed second award
    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.customerId).toBe(winnerCustomerId);
    const loserQuote = await prisma.quote.findUniqueOrThrow({
      where: { id: loserQuoteId },
    });
    expect(loserQuote.status).toBe("LOST_BC");
  });
});
