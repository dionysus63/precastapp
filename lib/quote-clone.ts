import { Prisma, type Prisma as PrismaTypes } from "@/app/generated/prisma/client";
import { parseDrainRingStyle } from "@/lib/drain-ring-utils";
import { getPrimaryContactForCustomer, contactToSnapshot } from "@/lib/customer-contact-sync";
import { generateQuoteNumber } from "@/lib/quote-number";

type TransactionClient = PrismaTypes.TransactionClient;

function toDecimal(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value.toString());
}

function toOptionalDecimal(value: Prisma.Decimal | number | string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value.toString());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return new Prisma.Decimal(parsed);
}

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
  const quoteNumber = await generateQuoteNumber(tx, job?.jobNumber ?? template.jobNumber);

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
      jobNumber: job?.jobNumber ?? template.jobNumber,
      customerName: customer.name,
      projectName: job?.projectName ?? template.projectName,
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
      subtotal: toDecimal(template.subtotal),
      discountAmount: toDecimal(template.discountAmount),
      deliveryAmount: toDecimal(template.deliveryAmount),
      taxableAmount: toDecimal(template.taxableAmount),
      taxRate: toDecimal(template.taxRate),
      salesTax: toDecimal(template.salesTax),
      total: toDecimal(template.total),
      totalWeight: toDecimal(template.totalWeight),
      totalYards: toDecimal(template.totalYards),
      internalNotes: template.internalNotes,
      customerNotes: template.customerNotes,
      termsAndConditions: template.termsAndConditions,
      leadTime: template.leadTime,
      deliveryNotes: template.deliveryNotes,
      lineItems: {
        create: template.lineItems.map((line) => ({
          lineNumber: line.lineNumber,
          lineType: line.lineType,
          productId: line.productId,
          jobStructureId: null,
          itemCode: line.itemCode,
          description: line.description,
          quantity: toDecimal(line.quantity),
          unit: line.unit,
          unitPrice: toDecimal(line.unitPrice),
          weight: toOptionalDecimal(line.weight),
          yards: toOptionalDecimal(line.yards),
          taxable: line.taxable,
          total: toDecimal(line.total),
          statusNote: line.statusNote,
          sortOrder: line.sortOrder,
          notes: line.notes,
          isDrainRing: line.isDrainRing,
          ringDiameterFeet: toOptionalDecimal(line.ringDiameterFeet),
          poolHeightFeet: toOptionalDecimal(line.poolHeightFeet),
          drainRingStyle: line.isDrainRing
            ? parseDrainRingStyle(line.drainRingStyle)
            : "DRAIN",
        })),
      },
    },
    select: { id: true },
  });

  return quote.id;
}
