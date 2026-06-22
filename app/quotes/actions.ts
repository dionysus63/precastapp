"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import {
  assertSanitaryDrainRingAllowed,
  parseDrainRingStyle,
  type DrainRingStyle,
} from "@/lib/drain-ring-utils";
import { generateQuoteNumber } from "@/lib/quote-number";

const QUOTE_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "SENT",
  "REVISED",
  "WON",
  "LOST",
  "LOST_BC",
  "EXPIRED",
  "CANCELLED",
] as const;

const QUOTE_TYPES = [
  "STOCK_ONLY",
  "CONFIGURABLE_STRUCTURES",
  "CUSTOM_STRUCTURES",
  "MIXED",
] as const;

const QUOTE_LINE_TYPES = [
  "STOCK_PRODUCT",
  "CONFIGURABLE_STRUCTURE",
  "CUSTOM_STRUCTURE",
  "SERVICE",
  "MISC",
] as const;

type QuoteStatus = (typeof QUOTE_STATUSES)[number];
type QuoteType = (typeof QUOTE_TYPES)[number];
type QuoteLineType = (typeof QUOTE_LINE_TYPES)[number];

export type CreateQuoteLineItemInput = {
  lineNumber: number;
  lineType: QuoteLineType;
  productId: string | null;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  weight: number | null;
  yards: number | null;
  taxable: boolean;
  total: number;
  statusNote: string | null;
  notes: string | null;
  isDrainRing?: boolean;
  ringDiameterFeet?: number | null;
  poolHeightFeet?: number | null;
  drainRingStyle?: DrainRingStyle;
};

export type CreateQuoteInput = {
  customerId: string | null;
  customerName: string;
  jobId: string | null;
  jobBidderId?: string | null;
  jobNumber: string | null;
  projectName: string;
  projectAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactId?: string | null;
  contactTitle?: string | null;
  status: QuoteStatus;
  quoteType: QuoteType;
  estimator: string | null;
  quoteDate: string | null;
  bidDueDate: string | null;
  expirationDate: string | null;
  priceListId: string | null;
  customerPO: string | null;
  taxRate: number;
  internalNotes: string | null;
  customerNotes: string | null;
  termsAndConditions: string | null;
  leadTime: string | null;
  deliveryNotes: string | null;
  lineItems: CreateQuoteLineItemInput[];
  totals: {
    subtotal: number;
    discount: number;
    delivery: number;
    taxableAmount: number;
    salesTax: number;
    total: number;
    totalWeight: number;
    totalYards: number;
  };
};

function parseOptionalDate(value: string | null) {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }

  return date;
}

