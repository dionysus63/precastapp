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
import { writeAuditLog } from "@/lib/auth/audit";
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
  isPartsModeCastingAssembly,
  loadDerivedAssemblyValues,
  resolveEffectiveAssemblyWeight,
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
import {
  makeGalleyFamilyOptionId,
  stripGalleyTypeSuffix,
} from "@/lib/galley-utils";
import { generateQuoteNumber } from "@/lib/quote-number";
import { promoteJobStatus } from "@/lib/job-status-workflow";
import { linkPlanSheetToQuote } from "@/app/quotes/plan-sheet-actions";
import { computeMoneyTotals } from "@/lib/money";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";
import { computeQuoteTotalsFromLines } from "@/lib/quote-copy";
import { getAppSettings } from "@/lib/app-settings";
import {
  isNonBillableLineItem,
  resolveQuoteLineQuantityForStorage,
} from "@/lib/quotes/constants";
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
  /** Family-total galley line: productId stays null until award breakdown. */
  galleyFamilyCode?: string | null;
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
  fob: string | null;
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
    (line) => !isNonBillableLineItem(line.lineType),
  );
  if (billableLines.length === 0) {
    throw new Error(
      "Add at least one billable line item (not only categories, notes, or page breaks).",
    );
  }

  if (input.taxRate < 0) {
    throw new Error("Tax rate cannot be negative.");
  }

  for (const line of input.lineItems) {
    if (line.lineType === "PAGE_BREAK") {
      continue;
    }
    if (line.lineType === "CATEGORY" || line.lineType === "NOTE") {
      if (!line.description.trim()) {
        throw new Error(
          `Line ${line.lineNumber}: ${line.lineType === "NOTE" ? "note text" : "category name"} is required.`,
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

    if (line.galleyFamilyCode) {
      if (line.productId) {
        throw new Error(
          `Line ${line.lineNumber}: a galley family total cannot also reference a specific product.`,
        );
      }
      if (!Number.isInteger(line.quantity)) {
        throw new Error(
          `Line ${line.lineNumber}: galley quantity must be a whole number.`,
        );
      }
    }
  }

  if (!QUOTE_STATUSES.includes(input.status)) {
    throw new Error("Invalid quote status.");
  }

  if (!QUOTE_TYPES.includes(input.quoteType)) {
    throw new Error("Invalid quote type.");
  }
}

/** Every family-total line must point at a family that still has active SKUs. */
async function assertGalleyFamiliesExist(input: CreateQuoteInput) {
  const codes = [
    ...new Set(
      input.lineItems
        .map((line) => line.galleyFamilyCode)
        .filter((code): code is string => Boolean(code)),
    ),
  ];
  if (codes.length === 0) {
    return;
  }
  const { loadGalleyFamilies } = await import("@/lib/galley-service");
  const families = await withDatabaseRetry((client) =>
    loadGalleyFamilies(client, codes),
  );
  for (const code of codes) {
    if (!families.has(code)) {
      throw new Error(
        `Galley family "${code}" has no active products — check the product catalog.`,
      );
    }
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
    (line) => !isNonBillableLineItem(line.lineType),
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
    if (isNonBillableLineItem(line.lineType)) {
      return new Prisma.Decimal(0);
    }
    const total = computed.lineTotals[billableIndex]!;
    billableIndex += 1;
    return total;
  });

  const totalWeight = input.lineItems.reduce(
    (sum, line) => {
      if (isNonBillableLineItem(line.lineType)) {
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
      if (isNonBillableLineItem(line.lineType)) {
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

/** Where the browser lands after a successful save. */
export type QuoteSaveDestination = "detail" | "preview" | "send";

function quoteSaveRedirectPath(
  quoteId: string,
  afterSave: QuoteSaveDestination,
): string {
  switch (afterSave) {
    case "preview":
      return `/quotes/${quoteId}/preview`;
    // Detail page auto-opens the send dialog when ?send=1 is present.
    case "send":
      return `/quotes/${quoteId}?send=1`;
    default:
      return `/quotes/${quoteId}`;
  }
}

export async function createQuote(
  input: CreateQuoteInput,
  afterSave: QuoteSaveDestination = "detail",
): Promise<{ error: string } | never> {
  const actor = await requirePermission(AppPermission.QUOTES_MANAGE);
  try {
    validateCreateQuoteInput(input);
    await assertGalleyFamiliesExist(input);

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
        fob: input.fob,
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
            galleyFamilyCode: line.productId
              ? null
              : (line.galleyFamilyCode ?? null),
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
    redirect(quoteSaveRedirectPath(quote.id, afterSave));
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
  afterSave: QuoteSaveDestination = "detail",
): Promise<{ error: string } | never> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  if (!quoteId.trim()) {
    return { error: "Quote id is required." };
  }

  try {
    validateCreateQuoteInput(input);
    await assertGalleyFamiliesExist(input);

    const existing = await withDatabaseRetry((client) =>
      client.quote.findUnique({
        where: { id: quoteId },
        select: {
          id: true,
          status: true,
          jobId: true,
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
    let supersededWonQuoteIds: string[] = [];

    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const {
          assertRevisionKeepsOperationalJob,
          lockQuoteForUpdate,
          supersedeOtherWonQuotesInFamily,
        } = await import("@/lib/quote-revision");
        await lockQuoteForUpdate(tx, quoteId);

        // The preflight read above gives fast feedback, but this locked read is
        // authoritative. It serializes a normal edit with a simultaneous
        // "Mark Won" handoff so neither can validate stale lines or status.
        const lockedExisting = await tx.quote.findUnique({
          where: { id: quoteId },
          select: {
            status: true,
            jobId: true,
            originalQuoteId: true,
            revisionNumber: true,
            updatedAt: true,
          },
        });
        if (!lockedExisting) {
          throw new Error("Quote was not found.");
        }

        let lockedSupersededBy: { id: string } | null = null;
        if (lockedExisting.status === "REVISED") {
          const rootId = lockedExisting.originalQuoteId ?? quoteId;
          lockedSupersededBy = await tx.quote.findFirst({
            where: {
              OR: [{ id: rootId }, { originalQuoteId: rootId }],
              revisionNumber: { gt: lockedExisting.revisionNumber },
            },
            orderBy: { revisionNumber: "asc" },
            select: { id: true },
          });
        }
        if (!canEditQuote(lockedExisting.status, lockedSupersededBy)) {
          throw new Error(
            "This quote can no longer be edited. Revise it to create a new revision instead.",
          );
        }

        if (input.expectedUpdatedAt) {
          // Lines are replaced wholesale below, so a stale save would silently
          // discard another estimator's edits. Compare millisecond timestamps
          // to detect a concurrent change since the form loaded.
          const expected = new Date(input.expectedUpdatedAt);
          if (
            Number.isNaN(expected.getTime()) ||
            lockedExisting.updatedAt.getTime() !== expected.getTime()
          ) {
            throw new Error(
              "This quote was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.",
            );
          }
        }

        if (input.status === "WON") {
          const rootId = lockedExisting.originalQuoteId ?? quoteId;
          const newer = await tx.quote.findFirst({
            where: {
              OR: [{ id: rootId }, { originalQuoteId: rootId }],
              revisionNumber: { gt: lockedExisting.revisionNumber },
            },
            orderBy: { revisionNumber: "asc" },
            select: { quoteNumber: true },
          });
          if (newer) {
            throw new Error(
              `This quote was revised — mark ${newer.quoteNumber} as won instead, or delete that revision first to fall back to this one.`,
            );
          }
        }

        await assertRevisionKeepsOperationalJob(
          tx,
          quoteId,
          lockedExisting.originalQuoteId,
          input.jobId,
        );

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
          // Sequential awaits: a transaction client is pinned to one pg
          // connection, so concurrent queries on it are unsupported.
          const ticketRefs = await tx.deliveryTicketLineItem.count({
            where: { quoteLineItemId: { in: priorLineIds } },
          });
          const invoiceRefs = await tx.invoiceLineItem.count({
            where: { quoteLineItemId: { in: priorLineIds } },
          });
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
            fob: input.fob,
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
                  galleyFamilyCode: line.productId
                    ? null
                    : (line.galleyFamilyCode ?? null),
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

        if (input.status === "WON") {
          supersededWonQuoteIds = await supersedeOtherWonQuotesInFamily(
            tx,
            quoteId,
            lockedExisting.originalQuoteId,
          );

          const { linkJobStructuresFromQuoteInTransaction } = await import(
            "@/lib/job-structure-workflow"
          );
          await linkJobStructuresFromQuoteInTransaction(tx, quoteId);

          if (input.jobId) {
            await promoteJobStatus(tx, input.jobId, "QUOTE_WON");
            if (input.customerId) {
              await tx.job.updateMany({
                where: {
                  id: input.jobId,
                  customerId: null,
                  customerName: "Unassigned",
                },
                data: {
                  customerId: input.customerId,
                  customerName: input.customerName,
                },
              });
            }
          }
        }
      }),
    );

    await linkPlanSheetToQuote(input.planSheetId, quoteId, input.jobId);

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath(`/quotes/${quoteId}/preview`);
    revalidatePath(`/quotes/${quoteId}/edit`);
    for (const supersededQuoteId of supersededWonQuoteIds) {
      revalidatePath(`/quotes/${supersededQuoteId}`);
    }
    if (input.status === "WON") {
      revalidatePath("/production");
      revalidatePath("/jobs");
      if (input.jobId) {
        revalidatePath(`/jobs/${input.jobId}`);
      }
    }
    redirect(quoteSaveRedirectPath(quoteId, afterSave));
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
  if (!QUOTE_STATUS_VALUES.includes(status) || status !== "WON") {
    return { error: "This action can only mark a quote as won." };
  }

  try {
    let jobId: string | null = null;
    let supersededWonQuoteIds: string[] = [];
    await withDatabaseRetry(async (client) => {
      // Status flip and structure linking commit together: a failure while
      // creating structures must not leave the quote marked WON with a
      // partially linked line set.
      await client.$transaction(async (tx) => {
        const { lockQuoteForUpdate, supersedeOtherWonQuotesInFamily } =
          await import("@/lib/quote-revision");
        await lockQuoteForUpdate(tx, quoteId);

        const existing = await tx.quote.findUnique({
          where: { id: quoteId },
          select: {
            jobId: true,
            customerId: true,
            customerName: true,
            originalQuoteId: true,
            revisionNumber: true,
          },
        });

        if (!existing) {
          throw new Error("Quote was not found.");
        }
        jobId = existing.jobId;

        // A superseded quote must not be won — its structure links belong to
        // the newest revision's lineage. Fall back by deleting the revision
        // first if the old version is really the one that won.
        if (status === "WON") {
          const rootId = existing.originalQuoteId ?? quoteId;
          const newer = await tx.quote.findFirst({
            where: {
              OR: [{ id: rootId }, { originalQuoteId: rootId }],
              revisionNumber: { gt: existing.revisionNumber },
            },
            orderBy: { revisionNumber: "asc" },
            select: { quoteNumber: true },
          });
          if (newer) {
            throw new Error(
              `This quote was revised — mark ${newer.quoteNumber} as won instead, or delete that revision first to fall back to this one.`,
            );
          }
        }

        if (status === "WON") {
          // A won source remains the job's operational quote while this
          // revision is being prepared. Transfer that ownership only when the
          // replacement itself wins, in the same transaction as structure
          // relinking so a failed handoff rolls back both status changes.
          supersededWonQuoteIds = await supersedeOtherWonQuotesInFamily(
            tx,
            quoteId,
            existing.originalQuoteId,
          );
        }

        await tx.quote.update({
          where: { id: quoteId },
          data: { status },
        });

        if (status === "WON") {
          const { linkJobStructuresFromQuoteInTransaction } = await import(
            "@/lib/job-structure-workflow"
          );
          await linkJobStructuresFromQuoteInTransaction(tx, quoteId);
        }

        // Workflow-driven job status: winning a quote moves the job to
        // Awarded (earlier pipeline stages only — manual choices are never
        // overridden).
        if (existing.jobId && status === "WON") {
          await promoteJobStatus(tx, existing.jobId, "QUOTE_WON");
          if (existing.customerId) {
            // A job with no contractor yet adopts the winning quote's.
            await tx.job.updateMany({
              where: {
                id: existing.jobId,
                customerId: null,
                customerName: "Unassigned",
              },
              data: {
                customerId: existing.customerId,
                customerName: existing.customerName,
              },
            });
          }
        }
      });
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    for (const supersededQuoteId of supersededWonQuoteIds) {
      revalidatePath(`/quotes/${supersededQuoteId}`);
    }
    revalidatePath("/production");
    if (jobId) {
      revalidatePath("/jobs");
      revalidatePath(`/jobs/${jobId}`);
    }
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update quote status.",
    };
  }
}

/**
 * Set the customer PO number on a quote at any status. The PO typically
 * arrives after the quote is won and locked, so this deliberately bypasses
 * the full-edit lock while touching nothing but the PO field.
 */
export async function updateQuoteCustomerPo(
  quoteId: string,
  customerPo: string,
): Promise<{ success: true } | { error: string }> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  const trimmed = customerPo.trim();
  if (trimmed.length > 100) {
    return { error: "PO number is too long." };
  }

  try {
    const quote = await withDatabaseRetry((client) =>
      client.quote.update({
        where: { id: quoteId },
        data: { customerPO: trimmed || null },
        select: { id: true, jobId: true },
      }),
    );
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/quotes");
    if (quote.jobId) {
      revalidatePath(`/jobs/${quote.jobId}`);
    }
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save the PO.",
    };
  }
}

/**
 * Flip a quote's sales tax without unlocking the full editor — the tax
 * exempt certificate usually arrives after the quote is won (same lock
 * bypass as the customer PO). Exempt zeroes the rate; un-exempt restores
 * the app default. Stored totals recompute; line totals are pre-tax and
 * unchanged. Invoices created afterward pick up the new rate.
 */
export async function setQuoteTaxExempt(
  quoteId: string,
  exempt: boolean,
): Promise<{ success: true } | { error: string }> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  try {
    const appSettings = await getAppSettings();
    const newRate = exempt ? 0 : appSettings.defaultTaxRate;

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        lineItems: { orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }] },
      },
    });
    if (!quote) {
      return { error: "Quote not found." };
    }

    const { computed } = computeQuoteTotalsFromLines(
      quote.lineItems,
      new Prisma.Decimal(newRate),
      quote.discountAmount,
    );

    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        taxRate: new Prisma.Decimal(newRate),
        taxableAmount: computed.taxableAmount,
        salesTax: computed.salesTax,
        total: computed.total,
      },
    });

    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/quotes");
    if (quote.jobId) {
      revalidatePath(`/jobs/${quote.jobId}`);
    }
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update the tax.",
    };
  }
}

