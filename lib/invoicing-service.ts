import { randomUUID } from "crypto";
import type {
  InvoiceStatus,
  PrismaClient,
} from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import { getDefaultPriceListId } from "@/lib/price-list-service";
import { getAppSettings } from "@/lib/app-settings";
import { startOfLocalDay } from "@/lib/date-only";
import { deriveInvoiceNumberFromTicket } from "@/lib/delivery-ticket-number";
import {
  removeAdsJointTypeSuffix,
  removeTrailingRingHeightSuffix,
} from "@/lib/delivery-ticket-pdf-data";
import { computeMoneyTotals } from "@/lib/money";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";
import { richTextToPlainText } from "@/lib/rich-text";

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
 * Make the invoices for several delivered tickets (the "make missing
 * invoices" catch-up). Skips tickets that already have an invoice and
 * collects per-ticket errors.
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
        ticketNumber: ticket.ticketNumber ?? "Planned",
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
        ticketNumber: ticket.ticketNumber ?? "Planned",
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
 * Invoices are due one calendar month after the delivery/pickup date,
 * clamped to the last day of shorter months (Jan 31 -> Feb 28). Falls back
 * to the given date when the ticket has no delivery date.
 */
export function invoiceDueDateFromDelivery(
  deliveryDate: Date | null | undefined,
  fallback: Date,
): Date {
  const base = startOfLocalDay(new Date(deliveryDate ?? fallback));
  const day = base.getDate();
  const result = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
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
    /** Price agreed at ticket time (items added outside the quote). */
    unitPrice?: Prisma.Decimal | null;
  },
  quoteId: string | null,
  priceListId: string | null,
  preloaded?: UnitPriceLookups,
): Promise<{ unitPrice: Prisma.Decimal; taxable: boolean; resolved: boolean }> {
  // A price entered on the ticket line itself wins: it's the number the
  // customer agreed to when the item was added mid-job (or the pickup price
  // on a quoted line). Only the price is overridden — a quoted line keeps
  // the quote's taxability.
  if (ticketLine.unitPrice != null) {
    let taxable = true;
    if (ticketLine.quoteLineItemId) {
      const quoteLine =
        preloaded?.quoteLines.get(ticketLine.quoteLineItemId) ??
        (preloaded
          ? null
          : await client.quoteLineItem.findUnique({
              where: { id: ticketLine.quoteLineItemId },
              select: { taxable: true },
            }));
      taxable = quoteLine?.taxable ?? true;
    }
    return { unitPrice: ticketLine.unitPrice, taxable, resolved: true };
  }

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
  // mark the line PRICE NEEDED instead of silently billing $0.
  return { unitPrice: new Prisma.Decimal(0), taxable: true, resolved: false };
}

type CastingSetCharge = {
  /** The ticket piece line the charge is listed after. */
  anchorTicketLineId: string;
  quoteLineItemId: string;
  productId: string | null;
  itemCode: string;
  description: string;
  sets: number;
  unitPrice: Prisma.Decimal;
  taxable: boolean;
};

/** Sets started by these pieces: a set counts once any of its pieces ships. */
function castingSetsStarted(
  piecesByComponent: Map<string, number>,
  perSetByComponent: Map<string, number>,
): number {
  let started = 0;
  for (const [componentId, pieces] of piecesByComponent) {
    const perSet = perSetByComponent.get(componentId) ?? 1;
    started = Math.max(started, Math.ceil(pieces / perSet));
  }
  return started;
}

/**
 * Casting assemblies ship a partial set as component piece lines that point
 * at the assembly's quote line (lib/casting-ticket-lines). Priced like any
 * quoted line, every piece billed the full per-set price. A set is billed
 * once instead — by the invoice that ships its first piece, mirroring split
 * structures: the piece lines bill $0 "(partial set)" and one extra line
 * bills the sets started at the set price.
 *
 * Sets started = max over components of ceil(pieces ÷ per-set qty), counted
 * over this ticket plus the same quote line's piece lines on tickets already
 * invoiced (non-void); the difference is this invoice's charge. Pieces with
 * an agreed per-line price (pickup repricing) keep that price.
 */
