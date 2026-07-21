import { randomUUID } from "crypto";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import { getDefaultPriceListId } from "@/lib/price-list-service";
import { defaultInvoiceDueDate, getAppSettings } from "@/lib/app-settings";
import { deriveInvoiceNumberFromTicket } from "@/lib/delivery-ticket-number";
import {
  removeAdsJointTypeSuffix,
  removeTrailingRingHeightSuffix,
} from "@/lib/delivery-ticket-pdf-data";
import { computeMoneyTotals } from "@/lib/money";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";

function mapDeliveryLineTypeToInvoiceLineType(
  lineType: string,
): "STOCK_PRODUCT" | "CONFIGURABLE_STRUCTURE" | "CUSTOM_STRUCTURE" | "SERVICE" | "MISC" {
  if (
    lineType === "STOCK_PRODUCT" ||
    lineType === "CONFIGURABLE_STRUCTURE" ||
    lineType === "CUSTOM_STRUCTURE" ||
    lineType === "SERVICE" ||
    lineType === "MISC"
  ) {
    return lineType;
  }
  return "MISC";
}

/** Thrown when a concurrent conversion already invoiced the ticket; carries
 * the existing invoice id so callers can treat the outcome as success. */
export class InvoiceAlreadyExistsError extends Error {
  constructor(public readonly invoiceId: string | null) {
    super("An invoice already exists for this ticket.");
    this.name = "InvoiceAlreadyExistsError";
  }
}

export type BatchInvoiceConversionResult = {
  created: number;
  alreadyInvoiced: number;
  skipped: Array<{
    ticketId: string;
    ticketNumber: string;
    reason: string;
  }>;
};

/**
 * Convert multiple delivered tickets to invoices. Skips tickets that already
 * have an invoice or fail price resolution; collects per-ticket errors.
 */
export async function batchConvertDeliveredTicketsToInvoices(
  client: PrismaClient,
  ticketIds: string[],
): Promise<BatchInvoiceConversionResult> {
  const result: BatchInvoiceConversionResult = {
    created: 0,
    alreadyInvoiced: 0,
    skipped: [],
  };

  const uniqueIds = [...new Set(ticketIds)];

  for (const ticketId of uniqueIds) {
    const ticket = await client.deliveryTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        invoice: { select: { id: true } },
      },
    });

    if (!ticket) {
      continue;
    }

    if (ticket.invoice) {
      result.alreadyInvoiced += 1;
      continue;
    }

    if (ticket.status !== "DELIVERED") {
      result.skipped.push({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        reason: "Ticket is not delivered.",
      });
      continue;
    }

    try {
      await convertDeliveryTicketToInvoice(client, ticketId);
      result.created += 1;
    } catch (error) {
      if (error instanceof InvoiceAlreadyExistsError) {
        result.alreadyInvoiced += 1;
        continue;
      }
      result.skipped.push({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        reason:
          error instanceof Error ? error.message : "Could not create invoice.",
      });
    }
  }

  return result;
}