export type DeleteQuoteResult = { success: true } | { error: string };

export async function deleteQuote(quoteId: string): Promise<DeleteQuoteResult> {
  const user = await requirePermission(AppPermission.QUOTES_MANAGE);

  const quote = await withDatabaseRetry((client) =>
    client.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        jobId: true,
        customerName: true,
      },
    }),
  );
  if (!quote) {
    return { error: "Quote was not found." };
  }
  if (quote.status === "WON") {
    return {
      error:
        "Won quotes anchor the job's structures and progress — revise the quote or mark it Lost instead of deleting it.",
    };
  }

  try {
    const result = await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        // Structures and plan sheets reachable only through this quote (no
        // job) would be orphaned by the SetNull FK — remove them with it.
        // Job-linked ones survive and just lose the quote link.
        const structuresDeleted = await tx.jobStructure.deleteMany({
          where: { quoteId, jobId: null },
        });
        const planSheetsDeleted = await tx.planSheet.deleteMany({
          where: { quoteId, jobId: null },
        });
        await tx.quote.delete({ where: { id: quoteId } });
        return {
          structuresDeleted: structuresDeleted.count,
          planSheetsDeleted: planSheetsDeleted.count,
        };
      }),
    );

    await writeAuditLog({
      userId: user.id,
      action: "quote.delete",
      entityType: "Quote",
      entityId: quoteId,
      summary: `${user.displayName} deleted quote ${quote.quoteNumber} (${quote.customerName}, status ${quote.status})`,
      metadata: {
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        structuresDeleted: result.structuresDeleted,
        planSheetsDeleted: result.planSheetsDeleted,
      },
    });

    revalidatePath("/quotes");
    revalidatePath("/production");
    if (quote.jobId) {
      revalidatePath(`/jobs/${quote.jobId}`);
    }
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not delete the quote.",
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

  const partsAssemblyIds = products
    .filter((product) => isPartsModeCastingAssembly(product))
    .map((product) => product.id);
  const derivedMap = partsAssemblyIds.length
    ? await withDatabaseRetry((client) =>
        loadDerivedAssemblyValues(client, partsAssemblyIds),
      )
    : new Map();

  const options = products.map((product) => {
    const effectiveWeight = resolveEffectiveAssemblyWeight(
      product,
      derivedMap.get(product.id),
    );

    return mapProductToQuoteFormOption(
      {
        ...product,
        weight:
          effectiveWeight != null
            ? { toString: () => String(effectiveWeight) }
            : null,
      },
      priceMap.get(product.id),
    );
  });

  if (kindFilter === "PHYSICAL") {
    // Match the previous page-level ordering: casting assemblies first.
    options.sort((a, b) => {
      if (a.isCastingAssembly && !b.isCastingAssembly) {
        return -1;
      }
      if (!a.isCastingAssembly && b.isCastingAssembly) {
        return 1;
      }
      return a.code.localeCompare(b.code);
    });
    return injectGalleyFamilyOptions(options, products);
  }

  return options;
}