async function resolveCastingPartialSetCharges(
  tx: Prisma.TransactionClient,
  deliveryTicketId: string,
  ticketLines: Array<{
    id: string;
    quoteLineItemId: string | null;
    productId: string | null;
    jobStructureId: string | null;
    unitPrice: Prisma.Decimal | null;
    quantity: Prisma.Decimal;
  }>,
): Promise<{ pieceLineIds: Set<string>; charges: CastingSetCharge[] }> {
  const candidates = ticketLines.filter(
    (line) =>
      line.quoteLineItemId &&
      line.productId &&
      !line.jobStructureId &&
      line.unitPrice == null,
  );
  const pieceLineIds = new Set<string>();
  const charges: CastingSetCharge[] = [];
  if (candidates.length === 0) {
    return { pieceLineIds, charges };
  }

  const quoteLines = await tx.quoteLineItem.findMany({
    where: {
      id: { in: [...new Set(candidates.map((line) => line.quoteLineItemId!))] },
      product: { productKind: "CASTING_ASSEMBLY", castingSoldAsUnit: false },
    },
    select: {
      id: true,
      productId: true,
      itemCode: true,
      description: true,
      unitPrice: true,
      taxable: true,
      product: {
        select: {
          castingAssemblyComponents: {
            select: { componentId: true, quantity: true },
          },
        },
      },
    },
  });

  for (const quoteLine of quoteLines) {
    const perSetByComponent = new Map(
      (quoteLine.product?.castingAssemblyComponents ?? []).map((row) => [
        row.componentId,
        row.quantity,
      ]),
    );
    const pieceLines = candidates.filter(
      (line) =>
        line.quoteLineItemId === quoteLine.id &&
        line.productId !== quoteLine.productId &&
        perSetByComponent.has(line.productId!),
    );
    if (pieceLines.length === 0) {
      continue;
    }

    const earlierPieces = await tx.deliveryTicketLineItem.findMany({
      where: {
        quoteLineItemId: quoteLine.id,
        productId: { in: [...perSetByComponent.keys()] },
        jobStructureId: null,
        unitPrice: null,
        deliveryTicketId: { not: deliveryTicketId },
        deliveryTicket: { invoice: { is: { status: { not: "VOID" } } } },
      },
      select: { productId: true, quantity: true },
    });

    const before = new Map<string, number>();
    for (const line of earlierPieces) {
      before.set(
        line.productId!,
        (before.get(line.productId!) ?? 0) + Number(line.quantity),
      );
    }
    const after = new Map(before);
    for (const line of pieceLines) {
      pieceLineIds.add(line.id);
      after.set(
        line.productId!,
        (after.get(line.productId!) ?? 0) + Number(line.quantity),
      );
    }

    const sets =
      castingSetsStarted(after, perSetByComponent) -
      castingSetsStarted(before, perSetByComponent);
    if (sets > 0) {
      const name =
        richTextToPlainText(quoteLine.description ?? "").trim() ||
        quoteLine.itemCode;
      charges.push({
        anchorTicketLineId: pieceLines[pieceLines.length - 1]!.id,
        quoteLineItemId: quoteLine.id,
        productId: quoteLine.productId,
        itemCode: quoteLine.itemCode,
        description: `${name} (set${sets === 1 ? "" : "s"} shipped in pieces)`,
        sets,
        unitPrice: quoteLine.unitPrice,
        taxable: quoteLine.taxable,
      });
    }
  }

  return { pieceLineIds, charges };
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

export type EnsureInvoiceResult = {
  /** The ticket's invoice (new or already there); null when none was made. */
  invoiceId: string | null;
  /** True when this call made the invoice. */
  created: boolean;
  /** Soft failure: the delivery stands, the invoice could not be made. */
  error: string | null;
};

/**
 * Every delivered ticket gets its invoice the moment it is marked delivered
 * (there is no draft stage and no separate "create invoices" step). Returns
 * the existing or new invoice id, or a soft error message so the caller can
 * show a warning without failing the delivery itself.
 *
 * An invoice that already exists is left alone whatever its status, so a
 * voided invoice is never silently replaced.
 */
export async function ensureInvoiceForDeliveredTicket(
  client: PrismaClient,
  deliveryTicketId: string,
): Promise<EnsureInvoiceResult> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: deliveryTicketId },
    select: {
      status: true,
      invoice: { select: { id: true } },
    },
  });

  if (!ticket || ticket.status !== "DELIVERED") {
    return { invoiceId: null, created: false, error: null };
  }

  if (ticket.invoice) {
    return { invoiceId: ticket.invoice.id, created: false, error: null };
  }

  try {
    const invoiceId = await convertDeliveryTicketToInvoice(
      client,
      deliveryTicketId,
    );
    return { invoiceId, created: true, error: null };
  } catch (error) {
    // A concurrent caller already created it — that is a success for us.
    if (error instanceof InvoiceAlreadyExistsError) {
      return { invoiceId: error.invoiceId, created: false, error: null };
    }
    return {
      invoiceId: null,
      created: false,
      error:
        error instanceof Error ? error.message : "Could not make the invoice.",
    };
  }
}

export type DeliveredTicketInvoice = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
};

