"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AppPermission,
  Prisma,
  QuoteLineType,
  QuoteStatus,
  QuoteType,
} from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import {
  QUOTE_FORM_CUSTOMER_SELECT,
  QUOTE_FORM_JOB_SELECT,
  QUOTE_PRODUCT_OPTION_SELECT,
  mapCustomerToQuoteFormOption,
  mapJobToQuoteFormOption,
} from "@/app/quotes/quote-form-data";
import { mapProductToQuoteFormOption } from "@/lib/quote-mapper";
import {
  isDerivableCastingAssembly,
  loadDerivedAssemblyValues,
} from "@/lib/casting-service";
import { PHYSICAL_PRODUCT_TYPES } from "@/lib/product-types";
import { getProductPricesForList } from "@/lib/price-list-service";
import type {
  QuoteFormCustomerOption,
  QuoteFormJobOption,
  QuoteFormProductOption,
} from "@/lib/quotes/types";
import {
  assertSanitaryDrainRingAllowed,
  parseDrainRingStyle,
  type DrainRingStyle,
} from "@/lib/drain-ring-utils";
import { generateQuoteNumber } from "@/lib/quote-number";
import { linkPlanSheetToQuote } from "@/app/quotes/plan-sheet-actions";
import { computeMoneyTotals } from "@/lib/money";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";
import { resolveQuoteLineQuantityForStorage } from "@/lib/quotes/constants";
import { canEditQuote } from "@/lib/quotes/edit-rules";

const QUOTE_STATUSES = Object.values(QuoteStatus);
const QUOTE_TYPES = Object.values(QuoteType);
const QUOTE_LINE_TYPES = Object.values(QuoteLineType);

type QuoteStatusValue = (typeof QUOTE_STATUSES)[number];
type QuoteTypeValue = (typeof QUOTE_TYPES)[number];
type QuoteLineTypeValue = (typeof QUOTE_LINE_TYPES)[number];

export type CreateQuoteLineItemInput = {
  /** DB id of the line this row represents when editing (client-generated ids
   * for new rows are ignored). Used to carry jobStructureId and revision
   * lineage across updateQuote's delete-and-recreate. */
  existingLineItemId?: string | null;
  lineNumber: number;
  lineType: QuoteLineTypeValue;
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
  structureConfigJson?: Record<string, unknown> | null;
};