/**
 * Prepends one synthetic "family total" option ahead of each galley trio in
 * the picker results. The estimator quotes the total count per height; the
 * End/Middle/CB split happens on award. Individual SKUs stay listed for
 * direct quoting.
 */
function injectGalleyFamilyOptions(
  options: QuoteFormProductOption[],
  products: Array<{
    id: string;
    name: string;
    unit: string;
    taxable: boolean;
    galleyFamilyCode: string | null;
    galleyType: string | null;
  }>,
): QuoteFormProductOption[] {
  const familyByCode = new Map<
    string,
    { name: string; memberIds: string[] }
  >();
  for (const product of products) {
    if (!product.galleyFamilyCode || !product.galleyType) {
      continue;
    }
    const family = familyByCode.get(product.galleyFamilyCode) ?? {
      name: stripGalleyTypeSuffix(product.name),
      memberIds: [],
    };
    family.memberIds.push(product.id);
    familyByCode.set(product.galleyFamilyCode, family);
  }
  if (familyByCode.size === 0) {
    return options;
  }

  const optionById = new Map(options.map((option) => [option.id, option]));
  const result: QuoteFormProductOption[] = [];
  const injected = new Set<string>();
  for (const option of options) {
    const memberProduct = products.find((product) => product.id === option.id);
    const familyCode = memberProduct?.galleyFamilyCode ?? null;
    if (familyCode && !injected.has(familyCode)) {
      injected.add(familyCode);
      const family = familyByCode.get(familyCode)!;
      const members = family.memberIds
        .map((id) => optionById.get(id))
        .filter((member): member is QuoteFormProductOption => Boolean(member));
      // Members share price/weight by convention; max() keeps a stray
      // mismatch from underquoting.
      const unitPrice = Math.max(0, ...members.map((member) => member.unitPrice));
      const weightLb = Math.max(0, ...members.map((member) => member.weightLb));
      const yards = Math.max(0, ...members.map((member) => member.yards));
      result.push({
        id: makeGalleyFamilyOptionId(familyCode),
        code: familyCode,
        name: family.name,
        description: `${family.name} — total count (End/Middle/CB split on award)`,
        category: option.category,
        subcategory: option.subcategory,
        unit: option.unit,
        unitPrice,
        weightLb,
        yards,
        taxable: option.taxable,
        galleyFamilyCode: familyCode,
      });
    }
    result.push(option);
  }
  return result;
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
