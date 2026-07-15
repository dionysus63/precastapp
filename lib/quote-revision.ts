import type { Prisma as PrismaTypes } from "@/app/generated/prisma/client";
import {
  computeQuoteTotalsFromLines,
  mapLineItemForCreate,
  toQuoteDecimal,
} from "@/lib/quote-copy";
import {
  findAncestorLineWithStructure,
  STRUCTURE_LINE_TYPES,
} from "@/lib/job-structure-workflow";
import { generateRevisionQuoteNumber } from "@/lib/quote-number";

type TransactionClient = PrismaTypes.TransactionClient;

const REVISABLE_STATUSES = new Set(["SENT", "WON"]);

const OPERATIONAL_JOB_MISMATCH_ERROR =
  "A revision of a won quote must stay linked to the same job as the current award.";

export async function lockQuoteForUpdate(
  tx: TransactionClient,
  quoteId: string,
): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Quote" WHERE "id" = ${quoteId} FOR UPDATE
  `;
}

export async function assertRevisionKeepsOperationalJob(
  tx: TransactionClient,
  quoteId: string,
  originalQuoteId: string | null,
  candidateJobId: string | null,
): Promise<void> {
  if (!originalQuoteId) {
    return;
  }

  const currentWon = await tx.quote.findFirst({
    where: {
      id: { not: quoteId },
      status: "WON",
      OR: [{ id: originalQuoteId }, { originalQuoteId }],
    },
    select: { jobId: true },
  });
  if (currentWon && currentWon.jobId !== candidateJobId) {
    throw new Error(OPERATIONAL_JOB_MISMATCH_ERROR);
  }
}

export async function supersedeOtherWonQuotesInFamily(
  tx: TransactionClient,
  quoteId: string,
  originalQuoteId: string | null,
): Promise<string[]> {
  const rootId = originalQuoteId ?? quoteId;
  const candidate = await tx.quote.findUnique({
    where: { id: quoteId },
    select: {
      jobId: true,
      lineItems: {
        where: { lineType: { in: STRUCTURE_LINE_TYPES } },
        select: { previousLineItemId: true },
      },
    },
  });
  if (!candidate) {
    throw new Error("Quote was not found.");
  }

  const priorWonQuotes = await tx.quote.findMany({
    where: {
      id: { not: quoteId },
      status: "WON",
      OR: [{ id: rootId }, { originalQuoteId: rootId }],
    },
    select: {
      id: true,
      jobId: true,
      lineItems: {
        where: { jobStructureId: { not: null } },
        select: { id: true },
      },
    },
  });

  if (priorWonQuotes.length === 0) {
    return [];
  }

  if (priorWonQuotes.some((quote) => quote.jobId !== candidate.jobId)) {
    throw new Error(OPERATIONAL_JOB_MISMATCH_ERROR);
  }

  // The operational structure can live several revisions back (for example,
  // R0 WON -> R1 SENT/REVISED -> R2 DRAFT). Use the same lineage walk as the
  // structure linker, and only count candidate lines the linker can adopt.
  const retainedAncestorIds = new Set<string>();
  for (const line of candidate.lineItems) {
    const ancestor = await findAncestorLineWithStructure(
      tx,
      line.previousLineItemId,
    );
    if (ancestor) {
      retainedAncestorIds.add(ancestor.lineId);
    }
  }
  const removedLinkedStructureCount = priorWonQuotes.reduce(
    (count, quote) =>
      count +
      quote.lineItems.filter((line) => !retainedAncestorIds.has(line.id)).length,
    0,
  );
  if (removedLinkedStructureCount > 0) {
    throw new Error(
      "This revision removes one or more structures already linked to production. Keep those structure lines on the revision before marking it won.",
    );
  }

  const ids = priorWonQuotes.map((quote) => quote.id);
  await tx.quote.updateMany({
    where: { id: { in: ids }, status: "WON" },
    data: { status: "REVISED" },
  });
  return ids;
}

export async function reviseQuoteInTransaction(
  tx: TransactionClient,
  sourceQuoteId: string,
): Promise<string> {
  // Serialize revisions of the same source without changing any business
  // fields. A second request waits here, then sees the revision created by the
  // first transaction and receives the friendly "already revised" error.
  await lockQuoteForUpdate(tx, sourceQuoteId);

  const source = await tx.quote.findUnique({
    where: { id: sourceQuoteId },
    include: {
      lineItems: { orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }] },
    },
  });

  if (!source) {
    throw new Error("Quote was not found.");
  }

  const rootId = source.originalQuoteId ?? source.id;

  // WON sources stay operational while their replacement is only a draft.
  // Because their status no longer identifies a superseded source, reject a
  // later request against one explicitly through its revision lineage.
  const latestBeforeClaim = await tx.quote.findFirst({
    where: {
      OR: [{ id: rootId }, { originalQuoteId: rootId }],
    },
    orderBy: { revisionNumber: "desc" },
    select: { id: true, quoteNumber: true, revisionNumber: true },
  });
  if (latestBeforeClaim && latestBeforeClaim.id !== source.id) {
    throw new Error(
      `This quote was already revised. Open ${latestBeforeClaim.quoteNumber} (R${latestBeforeClaim.revisionNumber}) from Revision History.`,
    );
  }

  if (!REVISABLE_STATUSES.has(source.status)) {
    throw new Error("Only sent or won quotes can be revised.");
  }

  // SENT quotes have no downstream operational work to preserve, so their
  // source can be marked REVISED immediately. WON sources stay WON until the
  // replacement wins and supersedeOtherWonQuotesInFamily performs the handoff.
  if (source.status === "SENT") {
    await tx.quote.update({
      where: { id: sourceQuoteId },
      data: { status: "REVISED" },
    });
  }

  const family = await tx.quote.findMany({
    where: {
      OR: [{ id: rootId }, { originalQuoteId: rootId }],
    },
    select: { revisionNumber: true },
  });

  const nextRevision =
    Math.max(0, ...family.map((quote) => quote.revisionNumber)) + 1;

  const quoteNumber = await generateRevisionQuoteNumber(
    tx,
    source.quoteNumber,
    nextRevision,
  );

  // Revisions copy the source discount forward, so it must be reflected in
  // the recomputed total.
  const { computed, lineTotals, totalWeight, totalYards, deliveryAmount } =
    computeQuoteTotalsFromLines(
      source.lineItems,
      source.taxRate,
      source.discountAmount,
    );

  const newQuote = await tx.quote.create({
    data: {
      quoteNumber,
      revisionNumber: nextRevision,
      originalQuote: { connect: { id: rootId } },
      ...(source.jobId ? { job: { connect: { id: source.jobId } } } : {}),
      ...(source.jobBidderId
        ? { jobBidder: { connect: { id: source.jobBidderId } } }
        : {}),
      ...(source.customerId
        ? { customer: { connect: { id: source.customerId } } }
        : {}),
      ...(source.contactId
        ? { contact: { connect: { id: source.contactId } } }
        : {}),
      ...(source.priceListId
        ? { priceList: { connect: { id: source.priceListId } } }
        : {}),
      ...(source.masterQuoteId
        ? { masterQuote: { connect: { id: source.masterQuoteId } } }
        : {}),
      jobNumber: source.jobNumber,
      customerName: source.customerName,
      projectName: source.projectName,
      scopeLabel: source.scopeLabel,
      projectAddress: source.projectAddress,
      contactName: source.contactName,
      contactEmail: source.contactEmail,
      contactPhone: source.contactPhone,
      contactTitle: source.contactTitle,
      status: "DRAFT",
      quoteType: source.quoteType,
      estimator: source.estimator,
      quoteDate: source.quoteDate,
      bidDueDate: source.bidDueDate,
      expirationDate: source.expirationDate,
      customerPO: source.customerPO,
      subtotal: computed.subtotal,
      discountAmount: source.discountAmount,
      deliveryAmount,
      taxableAmount: computed.taxableAmount,
      taxRate: toQuoteDecimal(source.taxRate),
      salesTax: computed.salesTax,
      total: computed.total,
      totalWeight,
      totalYards,
      internalNotes: source.internalNotes,
      customerNotes: source.customerNotes,
      termsAndConditions: source.termsAndConditions,
      fob: source.fob,
      leadTime: source.leadTime,
      deliveryNotes: source.deliveryNotes,
      lineItems: {
        create: source.lineItems.map((line, index) =>
          mapLineItemForCreate(line, lineTotals[index], {
            previousLineItemId: line.id,
          }),
        ),
      },
    },
    select: { id: true },
  });

  // Job structures deliberately stay linked to the source quote's lines: the
  // revision is only a draft until it's won, at which point winning adopts
  // the structures across via each line's previousLineItemId lineage
  // (linkJobStructuresFromQuoteInTransaction). Moving them eagerly stranded
  // structures when a draft revision was discarded and caused duplicates
  // when the superseded original was re-won.

  return newQuote.id;
}