function validateCreateQuoteInput(input: CreateQuoteInput) {
  if (!input.customerName.trim()) {
    throw new Error("Customer is required.");
  }

  if (!input.projectName.trim()) {
    throw new Error("Project name or job is required.");
  }

  if (input.lineItems.length === 0) {
    throw new Error("Add at least one line item.");
  }

  if (input.taxRate < 0) {
    throw new Error("Tax rate cannot be negative.");
  }

  for (const line of input.lineItems) {
    if (line.quantity <= 0) {
      throw new Error(`Line ${line.lineNumber}: quantity must be greater than 0.`);
    }

    if (line.unitPrice < 0) {
      throw new Error(`Line ${line.lineNumber}: unit price cannot be negative.`);
    }

    if (!QUOTE_LINE_TYPES.includes(line.lineType)) {
      throw new Error(`Line ${line.lineNumber}: invalid line type.`);
    }

    if (line.isDrainRing) {
      const style = parseDrainRingStyle(line.drainRingStyle ?? "DRAIN");
      assertSanitaryDrainRingAllowed(
        line.ringDiameterFeet ?? null,
        style,
        `Line ${line.lineNumber}`,
      );
    }
  }

  if (!QUOTE_STATUSES.includes(input.status)) {
    throw new Error("Invalid quote status.");
  }

  if (!QUOTE_TYPES.includes(input.quoteType)) {
    throw new Error("Invalid quote type.");
  }
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function toOptionalDecimal(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Prisma.Decimal(value);
}

export async function createQuote(
  input: CreateQuoteInput,
): Promise<{ error: string } | never> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  try {
    validateCreateQuoteInput(input);

    const quoteNumber = await generateQuoteNumber(prisma, input.jobNumber);

    if (input.contactId) {
      if (!input.customerId) {
        throw new Error("A customer is required when selecting a contact.");
      }

      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId, customerId: input.customerId },
        select: { id: true },
      });
      if (!contact) {
        throw new Error("Selected contact does not belong to this customer.");
      }
    }

    if (input.jobBidderId) {
      const bidder = await prisma.jobBidder.findUnique({
        where: { id: input.jobBidderId },
        select: {
          id: true,
          jobId: true,
          customerId: true,
          quotes: { select: { id: true }, take: 1 },
        },
      });

      if (!bidder) {
        throw new Error("Bidder was not found on this job.");
      }

      if (input.jobId && bidder.jobId !== input.jobId) {
        throw new Error("Bidder does not belong to the selected job.");
      }

      if (input.customerId && bidder.customerId !== input.customerId) {
        throw new Error("Bidder does not belong to the selected customer.");
      }

      if (bidder.quotes.length > 0) {
        throw new Error("This contractor already has a quote on this job.");
      }
    }

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        revisionNumber: 0,
        ...(input.jobId ? { job: { connect: { id: input.jobId } } } : {}),
        ...(input.jobBidderId
          ? { jobBidder: { connect: { id: input.jobBidderId } } }
          : {}),
        ...(input.customerId
          ? { customer: { connect: { id: input.customerId } } }
          : {}),
        ...(input.contactId
          ? { contact: { connect: { id: input.contactId } } }
          : {}),
        sentAt: input.status === "SENT" ? new Date() : null,
        jobNumber: input.jobNumber,
        customerName: input.customerName.trim(),
        projectName: input.projectName.trim(),
        projectAddress: input.projectAddress,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        contactTitle: input.contactTitle ?? null,
        status: input.status,
        quoteType: input.quoteType,
        estimator: input.estimator,
        quoteDate: parseOptionalDate(input.quoteDate),
        bidDueDate: parseOptionalDate(input.bidDueDate),
        expirationDate: parseOptionalDate(input.expirationDate),
        ...(input.priceListId
          ? { priceList: { connect: { id: input.priceListId } } }
          : {}),
        customerPO: input.customerPO,
        subtotal: toDecimal(input.totals.subtotal),
        discountAmount: toDecimal(input.totals.discount),
        deliveryAmount: toDecimal(input.totals.delivery),
        taxableAmount: toDecimal(input.totals.taxableAmount),
        taxRate: toDecimal(input.taxRate),
        salesTax: toDecimal(input.totals.salesTax),
        total: toDecimal(input.totals.total),
        totalWeight: toDecimal(input.totals.totalWeight),
        totalYards: toDecimal(input.totals.totalYards),
        internalNotes: input.internalNotes,
        customerNotes: input.customerNotes,
        termsAndConditions: input.termsAndConditions,
        leadTime: input.leadTime,
        deliveryNotes: input.deliveryNotes,
        lineItems: {
          create: input.lineItems.map((line) => ({
            lineNumber: line.lineNumber,
            lineType: line.lineType,
            productId: line.productId,
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
            sortOrder: line.lineNumber,
            notes: line.notes,
            isDrainRing: line.isDrainRing ?? false,
            ringDiameterFeet: toOptionalDecimal(line.ringDiameterFeet ?? null),
            poolHeightFeet: toOptionalDecimal(line.poolHeightFeet ?? null),
            drainRingStyle: line.isDrainRing
              ? parseDrainRingStyle(line.drainRingStyle ?? "DRAIN")
              : "DRAIN",
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/quotes");
    redirect(`/quotes/${quote.id}`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save quote. Please try again.",
    };
  }
}

const QUOTE_STATUS_VALUES = [
  "DRAFT",
  "IN_REVIEW",
  "SENT",
  "REVISED",
  "WON",
  "LOST",
  "LOST_BC",
  "EXPIRED",
  "CANCELLED",
] as const;

type QuoteStatusValue = (typeof QUOTE_STATUS_VALUES)[number];

export async function updateQuoteStatus(quoteId: string, status: QuoteStatusValue) {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  if (!QUOTE_STATUS_VALUES.includes(status)) {
    return { error: "Invalid quote status." };
  }

  try {
    await withDatabaseRetry(async (client) => {
      const existing = await client.quote.findUnique({
        where: { id: quoteId },
        select: { sentAt: true },
      });

      if (!existing) {
        throw new Error("Quote was not found.");
      }

      await client.quote.update({
        where: { id: quoteId },
        data: {
          status,
          ...(status === "SENT" && !existing.sentAt
            ? { sentAt: new Date() }
            : {}),
        },
      });

      if (status === "WON") {
        const { linkJobStructuresFromQuote } = await import(
          "@/lib/job-structure-workflow"
        );
        await linkJobStructuresFromQuote(client, quoteId);
      }
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/production");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update quote status.",
    };
  }
}

export async function listPriceListsForForm() {
  return withDatabaseRetry((client) =>
    client.priceList.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
  );
}