export type CreateQuoteInput = {
  customerId: string | null;
  customerName: string;
  jobId: string | null;
  jobBidderId?: string | null;
  jobNumber: string | null;
  projectName: string;
  scopeLabel?: string | null;
  projectAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactId?: string | null;
  contactTitle?: string | null;
  status: QuoteStatusValue;
  quoteType: QuoteTypeValue;
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
  /** ISO updatedAt from when the edit form loaded the quote. When provided,
   * updateQuote rejects the save if someone else changed the quote since
   * (optimistic concurrency — same pattern as delivery tickets). */
  expectedUpdatedAt?: string;
  planSheetId?: string | null;
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

  const billableLines = input.lineItems.filter(
    (line) => line.lineType !== "CATEGORY",
  );
  if (billableLines.length === 0) {
    throw new Error("Add at least one billable line item (not only categories).");
  }

  if (input.taxRate < 0) {
    throw new Error("Tax rate cannot be negative.");
  }

  for (const line of input.lineItems) {
    if (line.lineType === "CATEGORY") {
      if (!line.description.trim()) {
        throw new Error(
          `Line ${line.lineNumber}: category name is required.`,
        );
      }
      continue;
    }

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

function isQuoteNumberConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function computeQuoteFinancials(input: CreateQuoteInput) {
  const billableLines = input.lineItems.filter(
    (line) => line.lineType !== "CATEGORY",
  );
  const computed = computeMoneyTotals(
    billableLines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
    input.taxRate,
  );

  let billableIndex = 0;
  const lineTotals = input.lineItems.map((line) => {
    if (line.lineType === "CATEGORY") {
      return new Prisma.Decimal(0);
    }
    const total = computed.lineTotals[billableIndex]!;
    billableIndex += 1;
    return total;
  });

  const totalWeight = input.lineItems.reduce(
    (sum, line) => {
      if (line.lineType === "CATEGORY") {
        return sum;
      }
      return line.weight != null
        ? sum.add(new Prisma.Decimal(line.weight).mul(line.quantity))
        : sum;
    },
    new Prisma.Decimal(0),
  );
  const totalYards = input.lineItems.reduce(
    (sum, line) => {
      if (line.lineType === "CATEGORY") {
        return sum;
      }
      return line.yards != null
        ? sum.add(new Prisma.Decimal(line.yards).mul(line.quantity))
        : sum;
    },
    new Prisma.Decimal(0),
  );
  const deliveryAmount = computeDeliveryAmount(
    input.lineItems.map((line) => ({
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: line.description,
    })),
    lineTotals,
  );
  return { computed, lineTotals, totalWeight, totalYards, deliveryAmount };
}

function toOptionalDecimal(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Prisma.Decimal(value);
}

export async function createQuote(
  input: CreateQuoteInput,
  previewAfterSave = false,
): Promise<{ error: string } | never> {
  const actor = await requirePermission(AppPermission.QUOTES_MANAGE);
  try {
    validateCreateQuoteInput(input);

    let quoteNumber = await generateQuoteNumber(prisma, {
      jobNumber: input.jobNumber,
      scopeLabel: input.scopeLabel ?? null,
      contractorName: input.jobBidderId ? input.customerName : null,
    });

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

    // Recompute every money figure on the server with Decimal math. Client
    // totals (input.totals / line.total) are deliberately ignored for
    // persistence so a tampered or stale payload cannot store bogus amounts.
    const { computed, lineTotals, totalWeight, totalYards, deliveryAmount } =
      computeQuoteFinancials(input);

    const createQuoteRecord = (quoteNum: string) =>
      prisma.quote.create({
      data: {
        quoteNumber: quoteNum,
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
        createdBy: { connect: { id: actor.id } },
        sentAt: input.status === "SENT" ? new Date() : null,
        jobNumber: input.jobNumber,
        customerName: input.customerName.trim(),
        projectName: input.projectName.trim(),
        scopeLabel: input.scopeLabel?.trim() || null,
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
        subtotal: computed.subtotal,
        discountAmount: new Prisma.Decimal(0),
        deliveryAmount,
        taxableAmount: computed.taxableAmount,
        taxRate: toDecimal(input.taxRate),
        salesTax: computed.salesTax,
        total: computed.total,
        totalWeight,
        totalYards,
        internalNotes: input.internalNotes,
        customerNotes: input.customerNotes,
        termsAndConditions: input.termsAndConditions,
        leadTime: input.leadTime,
        deliveryNotes: input.deliveryNotes,
        lineItems: {
          create: input.lineItems.map((line, index) => ({
            lineNumber: line.lineNumber,
            lineType: line.lineType,
            productId: line.productId,
            itemCode: line.itemCode,
            description: line.description,
            quantity: toDecimal(
              resolveQuoteLineQuantityForStorage(line.lineType, line.quantity),
            ),
            unit: line.unit,
            unitPrice: toDecimal(line.unitPrice),
            weight: toOptionalDecimal(line.weight),
            yards: toOptionalDecimal(line.yards),
            taxable: line.taxable,
            total: lineTotals[index],
            statusNote: line.statusNote,
            sortOrder: index + 1,
            notes: line.notes,
            isDrainRing: line.isDrainRing ?? false,
            ringDiameterFeet: toOptionalDecimal(line.ringDiameterFeet ?? null),
            poolHeightFeet: toOptionalDecimal(line.poolHeightFeet ?? null),
            drainRingStyle: line.isDrainRing
              ? parseDrainRingStyle(line.drainRingStyle ?? "DRAIN")
              : "DRAIN",
            structureConfigJson:
              line.structureConfigJson != null
                ? (line.structureConfigJson as Prisma.InputJsonValue)
                : undefined,
          })),
        },
      },
      select: { id: true },
    });

    // The quote number is generated by a check-then-insert, so a concurrent
    // create could grab the same candidate. The DB unique constraint is the
    // backstop: on a collision, regenerate (which now sees the committed row
    // and bumps the suffix) and retry.
    let quote!: { id: string };
    for (let attempt = 0; ; attempt += 1) {
      try {
        quote = await createQuoteRecord(quoteNumber);
        break;
      } catch (error) {
        if (isQuoteNumberConflict(error)) {
          if (attempt >= 4) {
            throw new Error("Could not generate a unique quote number. Please try again.");
          }
          quoteNumber = await generateQuoteNumber(prisma, {
            jobNumber: input.jobNumber,
            scopeLabel: input.scopeLabel ?? null,
            contractorName: input.jobBidderId ? input.customerName : null,
          });
          continue;
        }
        throw error;
      }
    }

    await linkPlanSheetToQuote(input.planSheetId, quote.id, input.jobId);

    revalidatePath("/quotes");
    redirect(
      previewAfterSave
        ? `/quotes/${quote.id}/preview`
        : `/quotes/${quote.id}`,
    );
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

export async function updateQuote(
  quoteId: string,
  input: CreateQuoteInput,
  previewAfterSave = false,
): Promise<{ error: string } | never> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  if (!quoteId.trim()) {
    return { error: "Quote id is required." };
  }

  try {
    validateCreateQuoteInput(input);

    const existing = await withDatabaseRetry((client) =>
      client.quote.findUnique({
        where: { id: quoteId },
        select: {
          id: true,
          status: true,
          originalQuoteId: true,
          revisionNumber: true,
        },
      }),
    );

    if (!existing) {
      return { error: "Quote was not found." };
    }

    let supersededBy: { id: string } | null = null;
    if (existing.status === "REVISED") {
      const rootId = existing.originalQuoteId ?? existing.id;
      const successor = await withDatabaseRetry((client) =>
        client.quote.findFirst({
          where: {
            OR: [{ id: rootId }, { originalQuoteId: rootId }],
            revisionNumber: { gt: existing.revisionNumber },
          },
          orderBy: { revisionNumber: "asc" },
          select: { id: true },
        }),
      );
      supersededBy = successor;
    }

    if (
      !canEditQuote(
        existing.status as (typeof QUOTE_STATUSES)[number],
        supersededBy,
      )
    ) {
      return {
        error:
          "This quote can no longer be edited. Revise it to create a new revision instead.",
      };
    }

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

    const { computed, lineTotals, totalWeight, totalYards, deliveryAmount } =
      computeQuoteFinancials(input);

    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        if (input.expectedUpdatedAt) {
          // Lines are replaced wholesale below, so a stale save would silently
          // discard another estimator's edits. Compare millisecond timestamps
          // to detect a concurrent change since the form loaded.
          const current = await tx.quote.findUnique({
            where: { id: quoteId },
            select: { updatedAt: true },
          });
          const expected = new Date(input.expectedUpdatedAt);
          if (
            !current ||
            Number.isNaN(expected.getTime()) ||
            current.updatedAt.getTime() !== expected.getTime()
          ) {
            throw new Error(
              "This quote was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.",
            );
          }
        }

        // Lines are deleted and recreated below, which would sever production
        // links (jobStructureId) and revision lineage (previousLineItemId).
        // Snapshot them keyed by line id so rows the form kept can carry both
        // forward. Only ids that belong to THIS quote are honored.
        const priorLines = await tx.quoteLineItem.findMany({
          where: { quoteId },
          select: {
            id: true,
            jobStructureId: true,
            previousLineItemId: true,
          },
        });
        const priorById = new Map(priorLines.map((line) => [line.id, line]));

        // Delivery ticket and invoice lines reference quote lines with
        // SetNull, so the delete below would silently sever fulfillment and
        // billing links. Editable statuses should never have tickets or
        // invoices; refuse loudly rather than corrupt the links if that
        // invariant is ever violated.
        const priorLineIds = priorLines.map((line) => line.id);
        if (priorLineIds.length > 0) {
          const [ticketRefs, invoiceRefs] = await Promise.all([
            tx.deliveryTicketLineItem.count({
              where: { quoteLineItemId: { in: priorLineIds } },
            }),
            tx.invoiceLineItem.count({
              where: { quoteLineItemId: { in: priorLineIds } },
            }),
          ]);
          if (ticketRefs > 0 || invoiceRefs > 0) {
            throw new Error(
              "This quote has delivery tickets or invoices linked to its lines and can no longer be edited directly. Revise it to create a new revision instead.",
            );
          }
        }

        await tx.quoteLineItem.deleteMany({ where: { quoteId } });

        await tx.quote.update({
          where: { id: quoteId },
          data: {
            ...(input.jobId
              ? { job: { connect: { id: input.jobId } } }
              : { job: { disconnect: true } }),
            ...(input.jobBidderId
              ? { jobBidder: { connect: { id: input.jobBidderId } } }
              : { jobBidder: { disconnect: true } }),
            ...(input.customerId
              ? { customer: { connect: { id: input.customerId } } }
              : { customer: { disconnect: true } }),
            ...(input.contactId
              ? { contact: { connect: { id: input.contactId } } }
              : { contact: { disconnect: true } }),
            ...(input.priceListId
              ? { priceList: { connect: { id: input.priceListId } } }
              : { priceList: { disconnect: true } }),
            jobNumber: input.jobNumber,
            customerName: input.customerName,
            projectName: input.projectName,
            scopeLabel: input.scopeLabel?.trim() || null,
            projectAddress: input.projectAddress,
            contactName: input.contactName,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone,
            contactTitle: input.contactTitle,
            status: input.status,
            quoteType: input.quoteType,
            estimator: input.estimator,
            quoteDate: parseOptionalDate(input.quoteDate),
            bidDueDate: parseOptionalDate(input.bidDueDate),
            expirationDate: parseOptionalDate(input.expirationDate),
            customerPO: input.customerPO,
            subtotal: computed.subtotal,
            discountAmount: new Prisma.Decimal(0),
            deliveryAmount,
            taxableAmount: computed.taxableAmount,
            taxRate: toDecimal(input.taxRate),
            salesTax: computed.salesTax,
            total: computed.total,
            totalWeight,
            totalYards,
            internalNotes: input.internalNotes,
            customerNotes: input.customerNotes,
            termsAndConditions: input.termsAndConditions,
            leadTime: input.leadTime,
            deliveryNotes: input.deliveryNotes,
            lineItems: {
              create: input.lineItems.map((line, index) => {
                const prior = line.existingLineItemId
                  ? priorById.get(line.existingLineItemId)
                  : undefined;
                return {
                  lineNumber: line.lineNumber,
                  lineType: line.lineType,
                  productId: line.productId,
                  jobStructureId: prior?.jobStructureId ?? null,
                  previousLineItemId: prior?.previousLineItemId ?? null,
                  itemCode: line.itemCode,
                  description: line.description,
                  quantity: toDecimal(
                    resolveQuoteLineQuantityForStorage(
                      line.lineType,
                      line.quantity,
                    ),
                  ),
                  unit: line.unit,
                  unitPrice: toDecimal(line.unitPrice),
                  weight: toOptionalDecimal(line.weight),
                  yards: toOptionalDecimal(line.yards),
                  taxable: line.taxable,
                  total: lineTotals[index],
                  statusNote: line.statusNote,
                  sortOrder: index + 1,
                  notes: line.notes,
                  isDrainRing: line.isDrainRing ?? false,
                  ringDiameterFeet: toOptionalDecimal(line.ringDiameterFeet ?? null),
                  poolHeightFeet: toOptionalDecimal(line.poolHeightFeet ?? null),
                  drainRingStyle: line.isDrainRing
                    ? parseDrainRingStyle(line.drainRingStyle ?? "DRAIN")
                    : "DRAIN",
                  structureConfigJson:
                    line.structureConfigJson != null
                      ? (line.structureConfigJson as Prisma.InputJsonValue)
                      : undefined,
                };
              }),
            },
          },
        });

        // Keep linked structures' quantity in step with the edited line
        // (same behavior as quote revision).
        const relinked = await tx.quoteLineItem.findMany({
          where: { quoteId, jobStructureId: { not: null } },
          select: { jobStructureId: true, quantity: true },
        });
        for (const line of relinked) {
          await tx.jobStructure.update({
            where: { id: line.jobStructureId! },
            data: { quantity: line.quantity },
          });
        }
      }),
    );

    await linkPlanSheetToQuote(input.planSheetId, quoteId, input.jobId);

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath(`/quotes/${quoteId}/preview`);
    revalidatePath(`/quotes/${quoteId}/edit`);
    redirect(
      previewAfterSave
        ? `/quotes/${quoteId}/preview`
        : `/quotes/${quoteId}`,
    );
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
          : "Could not update quote. Please try again.",
    };
  }
}