/**
 * The one call every "mark delivered" path makes right after the delivery:
 * makes the ticket's invoice (or finds the one it has) and words the warning
 * for the person who clicked, if the invoice needs their attention. A line
 * waiting for a price is NOT a warning here — pricing sees it on the invoice
 * and under the Price needed filter — except on a counter sale that was paid
 * for, which could not be marked paid because of it.
 *
 * Also runs when the ticket was already delivered, so a second click repairs
 * a delivery whose invoice could not be made the first time.
 */
export async function ensureInvoiceAfterDelivery(
  client: PrismaClient,
  deliveryTicketId: string,
): Promise<{
  invoice: DeliveredTicketInvoice | null;
  created: boolean;
  warning: string | null;
}> {
  const result = await ensureInvoiceForDeliveredTicket(client, deliveryTicketId);
  const found = result.invoiceId
    ? await client.invoice.findUnique({
        where: { id: result.invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          deliveryTicket: {
            select: { paymentMethod: true, paymentReceived: true },
          },
          _count: { select: { lineItems: { where: { needsPrice: true } } } },
        },
      })
    : null;
  const invoice = found
    ? { id: found.id, invoiceNumber: found.invoiceNumber, status: found.status }
    : null;

  let warning: string | null = null;
  if (result.error) {
    warning = `The ticket is marked delivered, but its invoice could not be made: ${result.error.replace(/\.\s*$/, "")}. Use Convert to Invoice on the ticket once that is fixed.`;
  } else if (found && !result.created && found.status === "VOID") {
    warning = `The ticket is marked delivered. Its invoice ${found.invoiceNumber} is void, so no new invoice was made. Reopen that invoice if this delivery should be billed.`;
  } else if (
    found &&
    result.created &&
    found.status !== "PAID" &&
    found.deliveryTicket.paymentMethod === "PAY_NOW" &&
    found.deliveryTicket.paymentReceived &&
    found._count.lineItems > 0
  ) {
    // The one time a missing price is the clicker's business: money changed
    // hands at the counter and the invoice cannot say how much.
    warning = `Invoice ${found.invoiceNumber} is not marked paid yet, because ${
      found._count.lineItems === 1 ? "a line has" : "some lines have"
    } no price. Type the price on the invoice, then mark it paid.`;
  }

  return { invoice, created: result.created, warning };
}

