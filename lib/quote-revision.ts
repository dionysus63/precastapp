import { Prisma, type Prisma as PrismaTypes } from "@/app/generated/prisma/client";
import {
  computeQuoteTotalsFromLines,
  mapLineItemForCreate,
  toQuoteDecimal,
} from "@/lib/quote-copy";
import { generateRevisionQuoteNumber } from "@/lib/quote-number";

type TransactionClient = PrismaTypes.TransactionClient;

const REVISABLE_STATUSES = new Set(["SENT", "WON"]);

export async function reviseQuoteInTransaction(
  tx: TransactionClient,
  sourceQuoteId: string,
): Promise<string> {
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

  if (!REVISABLE_STATUSES.has(source.status)) {
    if (source.status === "REVISED") {
      const latest = await tx.quote.findFirst({
        where: {
          OR: [{ id: rootId }, { originalQuoteId: rootId }],
        },
        orderBy: { revisionNumber: "desc" },
        select: { id: true, quoteNumber: true, revisionNumber: true },
      });

      if (latest && latest.id !== source.id) {
        throw new Error(
          `This quote was already revised. Open ${latest.quoteNumber} (R${latest.revisionNumber}) from Revision History.`,
        );
      }
    }

    throw new Error("Only sent or won quotes can be revised.");
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

  const { computed, totalWeight, totalYards, deliveryAmount } =
    computeQuoteTotalsFromLines(source.lineItems, source.taxRate);

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
      jobNumber: source.jobNumber,
      customerName: source.customerName,
      projectName: source.projectName,
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
      leadTime: source.leadTime,
      deliveryNotes: source.deliveryNotes,
      lineItems: {
        create: source.lineItems.map((line, index) =>
          mapLineItemForCreate(line, computed.lineTotals[index], {
            previousLineItemId: line.id,
          }),
        ),
      },
    },
    select: { id: true },
  });

  const newLineItems = await tx.quoteLineItem.findMany({
    where: { quoteId: newQuote.id },
    orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
  });

  for (let index = 0; index < source.lineItems.length; index += 1) {
    const sourceLine = source.lineItems[index];
    const newLine = newLineItems[index];

    if (!newLine || !sourceLine.jobStructureId) {
      continue;
    }

    await tx.jobStructure.update({
      where: { id: sourceLine.jobStructureId },
      data: {
        quoteId: newQuote.id,
        quantity: newLine.quantity,
      },
    });

    await tx.quoteLineItem.update({
      where: { id: newLine.id },
      data: { jobStructureId: sourceLine.jobStructureId },
    });

    await tx.quoteLineItem.update({
      where: { id: sourceLine.id },
      data: { jobStructureId: null },
    });
  }

  await tx.quote.update({
    where: { id: sourceQuoteId },
    data: { status: "REVISED" },
  });

  return newQuote.id;
}