const QUOTE_STATUS_VALUES = QUOTE_STATUSES;

export async function updateQuoteStatus(quoteId: string, status: QuoteStatusValue) {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  if (!QUOTE_STATUS_VALUES.includes(status)) {
    return { error: "Invalid quote status." };
  }

  try {
    await withDatabaseRetry(async (client) => {
      // Status flip and structure linking commit together: a failure while
      // creating structures must not leave the quote marked WON with a
      // partially linked line set.
      await client.$transaction(async (tx) => {
        const existing = await tx.quote.findUnique({
          where: { id: quoteId },
          select: { sentAt: true },
        });

        if (!existing) {
          throw new Error("Quote was not found.");
        }

        await tx.quote.update({
          where: { id: quoteId },
          data: {
            status,
            ...(status === "SENT" && !existing.sentAt
              ? { sentAt: new Date() }
              : {}),
          },
        });

        if (status === "WON") {
          const { linkJobStructuresFromQuoteInTransaction } = await import(
            "@/lib/job-structure-workflow"
          );
          await linkJobStructuresFromQuoteInTransaction(tx, quoteId);
        }
      });
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

export async function searchCustomersForQuoteForm(
  query: string,
): Promise<QuoteFormCustomerOption[]> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const trimmed = query.trim();
  const customers = await withDatabaseRetry((client) =>
    client.customer.findMany({
      where: trimmed
        ? { name: { contains: trimmed, mode: "insensitive" } }
        : {},
      orderBy: { name: "asc" },
      take: 20,
      select: QUOTE_FORM_CUSTOMER_SELECT,
    }),
  );

  return customers.map(mapCustomerToQuoteFormOption);
}

export async function getCustomerForQuoteForm(
  customerId: string,
): Promise<QuoteFormCustomerOption | null> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  if (!customerId.trim()) {
    return null;
  }

  const customer = await withDatabaseRetry((client) =>
    client.customer.findUnique({
      where: { id: customerId },
      select: QUOTE_FORM_CUSTOMER_SELECT,
    }),
  );

  return customer ? mapCustomerToQuoteFormOption(customer) : null;
}

export async function searchJobsForQuoteForm(
  query: string,
): Promise<QuoteFormJobOption[]> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const trimmed = query.trim();
  const jobs = await withDatabaseRetry((client) =>
    client.job.findMany({
      where: trimmed
        ? {
            OR: [
              { jobNumber: { contains: trimmed, mode: "insensitive" } },
              { projectName: { contains: trimmed, mode: "insensitive" } },
              { customerName: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: [{ year: "desc" }, { sequenceNumber: "desc" }],
      take: 20,
      select: QUOTE_FORM_JOB_SELECT,
    }),
  );

  return jobs.map(mapJobToQuoteFormOption);
}

export async function searchProductsForQuoteForm(
  query: string,
  kindFilter: "PHYSICAL" | "CONFIGURABLE",
  priceListId?: string | null,
  castingOrigin?: "DOMESTIC" | "IMPORTED" | null,
  categoryId?: string | null,
  subcategoryId?: string | null,
): Promise<QuoteFormProductOption[]> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const trimmed = query.trim();
  const resolvedCategoryId = categoryId?.trim() || null;
  const resolvedSubcategoryId = subcategoryId?.trim() || null;

  const products = await withDatabaseRetry((client) =>
    client.product.findMany({
      where: {
        productType:
          kindFilter === "CONFIGURABLE"
            ? "CONFIGURABLE"
            : { in: [...PHYSICAL_PRODUCT_TYPES] },
        status: "ACTIVE",
        ...(trimmed
          ? {
              OR: [
                { productCode: { contains: trimmed, mode: "insensitive" } },
                { name: { contains: trimmed, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(castingOrigin
          ? {
              castingSupplier: { origin: castingOrigin },
            }
          : {}),
        ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
        ...(resolvedSubcategoryId ? { subcategoryId: resolvedSubcategoryId } : {}),
      },
      orderBy: { productCode: "asc" },
      take: resolvedCategoryId ? 150 : 50,
      select: QUOTE_PRODUCT_OPTION_SELECT,
    }),
  );

  const priceMap = priceListId
    ? await getProductPricesForList(
        products.map((product) => product.id),
        priceListId,
      )
    : new Map();

  const derivableAssemblyIds = products
    .filter((product) => isDerivableCastingAssembly(product))
    .map((product) => product.id);
  const derivedMap = derivableAssemblyIds.length
    ? await withDatabaseRetry((client) =>
        loadDerivedAssemblyValues(client, derivableAssemblyIds, priceListId),
      )
    : new Map();

  const options = products.map((product) => {
    const derived = derivedMap.get(product.id);
    const effectiveUnitPrice = isDerivableCastingAssembly(product)
      ? derived?.derivedUnitPrice != null
        ? { toString: () => String(derived.derivedUnitPrice) }
        : null
      : priceMap.get(product.id);
    const effectiveWeight =
      isDerivableCastingAssembly(product)
        ? { toString: () => String(derived?.derivedWeight ?? 0) }
        : product.weight;

    return mapProductToQuoteFormOption(
      { ...product, weight: effectiveWeight },
      effectiveUnitPrice,
    );
  });

  if (kindFilter === "PHYSICAL") {
    // Match the previous page-level ordering: casting assemblies first.
    return options.sort((a, b) => {
      if (a.isCastingAssembly && !b.isCastingAssembly) {
        return -1;
      }
      if (!a.isCastingAssembly && b.isCastingAssembly) {
        return 1;
      }
      return a.code.localeCompare(b.code);
    });
  }

  return options;
}

export async function reloadQuoteFormPriceOptions(priceListId: string | null) {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  const appSettings = await withDatabaseRetry((client) =>
    client.appSettings.findUnique({
      where: { id: "default" },
      select: { ringBuilderConfig: true },
    }),
  );
  const { loadQuoteFormPriceOptions } = await import("@/app/quotes/quote-form-data");
  const { parseRingBuilderConfig } = await import("@/lib/ring-builder-settings");
  const ringBuilderConfig = parseRingBuilderConfig(appSettings?.ringBuilderConfig);
  return loadQuoteFormPriceOptions(priceListId, ringBuilderConfig);
}

export async function listPriceListsForForm() {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  return withDatabaseRetry((client) =>
    client.priceList.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
  );
}

export async function reviseQuote(
  quoteId: string,
): Promise<{ success: true; newQuoteId: string } | { error: string }> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  try {
    const newQuoteId = await withDatabaseRetry(async (client) => {
      const { reviseQuoteInTransaction } = await import("@/lib/quote-revision");
      // A concurrent commit can take the same quote number or revision slot
      // (P2002) mid-transaction. Re-running the whole transaction regenerates
      // both against the now-committed state; the CAS inside converts a true
      // duplicate revision into a friendly "already revised" error.
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await client.$transaction((tx) =>
            reviseQuoteInTransaction(tx, quoteId),
          );
        } catch (error) {
          if (isQuoteNumberConflict(error) && attempt < 2) {
            continue;
          }
          throw error;
        }
      }
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath(`/quotes/${newQuoteId}`);
    revalidatePath("/production");

    return { success: true, newQuoteId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not revise quote. Please try again.",
    };
  }
}