/**
 * Create one invoice from a delivered delivery ticket (1:1). The invoice is
 * open (SENT) straight away — PAID for a counter sale already paid for.
 *
 * A line the app cannot price does not block the invoice: it bills $0 and is
 * flagged `needsPrice`, which prints PRICE NEEDED until someone types the
 * price on the invoice. The same goes for a $0 price that came from the quote
 * or the price list (blank prices on imported and Quick Build jobs are stored
 * as 0). A $0 typed on the ticket line itself is a deliberate "no charge".
 *
 * An invoice with a line waiting for a price is never created PAID, counter
 * sale or not: its total is not known yet, so it stays open until the price
 * is typed and someone marks it paid.
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
  const invoiceDate = isPaidWalkIn
    ? (ticket.deliveredAt ?? new Date())
    : new Date();

  const settings = await getAppSettings();
  const dueDate = invoiceDueDateFromDelivery(ticket.deliveryDate, invoiceDate);
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

    // Some tickets carry only the customer NAME; backfill the link by exact
    // name match so the invoice's Bill To (address, billing contact) works.
    let customerId = ticket.customerId;
    if (!customerId && ticket.customerName?.trim()) {
      const matched = await tx.customer.findFirst({
        where: {
          name: { equals: ticket.customerName.trim(), mode: "insensitive" },
        },
        select: { id: true },
      });
      customerId = matched?.id ?? null;
    }

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
      /** Nothing to bill this line at yet — prints PRICE NEEDED. */
      needsPrice: boolean;
    }> = [];

    const isPickupTicket = ticket.fulfillmentMethod === "PICKUP";

    for (const line of current.lineItems) {
      const { unitPrice, taxable, resolved } = await resolveUnitPrice(
        tx,
        line,
        ticket.quoteId,
        resolvedPriceListId,
        priceLookups,
      );

      // No price anywhere, or a $0 one nobody typed on the ticket: the
      // invoice is still made and the line waits for a price.
      const needsPrice =
        !resolved || (line.unitPrice == null && unitPrice.isZero());

      // Ticket lines carry editor-only suffixes ("(5' ring)", ADS joint
      // types); invoices store the clean customer-facing description.
      let cleanDescription = line.description
        ? removeAdsJointTypeSuffix(
            removeTrailingRingHeightSuffix(line.description),
          ) || null
        : null;

      // Pickup repricing: when a customer-pickup ticket bills a quote line at
      // an overridden price, say so on the invoice instead of leaving a
      // silent mismatch against the quote.
      if (isPickupTicket && line.unitPrice != null && line.quoteLineItemId) {
        const quoteRef = priceLookups.quoteLines.get(line.quoteLineItemId);
        const quotedEach = quoteRef
          ? quoteRef.isDrainRing && line.productId
            ? ringPieceUnitPrice(
                quoteRef.unitPrice,
                priceLookups.productHeights.get(line.productId),
              )
            : quoteRef.unitPrice
          : null;
        if (quotedEach != null && !unitPrice.equals(quotedEach)) {
          cleanDescription = cleanDescription
            ? `${cleanDescription} (pickup price)`
            : "(pickup price)";
        }
      }

      resolvedLines.push({
        line,
        unitPrice,
        taxable,
        description: cleanDescription,
        needsPrice,
      });
    }

    // A split structure is billed exactly once across all its piece lines:
    // the first (non-void) invoice to carry any of its pieces bills the full
    // quote-line price; every other piece line bills $0 "(included)". A piece
    // still waiting for its price counts as the one carrying it, so the price
    // is typed once and the later pieces stay "(included)".
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
          OR: [{ unitPrice: { gt: 0 } }, { needsPrice: true }],
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
          entry.needsPrice = false;
          entry.description = entry.description
            ? `${entry.description} (included)`
            : "(included)";
        } else {
          // First piece of this structure on this invoice carries the price.
          billedStructureIds.add(structureId);
        }
      }
    }

    // A casting set shipped in pieces is billed once, on its own line
    // (resolveCastingPartialSetCharges); the piece lines themselves are $0.
    const castingSets = await resolveCastingPartialSetCharges(
      tx,
      deliveryTicketId,
      current.lineItems,
    );
    for (const entry of resolvedLines) {
      if (castingSets.pieceLineIds.has(entry.line.id)) {
        entry.unitPrice = new Prisma.Decimal(0);
        entry.needsPrice = false;
        entry.description = entry.description
          ? `${entry.description} (partial set)`
          : "(partial set)";
      }
    }

    let extraLineNumber = Math.max(
      0,
      ...current.lineItems.map((line) => line.lineNumber),
    );
    const drafts = resolvedLines.flatMap((entry) => [
      {
        lineNumber: entry.line.lineNumber,
        lineType: entry.line.lineType,
        quoteLineItemId: entry.line.quoteLineItemId,
        deliveryTicketLineItemId: entry.line.id as string | null,
        productId: entry.line.productId,
        itemCode: entry.line.itemCode,
        description: entry.description,
        quantity: entry.line.quantity,
        unit: entry.line.unit,
        unitPrice: entry.unitPrice,
        needsPrice: entry.needsPrice,
        taxable: entry.taxable,
        sortOrder: entry.line.sortOrder,
      },
      ...castingSets.charges
        .filter((charge) => charge.anchorTicketLineId === entry.line.id)
        .map((charge) => ({
          lineNumber: (extraLineNumber += 1),
          lineType: entry.line.lineType,
          quoteLineItemId: charge.quoteLineItemId,
          deliveryTicketLineItemId: null,
          productId: charge.productId,
          itemCode: charge.itemCode,
          description: charge.description as string | null,
          quantity: new Prisma.Decimal(charge.sets),
          unit: "EA",
          unitPrice: charge.unitPrice,
          // The set's price lives on the quote line; a blank ($0) one waits
          // for a price like any other line.
          needsPrice: charge.unitPrice.isZero(),
          taxable: charge.taxable,
          sortOrder: entry.line.sortOrder,
        })),
    ]);

    // Authoritative Decimal totals with shared cent-rounding (matches quotes).
    const computed = computeMoneyTotals(
      drafts.map((draft) => ({
        quantity: draft.quantity,
        unitPrice: draft.unitPrice,
        taxable: draft.taxable,
      })),
      taxRate,
    );

    const lineData = drafts.map((draft, index) => ({
      ...draft,
      lineType: mapDeliveryLineTypeToInvoiceLineType(draft.lineType),
      total: computed.lineTotals[index],
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
    // year-based invoice sequence. Only delivered tickets convert, and
    // delivery always assigns a number — this guard is a belt-and-braces.
    if (!ticket.ticketNumber) {
      throw new Error(
        "This ticket has no ticket number yet — schedule or deliver it first.",
      );
    }
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
        customerId,
        jobNumber: ticket.jobNumber,
        customerName: ticket.customerName,
        projectName: ticket.projectName,
        // Paid at the counter means PAID — unless a line still needs its
        // price, because then nobody knows yet what "paid" would be.
        status:
          isPaidWalkIn && !drafts.some((draft) => draft.needsPrice)
            ? "PAID"
            : "SENT",
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