async function nextInvoiceNumber(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<{
  invoiceNumber: string;
  year: number;
  yearTwoDigit: number;
  sequenceNumber: number;
}> {
  const now = new Date();
  const year = now.getFullYear();
  const yearTwoDigit = year % 100;

  // Atomic INSERT ... ON CONFLICT (same pattern as job/delivery-ticket
  // sequences): concurrent first-of-year allocations serialize on the row
  // lock instead of racing a Prisma upsert's separate create path.
  const rows = await client.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "InvoiceSequence" ("id", "year", "lastNumber", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${year}, 1, NOW(), NOW())
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = "InvoiceSequence"."lastNumber" + 1, "updatedAt" = NOW()
    RETURNING "lastNumber"
  `;

  const sequenceNumber = Number(rows[0].lastNumber);
  const invoiceNumber = `INV-${String(yearTwoDigit).padStart(2, "0")}-${String(sequenceNumber).padStart(3, "0")}`;

  return { invoiceNumber, year, yearTwoDigit, sequenceNumber };
}

/**
 * Drain-ring pool quote lines are priced per VERTICAL FOOT, but their ring
 * ticket lines carry per-piece counts (4 x "10'Ø x 5' Drain Ring"). Bill
 * each ring at its height x the VF price so qty x unit price equals what
 * actually shipped — mirrors the shipped-feet fulfillment math in
 * delivery-fulfillment. A missing/zero product height falls back to the raw
 * quote price rather than billing $0.
 */
export function ringPieceUnitPrice(
  vfUnitPrice: Prisma.Decimal,
  heightFeet: Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  if (heightFeet == null) {
    return vfUnitPrice;
  }
  const height = Number(heightFeet);
  if (!Number.isFinite(height) || height <= 0) {
    return vfUnitPrice;
  }
  return vfUnitPrice.mul(heightFeet);
}

async function resolveUnitPrice(
  client: PrismaClient | Prisma.TransactionClient,
  ticketLine: {
    lineType: string;
    productId: string | null;
    quoteLineItemId: string | null;
    itemCode: string;
  },
  quoteId: string | null,
  priceListId: string | null,
  preloaded?: UnitPriceLookups,
): Promise<{ unitPrice: Prisma.Decimal; taxable: boolean; resolved: boolean }> {
  if (ticketLine.quoteLineItemId) {
    const quoteLine = preloaded?.quoteLines.get(ticketLine.quoteLineItemId);
    if (quoteLine) {
      return {
        unitPrice:
          quoteLine.isDrainRing && ticketLine.productId
            ? ringPieceUnitPrice(
                quoteLine.unitPrice,
                preloaded?.productHeights.get(ticketLine.productId),
              )
            : quoteLine.unitPrice,
        taxable: quoteLine.taxable,
        resolved: true,
      };
    }
    if (!preloaded) {
      const fetched = await client.quoteLineItem.findUnique({
        where: { id: ticketLine.quoteLineItemId },
        select: { unitPrice: true, taxable: true, isDrainRing: true },
      });
      if (fetched) {
        let unitPrice = fetched.unitPrice;
        if (fetched.isDrainRing && ticketLine.productId) {
          const product = await client.product.findUnique({
            where: { id: ticketLine.productId },
            select: { heightFeet: true },
          });
          unitPrice = ringPieceUnitPrice(unitPrice, product?.heightFeet);
        }
        return {
          unitPrice,
          taxable: fetched.taxable,
          resolved: true,
        };
      }
    }
  }

  if (ticketLine.productId && priceListId) {
    const priceListItem = preloaded?.priceListItems.get(ticketLine.productId);
    if (priceListItem) {
      return { unitPrice: priceListItem.unitPrice, taxable: true, resolved: true };
    }
    if (!preloaded) {
      const fetched = await client.priceListItem.findUnique({
        where: {
          priceListId_productId: {
            priceListId,
            productId: ticketLine.productId,
          },
        },
      });
      if (fetched) {
        return { unitPrice: fetched.unitPrice, taxable: true, resolved: true };
      }
    }
  }

  // No quote line or price-list entry. Signal unresolved so the caller can
  // fail closed instead of billing at $0.
  return { unitPrice: new Prisma.Decimal(0), taxable: true, resolved: false };
}

type UnitPriceLookups = {
  quoteLines: Map<
    string,
    { unitPrice: Prisma.Decimal; taxable: boolean; isDrainRing: boolean }
  >;
  priceListItems: Map<string, { unitPrice: Prisma.Decimal }>;
  /** Ring heights for per-piece pricing against per-VF drain-ring lines. */
  productHeights: Map<string, Prisma.Decimal | null>;
};

async function preloadUnitPriceLookups(
  client: PrismaClient | Prisma.TransactionClient,
  ticketLines: Array<{
    productId: string | null;
    quoteLineItemId: string | null;
  }>,
  priceListId: string | null,
): Promise<UnitPriceLookups> {
  const quoteLineItemIds = [
    ...new Set(
      ticketLines
        .map((line) => line.quoteLineItemId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const productIds = [
    ...new Set(
      ticketLines
        .map((line) => line.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  // Sequential awaits: `client` may be a transaction client, which is pinned
  // to a single pg connection — concurrent queries on it are unsupported
  // (deprecated in pg 8, removed in pg 9).
  const quoteLines =
    quoteLineItemIds.length > 0
      ? await client.quoteLineItem.findMany({
          where: { id: { in: quoteLineItemIds } },
          select: { id: true, unitPrice: true, taxable: true, isDrainRing: true },
        })
      : [];
  const priceListItems =
    priceListId && productIds.length > 0
      ? await client.priceListItem.findMany({
          where: {
            priceListId,
            productId: { in: productIds },
          },
          select: { productId: true, unitPrice: true },
        })
      : [];
  const products =
    productIds.length > 0
      ? await client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, heightFeet: true },
        })
      : [];

  return {
    quoteLines: new Map(
      quoteLines.map((line) => [
        line.id,
        {
          unitPrice: line.unitPrice,
          taxable: line.taxable,
          isDrainRing: line.isDrainRing,
        },
      ]),
    ),
    priceListItems: new Map(
      priceListItems.map((item) => [item.productId, { unitPrice: item.unitPrice }]),
    ),
    productHeights: new Map(
      products.map((product) => [product.id, product.heightFeet]),
    ),
  };
}

/**
 * For a delivered customer-pickup ticket marked "pay now", create the invoice
 * automatically. Returns the (existing or new) invoice id, or a soft error
 * message so the caller can surface a warning without failing completion.
 */
export async function maybeCreatePayNowInvoiceForTicket(
  client: PrismaClient,
  deliveryTicketId: string,
): Promise<{ invoiceId: string | null; error: string | null }> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: deliveryTicketId },
    select: {
      status: true,
      fulfillmentMethod: true,
      paymentMethod: true,
      invoice: { select: { id: true } },
    },
  });

  if (
    !ticket ||
    ticket.status !== "DELIVERED" ||
    ticket.fulfillmentMethod !== "PICKUP" ||
    ticket.paymentMethod !== "PAY_NOW"
  ) {
    return { invoiceId: null, error: null };
  }

  if (ticket.invoice) {
    return { invoiceId: ticket.invoice.id, error: null };
  }

  try {
    const invoiceId = await convertDeliveryTicketToInvoice(
      client,
      deliveryTicketId,
    );
    return { invoiceId, error: null };
  } catch (error) {
    // A concurrent caller already created it — that is a success for us.
    if (error instanceof InvoiceAlreadyExistsError) {
      return { invoiceId: error.invoiceId, error: null };
    }
    return {
      invoiceId: null,
      error:
        error instanceof Error
          ? error.message
          : "Could not auto-create the pay-now invoice.",
    };
  }
}

/**
 * Create one invoice from a delivered delivery ticket (1:1).
 */
export async function convertDeliveryTicketToInvoice(
  client: PrismaClient,
  deliveryTicketId: string,
): Promise<string> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: deliveryTicketId },
    include: {
      lineItems: { orderBy: { lineNumber: "asc" } },
      invoice: { select: { id: true } },
      quote: { select: { id: true, taxRate: true } },
    },
  });

  if (!ticket) {
    throw new Error("Delivery ticket not found.");
  }

  if (ticket.status !== "DELIVERED") {
    throw new Error("Ticket must be delivered before invoicing.");
  }

  if (ticket.invoice) {
    throw new InvoiceAlreadyExistsError(ticket.invoice.id);
  }

  const isPaidWalkIn =
    ticket.paymentMethod === "PAY_NOW" && ticket.paymentReceived === true;
  const invoiceStatus = isPaidWalkIn ? "PAID" : "DRAFT";
  const invoiceDate = isPaidWalkIn
    ? (ticket.deliveredAt ?? new Date())
    : new Date();

  const settings = await getAppSettings();
  const dueDate = defaultInvoiceDueDate(settings.invoiceDueDays);
  const resolvedPriceListId =
    ticket.priceListId ?? (await getDefaultPriceListId(client));

  // Price resolution, total computation, numbering, and the insert all run in
  // ONE transaction so a concurrent price-list/quote/product edit can't be
  // half-applied to the stored invoice.
  const invoice = await client.$transaction(async (tx) => {
    // Re-check inside the transaction: the read above happened outside it,
    // so a concurrent conversion may have created the invoice in between.
    // The @unique on deliveryTicketId is the last line of defense (P2002).
    const current = await tx.deliveryTicket.findUnique({
      where: { id: deliveryTicketId },
      select: {
        status: true,
        invoice: { select: { id: true } },
        quote: { select: { taxRate: true } },
        lineItems: { orderBy: { lineNumber: "asc" } },
      },
    });
    if (!current || current.status !== "DELIVERED") {
      throw new Error("Ticket must be delivered before invoicing.");
    }
    if (current.invoice) {
      throw new InvoiceAlreadyExistsError(current.invoice.id);
    }

    // Fall back to the configured default tax rate when the ticket has no
    // linked quote, so taxable customers aren't silently billed at 0%.
    const taxRate =
      current.quote?.taxRate ?? new Prisma.Decimal(settings.defaultTaxRate);

    const priceLookups = await preloadUnitPriceLookups(
      tx,
      current.lineItems,
      resolvedPriceListId,
    );

    const resolvedLines: Array<{
      line: (typeof current.lineItems)[number];
      unitPrice: Prisma.Decimal;
      taxable: boolean;
      description: string | null;
    }> = [];

    for (const line of current.lineItems) {
      const { unitPrice, taxable, resolved } = await resolveUnitPrice(
        tx,
        line,
        ticket.quoteId,
        resolvedPriceListId,
        priceLookups,
      );

      if (!resolved) {
        throw new Error(
          `No price found for line "${line.itemCode}". Set a unit price via the quote or price list before invoicing.`,
        );
      }

      // Ticket lines carry editor-only suffixes ("(5' ring)", ADS joint
      // types); invoices store the clean customer-facing description.
      const cleanDescription = line.description
        ? removeAdsJointTypeSuffix(
            removeTrailingRingHeightSuffix(line.description),
          ) || null
        : null;
      resolvedLines.push({ line, unitPrice, taxable, description: cleanDescription });
    }

    // A split structure is billed exactly once across all its piece lines:
    // the first (non-void) invoice to carry any of its pieces bills the full
    // quote-line price; every other piece line bills $0 "(included)".
    const splitStructureIds = [
      ...new Set(
        current.lineItems
          .filter((line) => line.jobStructurePieceId && line.jobStructureId)
          .map((line) => line.jobStructureId as string),
      ),
    ];
    if (splitStructureIds.length > 0) {
      const billedElsewhere = await tx.invoiceLineItem.findMany({
        where: {
          unitPrice: { gt: 0 },
          invoice: { status: { not: "VOID" } },
          deliveryTicketLineItem: {
            jobStructurePieceId: { not: null },
            jobStructureId: { in: splitStructureIds },
          },
        },
        select: {
          deliveryTicketLineItem: { select: { jobStructureId: true } },
        },
      });
      const billedStructureIds = new Set<string>();
      for (const row of billedElsewhere) {
        if (row.deliveryTicketLineItem?.jobStructureId) {
          billedStructureIds.add(row.deliveryTicketLineItem.jobStructureId);
        }
      }

      for (const entry of resolvedLines) {
        const structureId = entry.line.jobStructureId;
        if (!entry.line.jobStructurePieceId || !structureId) {
          continue;
        }
        if (billedStructureIds.has(structureId)) {
          entry.unitPrice = new Prisma.Decimal(0);
          entry.description = entry.description
            ? `${entry.description} (included)`
            : "(included)";
        } else {
          // First piece of this structure on this invoice carries the price.
          billedStructureIds.add(structureId);
        }
      }
    }

    // Authoritative Decimal totals with shared cent-rounding (matches quotes).
    const computed = computeMoneyTotals(
      resolvedLines.map((entry) => ({
        quantity: entry.line.quantity,
        unitPrice: entry.unitPrice,
        taxable: entry.taxable,
      })),
      taxRate,
    );

    const lineData = resolvedLines.map((entry, index) => ({
      lineNumber: entry.line.lineNumber,
      lineType: mapDeliveryLineTypeToInvoiceLineType(entry.line.lineType),
      quoteLineItemId: entry.line.quoteLineItemId,
      deliveryTicketLineItemId: entry.line.id,
      productId: entry.line.productId,
      itemCode: entry.line.itemCode,
      description: entry.description,
      quantity: entry.line.quantity,
      unit: entry.line.unit,
      unitPrice: entry.unitPrice,
      taxable: entry.taxable,
      total: computed.lineTotals[index],
      sortOrder: entry.line.sortOrder,
    }));

    const deliveryAmount = computeDeliveryAmount(
      lineData.map((line) => ({
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: line.description,
      })),
      computed.lineTotals,
    );

    // Invoice number mirrors the ticket number (same digits, invoice
    // prefix): T10024 -> I10024. Legacy ticket formats fall back to the
    // year-based invoice sequence.
    const derived = deriveInvoiceNumberFromTicket(
      ticket.ticketNumber,
      settings.invoiceNumberPrefix,
    );
    const invoiceYear = invoiceDate.getFullYear();
    const numbering = derived
      ? {
          invoiceNumber: derived.invoiceNumber,
          year: invoiceYear,
          yearTwoDigit: invoiceYear % 100,
          sequenceNumber: derived.sequenceNumber,
        }
      : await nextInvoiceNumber(tx);
    return tx.invoice.create({
      data: {
        invoiceNumber: numbering.invoiceNumber,
        year: numbering.year,
        yearTwoDigit: numbering.yearTwoDigit,
        sequenceNumber: numbering.sequenceNumber,
        deliveryTicketId: ticket.id,
        jobId: ticket.jobId,
        quoteId: ticket.quoteId,
        customerId: ticket.customerId,
        jobNumber: ticket.jobNumber,
        customerName: ticket.customerName,
        projectName: ticket.projectName,
        status: invoiceStatus,
        subtotal: computed.subtotal,
        deliveryAmount,
        taxableAmount: computed.taxableAmount,
        taxRate,
        salesTax: computed.salesTax,
        total: computed.total,
        invoiceDate,
        dueDate: isPaidWalkIn ? invoiceDate : dueDate,
        lineItems: { create: lineData },
      },
      select: { id: true },
    });
  }).catch(async (error: unknown) => {
    // A concurrent conversion won the race between our in-transaction check
    // and the insert; surface it as the same typed "already exists" outcome.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await client.invoice.findUnique({
        where: { deliveryTicketId },
        select: { id: true },
      });
      throw new InvoiceAlreadyExistsError(existing?.id ?? null);
    }
    throw error;
  });

  return invoice.id;
}
