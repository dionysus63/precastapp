import type { PrismaClient } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import { defaultInvoiceDueDate, getAppSettings } from "@/lib/app-settings";
import { computeMoneyTotals } from "@/lib/money";

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

  const sequence = await client.invoiceSequence.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const sequenceNumber = sequence.lastNumber;
  const invoiceNumber = `INV-${String(yearTwoDigit).padStart(2, "0")}-${String(sequenceNumber).padStart(3, "0")}`;

  return { invoiceNumber, year, yearTwoDigit, sequenceNumber };
}

async function resolveUnitPrice(
  client: PrismaClient,
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
        unitPrice: quoteLine.unitPrice,
        taxable: quoteLine.taxable,
        resolved: true,
      };
    }
    if (!preloaded) {
      const fetched = await client.quoteLineItem.findUnique({
        where: { id: ticketLine.quoteLineItemId },
        select: { unitPrice: true, taxable: true },
      });
      if (fetched) {
        return {
          unitPrice: fetched.unitPrice,
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

  if (ticketLine.productId) {
    const product = preloaded?.products.get(ticketLine.productId);
    if (product?.defaultPrice) {
      return {
        unitPrice: product.defaultPrice,
        taxable: product.taxable,
        resolved: true,
      };
    }
    if (!preloaded) {
      const fetched = await client.product.findUnique({
        where: { id: ticketLine.productId },
        select: { defaultPrice: true, taxable: true },
      });
      if (fetched?.defaultPrice) {
        return {
          unitPrice: fetched.defaultPrice,
          taxable: fetched.taxable,
          resolved: true,
        };
      }
    }
  }

  // No quote line, price-list entry, or product default price. Signal
  // unresolved so the caller can fail closed instead of billing at $0.
  return { unitPrice: new Prisma.Decimal(0), taxable: true, resolved: false };
}

type UnitPriceLookups = {
  quoteLines: Map<
    string,
    { unitPrice: Prisma.Decimal; taxable: boolean }
  >;
  priceListItems: Map<string, { unitPrice: Prisma.Decimal }>;
  products: Map<
    string,
    { defaultPrice: Prisma.Decimal | null; taxable: boolean }
  >;
};

async function preloadUnitPriceLookups(
  client: PrismaClient,
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

  const [quoteLines, priceListItems, products] = await Promise.all([
    quoteLineItemIds.length > 0
      ? client.quoteLineItem.findMany({
          where: { id: { in: quoteLineItemIds } },
          select: { id: true, unitPrice: true, taxable: true },
        })
      : Promise.resolve([]),
    priceListId && productIds.length > 0
      ? client.priceListItem.findMany({
          where: {
            priceListId,
            productId: { in: productIds },
          },
          select: { productId: true, unitPrice: true },
        })
      : Promise.resolve([]),
    productIds.length > 0
      ? client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, defaultPrice: true, taxable: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    quoteLines: new Map(
      quoteLines.map((line) => [
        line.id,
        { unitPrice: line.unitPrice, taxable: line.taxable },
      ]),
    ),
    priceListItems: new Map(
      priceListItems.map((item) => [item.productId, { unitPrice: item.unitPrice }]),
    ),
    products: new Map(
      products.map((product) => [
        product.id,
        { defaultPrice: product.defaultPrice, taxable: product.taxable },
      ]),
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
    throw new Error("An invoice already exists for this ticket.");
  }

  const settings = await getAppSettings();

  // Fall back to the configured default tax rate when the ticket has no linked
  // quote, so taxable customers aren't silently billed at 0%.
  const taxRate =
    ticket.quote?.taxRate ?? new Prisma.Decimal(settings.defaultTaxRate);

  const priceLookups = await preloadUnitPriceLookups(
    client,
    ticket.lineItems,
    ticket.priceListId,
  );

  const resolvedLines: Array<{
    line: (typeof ticket.lineItems)[number];
    unitPrice: Prisma.Decimal;
    taxable: boolean;
  }> = [];

  for (const line of ticket.lineItems) {
    const { unitPrice, taxable, resolved } = await resolveUnitPrice(
      client,
      line,
      ticket.quoteId,
      ticket.priceListId,
      priceLookups,
    );

    if (!resolved) {
      throw new Error(
        `No price found for line "${line.itemCode}". Set a unit price via the quote, price list, or product default before invoicing.`,
      );
    }

    resolvedLines.push({ line, unitPrice, taxable });
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
    description: entry.line.description,
    quantity: entry.line.quantity,
    unit: entry.line.unit,
    unitPrice: entry.unitPrice,
    taxable: entry.taxable,
    total: computed.lineTotals[index],
    sortOrder: entry.line.sortOrder,
  }));

  const dueDate = defaultInvoiceDueDate(settings.invoiceDueDays);

  // Allocate the invoice number and create the row in one transaction so a
  // failure can't consume a sequence number and leave a permanent gap.
  const invoice = await client.$transaction(async (tx) => {
    const numbering = await nextInvoiceNumber(tx);
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
        status: "DRAFT",
        subtotal: computed.subtotal,
        taxableAmount: computed.taxableAmount,
        taxRate,
        salesTax: computed.salesTax,
        total: computed.total,
        invoiceDate: new Date(),
        dueDate,
        lineItems: { create: lineData },
      },
      select: { id: true },
    });
  });

  return invoice.id;
}
