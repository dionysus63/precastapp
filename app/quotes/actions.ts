"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma, withDatabaseRetry } from "@/lib/prisma";

const QUOTE_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "SENT",
  "REVISED",
  "WON",
  "LOST",
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
};

export type CreateQuoteInput = {
  customerId: string | null;
  customerName: string;
  jobId: string | null;
  jobNumber: string | null;
  projectName: string;
  projectAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
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
  }

  if (!QUOTE_STATUSES.includes(input.status)) {
    throw new Error("Invalid quote status.");
  }

  if (!QUOTE_TYPES.includes(input.quoteType)) {
    throw new Error("Invalid quote type.");
  }
}

async function generateQuoteNumber(jobNumber: string | null) {
  const yearSuffix = String(new Date().getFullYear() % 100).padStart(2, "0");
  const base = jobNumber
    ? `Q-${jobNumber}-R0`
    : `Q-${yearSuffix}-NEW-R0`;

  let candidate = base;
  let suffix = 2;

  while (
    await prisma.quote.findUnique({
      where: { quoteNumber: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
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
  try {
    validateCreateQuoteInput(input);

    const quoteNumber = await generateQuoteNumber(input.jobNumber);

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        revisionNumber: 0,
        jobId: input.jobId,
        customerId: input.customerId,
        jobNumber: input.jobNumber,
        customerName: input.customerName.trim(),
        projectName: input.projectName.trim(),
        projectAddress: input.projectAddress,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        status: input.status,
        quoteType: input.quoteType,
        estimator: input.estimator,
        quoteDate: parseOptionalDate(input.quoteDate),
        bidDueDate: parseOptionalDate(input.bidDueDate),
        expirationDate: parseOptionalDate(input.expirationDate),
        priceListId: input.priceListId,
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
  "EXPIRED",
  "CANCELLED",
] as const;

type QuoteStatusValue = (typeof QUOTE_STATUS_VALUES)[number];

export async function updateQuoteStatus(quoteId: string, status: QuoteStatusValue) {
  if (!QUOTE_STATUS_VALUES.includes(status)) {
    return { error: "Invalid quote status." };
  }

  try {
    await withDatabaseRetry(async (client) => {
      await client.quote.update({
        where: { id: quoteId },
        data: { status },
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
