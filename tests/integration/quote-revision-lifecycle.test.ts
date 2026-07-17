import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  deleteQuote,
  updateQuote,
  updateQuoteStatus,
  type CreateQuoteInput,
} from "@/app/quotes/actions";
import { getJobProgress } from "@/lib/job-progress";
import { linkJobStructuresFromQuoteInTransaction } from "@/lib/job-structure-workflow";
import { prisma } from "@/lib/prisma";
import { mapQuoteToDetailView } from "@/lib/quote-mapper";
import {
  lockQuoteForUpdate,
  reviseQuoteInTransaction,
  supersedeOtherWonQuotesInFamily,
} from "@/lib/quote-revision";

const suiteTag = `REVISION-LIFECYCLE-${Date.now()}`;
let fixtureCounter = 0;

type Fixture = {
  jobId: string;
  sourceQuoteId: string;
  sourceQuoteNumber: string;
  sourceLineId: string;
  jobStructureId: string;
};

let fixture: Fixture;

async function createWonQuoteFixture(): Promise<Fixture> {
  fixtureCounter += 1;
  const suffix = `${suiteTag}-${fixtureCounter}`;
  const sequenceNumber = Number(String(Date.now()).slice(-8)) + fixtureCounter;
  const job = await prisma.job.create({
    data: {
      jobNumber: `${suffix}-JOB`,
      year: 2099,
      yearTwoDigit: 99,
      sequenceNumber,
      customerName: `${suffix} Customer`,
      projectName: `${suffix} Project`,
      status: "AWARDED",
      awardedDate: new Date(),
    },
  });
  const sourceQuoteNumber = `${suffix}-Q`;
  const source = await prisma.quote.create({
    data: {
      quoteNumber: sourceQuoteNumber,
      jobId: job.id,
      jobNumber: job.jobNumber,
      customerName: job.customerName,
      projectName: job.projectName,
      status: "WON",
      subtotal: 1200,
      total: 1200,
      lineItems: {
        create: {
          lineNumber: 1,
          lineType: "CUSTOM_STRUCTURE",
          itemCode: "MH-1",
          description: "Custom manhole",
          quantity: 1,
          unit: "EA",
          unitPrice: 1200,
          taxable: false,
          total: 1200,
        },
      },
    },
    include: { lineItems: true },
  });

  await prisma.$transaction((tx) =>
    linkJobStructuresFromQuoteInTransaction(tx, source.id),
  );
  const sourceLine = await prisma.quoteLineItem.findFirstOrThrow({
    where: { quoteId: source.id },
    select: { id: true, jobStructureId: true },
  });
  if (!sourceLine.jobStructureId) {
    throw new Error("Fixture structure was not linked to the won quote.");
  }

  return {
    jobId: job.id,
    sourceQuoteId: source.id,
    sourceQuoteNumber,
    sourceLineId: sourceLine.id,
    jobStructureId: sourceLine.jobStructureId,
  };
}

async function createDraftRevision(): Promise<string> {
  return prisma.$transaction((tx) =>
    reviseQuoteInTransaction(tx, fixture.sourceQuoteId),
  );
}

