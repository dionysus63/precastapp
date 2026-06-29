import { Prisma, type Prisma as PrismaTypes } from "@/app/generated/prisma/client";
import { getPrimaryContactForCustomer, contactToSnapshot } from "@/lib/customer-contact-sync";
import { generateQuoteNumber } from "@/lib/quote-number";
import {
  computeQuoteTotalsFromLines,
  mapLineItemForCreate,
  toQuoteDecimal,
} from "@/lib/quote-copy";

type TransactionClient = PrismaTypes.TransactionClient;

export async function cloneQuoteForBidder(
  tx: TransactionClient,
  templateQuoteId: string,
  jobBidderId: string,
  contactId?: string | null,
): Promise<string> {
  const [template, bidder] = await Promise.all([
    tx.quote.findUnique({
      where: { id: templateQuoteId },
      include: {
        lineItems: { orderBy: { lineNumber: "asc" } },
      },
    }),
    tx.jobBidder.findUnique({
      where: { id: jobBidderId },
      include: {
        customer: true,
        job: true,
        quotes: { select: { id: true }, take: 1 },
      },
    }),
  ]);

  if (!template) {
    throw new Error("Template quote was not found.");
  }

  if (!bidder) {
    throw new Error("Bidder was not found.");
  }

  if (template.jobId && template.jobId !== bidder.jobId) {
    throw new Error("Template quote does not belong to this job.");
  }

  if (bidder.quotes.length > 0) {
    throw new Error(
      `${bidder.customer.name} already has a quote on this job.`,
    );
  }

  const customer = bidder.customer;
  const job = bidder.job;
  const quoteNumber = await generateQuoteNumber(tx, {
    jobNumber: job?.jobNumber ?? template.jobNumber,
    scopeLabel: template.scopeLabel,
    contractorName: customer.name,
  });

  let contactSnapshot = null;
  if (contactId) {
    const selectedContact = await tx.contact.findFirst({
      where: { id: contactId, customerId: customer.id },
    });
    if (!selectedContact) {
      throw new Error("Selected contact was not found for this contractor.");
    }
    contactSnapshot = contactToSnapshot(selectedContact);
  } else {
    contactSnapshot = await getPrimaryContactForCustomer(tx, customer.id);
  }

  const primaryContact = contactSnapshot;

  const { computed, lineTotals, totalWeight, totalYards, deliveryAmount } =
    computeQuoteTotalsFromLines(template.lineItems, template.taxRate);

  const quote = await tx.quote.create({
    data: {
      quoteNumber,
      revisionNumber: 0,
      job: { connect: { id: bidder.jobId } },
      jobBidder: { connect: { id: bidder.id } },
      customer: { connect: { id: customer.id } },
      ...(primaryContact?.contactId
        ? { contact: { connect: { id: primaryContact.contactId } } }
        : {}),
      masterQuote: { connect: { id: templateQuoteId } },
      jobNumber: job?.jobNumber ?? template.jobNumber,
      customerName: customer.name,
      projectName: job?.projectName ?? template.projectName,
      scopeLabel: template.scopeLabel,
      projectAddress: job?.projectAddress ?? template.projectAddress,
      contactName:
        primaryContact?.contactName ??
        job?.contactName ??
        customer.primaryContactName ??
        template.contactName,
      contactEmail:
        primaryContact?.contactEmail ??
        job?.contactEmail ??
        customer.email ??
        template.contactEmail,
      contactPhone:
        primaryContact?.contactPhone ??
        job?.contactPhone ??
        customer.phone ??
        template.contactPhone,
      contactTitle:
        primaryContact?.contactTitle ?? template.contactTitle ?? null,
      status: "DRAFT",
      quoteType: template.quoteType,
      estimator: template.estimator,
      quoteDate: template.quoteDate,
      bidDueDate: template.bidDueDate,
      expirationDate: template.expirationDate,
      ...(template.priceListId
        ? { priceList: { connect: { id: template.priceListId } } }
        : {}),
      customerPO: null,
      subtotal: computed.subtotal,
      discountAmount: new Prisma.Decimal(0),
      deliveryAmount,
      taxableAmount: computed.taxableAmount,
      taxRate: toQuoteDecimal(template.taxRate),
      salesTax: computed.salesTax,
      total: computed.total,
      totalWeight,
      totalYards,
      internalNotes: template.internalNotes,
      customerNotes: template.customerNotes,
      termsAndConditions: template.termsAndConditions,
      leadTime: template.leadTime,
      deliveryNotes: template.deliveryNotes,
      lineItems: {
        create: template.lineItems.map((line, index) =>
          mapLineItemForCreate(line, lineTotals[index]),
        ),
      },
    },
    select: { id: true },
  });

  return quote.id;
}
