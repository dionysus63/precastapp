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
vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { updateQuoteStatus } from "@/app/quotes/actions";
import { prisma } from "@/lib/prisma";

const tag = `BIDWIN-${Date.now()}`;

let jobId: string;
let winnerBidderId: string;
let loserBidderId: string;
let winnerQuoteId: string;
let loserQuoteId: string;
let masterQuoteId: string;

beforeAll(async () => {
  const winnerCustomer = await prisma.customer.create({
    data: { name: `${tag} Winner Co` },
  });
  const loserCustomer = await prisma.customer.create({
    data: { name: `${tag} Loser Co` },
  });

  const job = await prisma.job.create({
    data: {
      jobNumber: `${tag}-JOB`,
      year: 2026,
      yearTwoDigit: 26,
      sequenceNumber: 9902,
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

  const quoteFor = (suffix: string, bidderId: string | null, customer: { id: string; name: string } | null) =>
    prisma.quote.create({
      data: {
        quoteNumber: `${tag}-${suffix}`,
        jobId,
        jobBidderId: bidderId,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? "Unassigned",
        projectName: `${tag} project`,
        status: bidderId ? "SENT" : "DRAFT",
      },
    });
  winnerQuoteId = (await quoteFor("Q1", winnerBidder.id, winnerCustomer)).id;
  loserQuoteId = (await quoteFor("Q2", loserBidder.id, loserCustomer)).id;
  masterQuoteId = (await quoteFor("MASTER", null, null)).id;
});

afterAll(async () => {
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.jobBidder.deleteMany({ where: { jobId } });
  await prisma.job.deleteMany({ where: { jobNumber: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("Mark Won on a bidder quote", () => {
  it("records the winning bidder and marks the other contractors Lost-BC", async () => {
    const result = await updateQuoteStatus(winnerQuoteId, "WON");
    expect(result).toEqual({ success: true });

    const [job, winnerQuote, loserQuote, masterQuote, winnerBidder, loserBidder] =
      await Promise.all([
        prisma.job.findUniqueOrThrow({ where: { id: jobId } }),
        prisma.quote.findUniqueOrThrow({ where: { id: winnerQuoteId } }),
        prisma.quote.findUniqueOrThrow({ where: { id: loserQuoteId } }),
        prisma.quote.findUniqueOrThrow({ where: { id: masterQuoteId } }),
        prisma.jobBidder.findUniqueOrThrow({ where: { id: winnerBidderId } }),
        prisma.jobBidder.findUniqueOrThrow({ where: { id: loserBidderId } }),
      ]);

    expect(job.status).toBe("AWARDED");
    expect(winnerQuote.status).toBe("WON");
    expect(loserQuote.status).toBe("LOST_BC");
    expect(masterQuote.status).toBe("DRAFT");
    expect(winnerBidder.isWinner).toBe(true);
    expect(loserBidder.isWinner).toBe(false);
  });

  it("refuses to win a second contractor's quote on the same job", async () => {
    await prisma.quote.update({
      where: { id: loserQuoteId },
      data: { status: "SENT" },
    });

    const result = await updateQuoteStatus(loserQuoteId, "WON");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/already awarded/i);

    const [loserQuote, wonCount, loserBidder] = await Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: loserQuoteId } }),
      prisma.quote.count({ where: { jobId, status: "WON" } }),
      prisma.jobBidder.findUniqueOrThrow({ where: { id: loserBidderId } }),
    ]);
    expect(loserQuote.status).toBe("SENT");
    expect(wonCount).toBe(1);
    expect(loserBidder.isWinner).toBe(false);
  });
});