async function buildUpdateInput(
  quoteId: string,
  status: CreateQuoteInput["status"],
  lineTypeOverride?: CreateQuoteInput["lineItems"][number]["lineType"],
): Promise<CreateQuoteInput> {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { lineItems: { orderBy: { lineNumber: "asc" } } },
  });

  return {
    customerId: quote.customerId,
    customerName: quote.customerName,
    jobId: quote.jobId,
    jobBidderId: quote.jobBidderId,
    jobNumber: quote.jobNumber,
    projectName: quote.projectName,
    scopeLabel: quote.scopeLabel,
    projectAddress: quote.projectAddress,
    contactName: quote.contactName,
    contactEmail: quote.contactEmail,
    contactPhone: quote.contactPhone,
    contactId: quote.contactId,
    contactTitle: quote.contactTitle,
    status,
    quoteType: quote.quoteType,
    estimator: quote.estimator,
    quoteDate: null,
    bidDueDate: null,
    expirationDate: null,
    priceListId: quote.priceListId,
    customerPO: quote.customerPO,
    taxRate: Number(quote.taxRate),
    internalNotes: quote.internalNotes,
    customerNotes: quote.customerNotes,
    termsAndConditions: quote.termsAndConditions,
    fob: quote.fob,
    leadTime: quote.leadTime,
    deliveryNotes: quote.deliveryNotes,
    expectedUpdatedAt: quote.updatedAt.toISOString(),
    lineItems: quote.lineItems.map((line) => ({
      existingLineItemId: line.id,
      lineNumber: line.lineNumber,
      lineType: lineTypeOverride ?? line.lineType,
      productId: line.productId,
      itemCode: line.itemCode,
      description: line.description ?? "",
      quantity: Number(line.quantity),
      unit: line.unit,
      unitPrice: Number(line.unitPrice),
      weight: line.weight == null ? null : Number(line.weight),
      yards: line.yards == null ? null : Number(line.yards),
      taxable: line.taxable,
      total: Number(line.total),
      statusNote: line.statusNote,
      notes: line.notes,
      isDrainRing: line.isDrainRing,
      ringDiameterFeet:
        line.ringDiameterFeet == null ? null : Number(line.ringDiameterFeet),
      poolHeightFeet:
        line.poolHeightFeet == null ? null : Number(line.poolHeightFeet),
      drainRingStyle: line.drainRingStyle,
      structureConfigJson:
        line.structureConfigJson == null
          ? null
          : (line.structureConfigJson as Record<string, unknown>),
    })),
    totals: {
      subtotal: Number(quote.subtotal),
      discount: Number(quote.discountAmount),
      delivery: Number(quote.deliveryAmount),
      taxableAmount: Number(quote.taxableAmount),
      salesTax: Number(quote.salesTax),
      total: Number(quote.total),
      totalWeight: Number(quote.totalWeight),
      totalYards: Number(quote.totalYards),
    },
  };
}

beforeEach(async () => {
  fixture = await createWonQuoteFixture();
});

afterEach(async () => {
  const jobs = await prisma.job.findMany({
    where: { jobNumber: { startsWith: suiteTag } },
    select: { id: true },
  });
  const jobIds = jobs.map((job) => job.id);
  if (jobIds.length === 0) {
    return;
  }
  await prisma.jobStructure.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.quote.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("won quote revision lifecycle", () => {
  it("keeps the source won and operational while its replacement is a draft", async () => {
    const revisionId = await createDraftRevision();

    const [source, revision, structure, progress, revisionFamily] = await Promise.all([
      prisma.quote.findUniqueOrThrow({
        where: { id: fixture.sourceQuoteId },
        include: { lineItems: true, jobStructures: true },
      }),
      prisma.quote.findUniqueOrThrow({ where: { id: revisionId } }),
      prisma.jobStructure.findUniqueOrThrow({
        where: { id: fixture.jobStructureId },
      }),
      getJobProgress(prisma, fixture.jobId),
      prisma.quote.findMany({
        where: {
          OR: [
            { id: fixture.sourceQuoteId },
            { originalQuoteId: fixture.sourceQuoteId },
          ],
        },
        select: {
          id: true,
          quoteNumber: true,
          revisionNumber: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    const sourceDetail = mapQuoteToDetailView({ ...source, revisionFamily });

    expect(source.status).toBe("WON");
    expect(revision.status).toBe("DRAFT");
    expect(structure.quoteId).toBe(fixture.sourceQuoteId);
    expect(progress.quoteId).toBe(fixture.sourceQuoteId);
    expect(progress.quoteNumber).toBe(fixture.sourceQuoteNumber);
    expect(sourceDetail.canRevise).toBe(false);
    expect(sourceDetail.supersededBy?.id).toBe(revisionId);

    await expect(createDraftRevision()).rejects.toThrow(/already revised/i);
  });

  it("stores plain text when linking structures from rich-text quote lines", async () => {
    // Quote line descriptions are rich text (HTML-escaped, <br> line breaks);
    // the linked structure's description must be plain text — it shows on
    // the production board, tickets, and submittals verbatim.
    const job = await prisma.job.findUniqueOrThrow({
      where: { id: fixture.jobId },
    });
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `${fixture.sourceQuoteNumber}-RICH`,
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerName: job.customerName,
        projectName: job.projectName,
        status: "WON",
        subtotal: 500,
        total: 500,
        lineItems: {
          create: {
            lineNumber: 1,
            lineType: "CUSTOM_STRUCTURE",
            itemCode: "GT-1",
            description:
              "8' Mono Grease Trap w/ (2) 6&quot; Boots<br><b>lead-lined</b>",
            quantity: 1,
            unit: "EA",
            unitPrice: 500,
            taxable: false,
            total: 500,
          },
        },
      },
    });

    await prisma.$transaction((tx) =>
      linkJobStructuresFromQuoteInTransaction(tx, quote.id),
    );

    const line = await prisma.quoteLineItem.findFirstOrThrow({
      where: { quoteId: quote.id },
      select: { jobStructureId: true },
    });
    const structure = await prisma.jobStructure.findUniqueOrThrow({
      where: { id: line.jobStructureId! },
    });
    expect(structure.description).toBe(
      "8' Mono Grease Trap w/ (2) 6\" Boots\nlead-lined",
    );
  });

  it("serializes concurrent attempts to revise the same won quote", async () => {
    const results = await Promise.allSettled([
      createDraftRevision(),
      createDraftRevision(),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0].reason)).toMatch(/already revised/i);
    expect(
      await prisma.quote.count({
        where: {
          OR: [
            { id: fixture.sourceQuoteId },
            { originalQuoteId: fixture.sourceQuoteId },
          ],
        },
      }),
    ).toBe(2);
    expect(
      await prisma.quote.findUniqueOrThrow({
        where: { id: fixture.sourceQuoteId },
        select: { status: true },
      }),
    ).toEqual({ status: "WON" });
  });

  it("hands won status and the existing structure to the replacement atomically", async () => {
    const revisionId = await createDraftRevision();

    const result = await updateQuoteStatus(revisionId, "WON");
    expect(result).toEqual({ success: true });

    const [source, revision, sourceLine, revisionLine, structure, wonCount, progress] =
      await Promise.all([
        prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
        prisma.quote.findUniqueOrThrow({ where: { id: revisionId } }),
        prisma.quoteLineItem.findUniqueOrThrow({
          where: { id: fixture.sourceLineId },
        }),
        prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId: revisionId } }),
        prisma.jobStructure.findUniqueOrThrow({
          where: { id: fixture.jobStructureId },
        }),
        prisma.quote.count({ where: { jobId: fixture.jobId, status: "WON" } }),
        getJobProgress(prisma, fixture.jobId),
      ]);

    expect(source.status).toBe("REVISED");
    expect(revision.status).toBe("WON");
    expect(wonCount).toBe(1);
    expect(sourceLine.jobStructureId).toBeNull();
    expect(revisionLine.jobStructureId).toBe(fixture.jobStructureId);
    expect(structure.quoteId).toBe(revisionId);
    expect(progress.quoteId).toBe(revisionId);
  });

  it("hands the structure to a second-generation replacement through its full lineage", async () => {
    const firstRevisionId = await createDraftRevision();
    await prisma.quote.update({
      where: { id: firstRevisionId },
      data: { status: "SENT" },
    });
    const secondRevisionId = await prisma.$transaction((tx) =>
      reviseQuoteInTransaction(tx, firstRevisionId),
    );

    const result = await updateQuoteStatus(secondRevisionId, "WON");
    expect(result).toEqual({ success: true });

    const [source, firstRevision, secondRevision, sourceLine, firstLine, secondLine, structure] =
      await Promise.all([
        prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
        prisma.quote.findUniqueOrThrow({ where: { id: firstRevisionId } }),
        prisma.quote.findUniqueOrThrow({ where: { id: secondRevisionId } }),
        prisma.quoteLineItem.findUniqueOrThrow({ where: { id: fixture.sourceLineId } }),
        prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId: firstRevisionId } }),
        prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId: secondRevisionId } }),
        prisma.jobStructure.findUniqueOrThrow({ where: { id: fixture.jobStructureId } }),
      ]);

    expect(source.status).toBe("REVISED");
    expect(firstRevision.status).toBe("REVISED");
    expect(secondRevision.status).toBe("WON");
    expect(sourceLine.jobStructureId).toBeNull();
    expect(firstLine.jobStructureId).toBeNull();
    expect(secondLine.jobStructureId).toBe(fixture.jobStructureId);
    expect(structure.quoteId).toBe(secondRevisionId);
  });

  it("uses the same handoff when the full edit form saves the revision as won", async () => {
    const revisionId = await createDraftRevision();
    const input = await buildUpdateInput(revisionId, "WON");

    await updateQuote(revisionId, input);

    const [source, savedRevision, sourceLine, revisionLine, structure, wonCount] =
      await Promise.all([
        prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
        prisma.quote.findUniqueOrThrow({ where: { id: revisionId } }),
        prisma.quoteLineItem.findUniqueOrThrow({
          where: { id: fixture.sourceLineId },
        }),
        prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId: revisionId } }),
        prisma.jobStructure.findUniqueOrThrow({
          where: { id: fixture.jobStructureId },
        }),
        prisma.quote.count({ where: { jobId: fixture.jobId, status: "WON" } }),
      ]);

    expect(source.status).toBe("REVISED");
    expect(savedRevision.status).toBe("WON");
    expect(wonCount).toBe(1);
    expect(sourceLine.jobStructureId).toBeNull();
    expect(revisionLine.jobStructureId).toBe(fixture.jobStructureId);
    expect(structure.quoteId).toBe(revisionId);
  });

  it("rejects a handoff when the revision was detached from the awarded job", async () => {
    const revisionId = await createDraftRevision();
    await prisma.quote.update({
      where: { id: revisionId },
      data: { jobId: null },
    });

    const result = await updateQuoteStatus(revisionId, "WON");
    expect(result.error).toMatch(/same job/i);

    const [source, revision, structure] = await Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
      prisma.quote.findUniqueOrThrow({ where: { id: revisionId } }),
      prisma.jobStructure.findUniqueOrThrow({
        where: { id: fixture.jobStructureId },
      }),
    ]);
    expect(source.status).toBe("WON");
    expect(revision.status).toBe("DRAFT");
    expect(structure.quoteId).toBe(fixture.sourceQuoteId);
  });

  it("rejects a handoff that drops a structure already linked to production", async () => {
    const revisionId = await createDraftRevision();
    await prisma.quoteLineItem.deleteMany({ where: { quoteId: revisionId } });

    const result = await updateQuoteStatus(revisionId, "WON");
    expect(result.error).toMatch(/removes one or more structures/i);

    const [source, revision, sourceLine, structure] = await Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
      prisma.quote.findUniqueOrThrow({ where: { id: revisionId } }),
      prisma.quoteLineItem.findUniqueOrThrow({
        where: { id: fixture.sourceLineId },
      }),
      prisma.jobStructure.findUniqueOrThrow({
        where: { id: fixture.jobStructureId },
      }),
    ]);
    expect(source.status).toBe("WON");
    expect(revision.status).toBe("DRAFT");
    expect(sourceLine.jobStructureId).toBe(fixture.jobStructureId);
    expect(structure.quoteId).toBe(fixture.sourceQuoteId);
  });

  it("rejects a handoff when a retained structure line is changed to a non-structure type", async () => {
    const revisionId = await createDraftRevision();
    await prisma.quoteLineItem.updateMany({
      where: { quoteId: revisionId },
      data: { lineType: "SERVICE" },
    });

    const result = await updateQuoteStatus(revisionId, "WON");
    expect(result.error).toMatch(/removes one or more structures/i);

    const [source, revision, sourceLine, structure] = await Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
      prisma.quote.findUniqueOrThrow({ where: { id: revisionId } }),
      prisma.quoteLineItem.findUniqueOrThrow({ where: { id: fixture.sourceLineId } }),
      prisma.jobStructure.findUniqueOrThrow({ where: { id: fixture.jobStructureId } }),
    ]);
    expect(source.status).toBe("WON");
    expect(revision.status).toBe("DRAFT");
    expect(sourceLine.jobStructureId).toBe(fixture.jobStructureId);
    expect(structure.quoteId).toBe(fixture.sourceQuoteId);
  });

  it("serializes a draft edit against marking the same revision won", async () => {
    const revisionId = await createDraftRevision();
    const draftEdit = await buildUpdateInput(revisionId, "DRAFT", "SERVICE");

    let signalLocked!: () => void;
    let releaseLock!: () => void;
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    const released = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const blocker = prisma.$transaction(async (tx) => {
      await lockQuoteForUpdate(tx, revisionId);
      signalLocked();
      await released;
    });

    await locked;
    const markWon = updateQuoteStatus(revisionId, "WON");
    const saveDraft = updateQuote(revisionId, draftEdit);
    await new Promise((resolve) => setTimeout(resolve, 75));
    releaseLock();

    const [markWonResult] = await Promise.all([markWon, saveDraft, blocker]);
    const [source, revision, revisionLine, structure] = await Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
      prisma.quote.findUniqueOrThrow({ where: { id: revisionId } }),
      prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId: revisionId } }),
      prisma.jobStructure.findUniqueOrThrow({ where: { id: fixture.jobStructureId } }),
    ]);

    if (revision.status === "WON") {
      expect(markWonResult).toEqual({ success: true });
      expect(source.status).toBe("REVISED");
      expect(revisionLine.lineType).toBe("CUSTOM_STRUCTURE");
      expect(revisionLine.jobStructureId).toBe(fixture.jobStructureId);
      expect(structure.quoteId).toBe(revisionId);
    } else {
      expect(markWonResult.error).toMatch(/removes one or more structures/i);
      expect(source.status).toBe("WON");
      expect(revision.status).toBe("DRAFT");
      expect(revisionLine.lineType).toBe("SERVICE");
      expect(revisionLine.jobStructureId).toBeNull();
      expect(structure.quoteId).toBe(fixture.sourceQuoteId);
    }
  });

  it("rolls back source supersession if later handoff work fails", async () => {
    const revisionId = await createDraftRevision();

    await expect(
      prisma.$transaction(async (tx) => {
        await supersedeOtherWonQuotesInFamily(
          tx,
          revisionId,
          fixture.sourceQuoteId,
        );
        throw new Error("Forced failure after supersession");
      }),
    ).rejects.toThrow(/forced failure/i);

    const [source, revision, sourceLine, structure] = await Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
      prisma.quote.findUniqueOrThrow({ where: { id: revisionId } }),
      prisma.quoteLineItem.findUniqueOrThrow({ where: { id: fixture.sourceLineId } }),
      prisma.jobStructure.findUniqueOrThrow({ where: { id: fixture.jobStructureId } }),
    ]);
    expect(source.status).toBe("WON");
    expect(revision.status).toBe("DRAFT");
    expect(sourceLine.jobStructureId).toBe(fixture.jobStructureId);
    expect(structure.quoteId).toBe(fixture.sourceQuoteId);
  });

  it("does not let the standalone won action demote the protected source", async () => {
    await createDraftRevision();

    const result = await updateQuoteStatus(fixture.sourceQuoteId, "LOST");
    expect(result).toEqual({
      error: "This action can only mark a quote as won.",
    });
    expect(
      await prisma.quote.findUniqueOrThrow({
        where: { id: fixture.sourceQuoteId },
        select: { status: true },
      }),
    ).toEqual({ status: "WON" });
  });

  it("leaves the original award intact when the draft revision is deleted", async () => {
    const revisionId = await createDraftRevision();

    const result = await deleteQuote(revisionId);
    expect(result).toEqual({ success: true });

    const [source, revision, structure, progress] = await Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: fixture.sourceQuoteId } }),
      prisma.quote.findUnique({ where: { id: revisionId } }),
      prisma.jobStructure.findUniqueOrThrow({
        where: { id: fixture.jobStructureId },
      }),
      getJobProgress(prisma, fixture.jobId),
    ]);

    expect(source.status).toBe("WON");
    expect(revision).toBeNull();
    expect(structure.quoteId).toBe(fixture.sourceQuoteId);
    expect(progress.quoteId).toBe(fixture.sourceQuoteId);
  });
});
