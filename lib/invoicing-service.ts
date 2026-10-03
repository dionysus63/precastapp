import type { PrismaClient } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import { defaultInvoiceDueDate, getAppSettings } from "@/lib/app-settings";

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

async function nextInvoiceNumber(client: PrismaClient): Promise<{
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
): Promise<{ unitPrice: Prisma.Decimal; taxable: boolean }> {
  if (ticketLine.quoteLineItemId) {
    const quoteLine = preloaded?.quoteLines.get(ticketLine.quoteLineItemId);
    if (quoteLine) {
      return { unitPrice: quoteLine.unitPrice, taxable: quoteLine.taxable };
    }
    if (!preloaded) {
      const fetched = await client.quoteLineItem.findUnique({
        where: { id: ticketLine.quoteLineItemId },
        select: { unitPrice: true, taxable: true },
      });
      if (fetched) {
        return { unitPrice: fetched.unitPrice, taxable: fetched.taxable };
      }
    }
  }

  if (ticketLine.productId && priceListId) {
    const priceListItem = preloaded?.priceListItems.get(ticketLine.productId);
    if (priceListItem) {
      return { unitPrice: priceListItem.unitPrice, taxable: true };
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
        return { unitPrice: fetched.unitPrice, taxable: true };
      }
    }
  }

  if (ticketLine.productId) {
    const product = preloaded?.products.get(ticketLine.productId);
    if (product?.defaultPrice) {
      return { unitPrice: product.defaultPrice, taxable: product.taxable };
    }
    if (!preloaded) {
      const fetched = await client.product.findUnique({
        where: { id: ticketLine.productId },
        select: { defaultPrice: true, taxable: true },
      });
      if (fetched?.defaultPrice) {
        return { unitPrice: fetched.defaultPrice, taxable: fetched.taxable };
      }
    }
  }

  return { unitPrice: new Prisma.Decimal(0), taxable: true };
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

  const numbering = await nextInvoiceNumber(client);

  let subtotal = new Prisma.Decimal(0);
  let taxableAmount = new Prisma.Decimal(0);
  const taxRate = ticket.quote?.taxRate ?? new Prisma.Decimal(0);

  const lineData: {
    lineNumber: number;
    lineType: ReturnType<typeof mapDeliveryLineTypeToInvoiceLineType>;
    quoteLineItemId: string | null;
    deliveryTicketLineItemId: string;
    productId: string | null;
    itemCode: string;
    description: string | null;
    quantity: Prisma.Decimal;
    unit: string;
    unitPrice: Prisma.Decimal;
    taxable: boolean;
    total: Prisma.Decimal;
    sortOrder: number;
  }[] = [];

  const priceLookups = await preloadUnitPriceLookups(
    client,
    ticket.lineItems,
    ticket.priceListId,
  );

  for (const line of ticket.lineItems) {
    const { unitPrice, taxable } = await resolveUnitPrice(
      client,
      line,
      ticket.quoteId,
      ticket.priceListId,
      priceLookups,
    );
    const total = unitPrice.mul(line.quantity);
    subtotal = subtotal.add(total);
    if (taxable) {
      taxableAmount = taxableAmount.add(total);
    }

    lineData.push({
      lineNumber: line.lineNumber,
      lineType: mapDeliveryLineTypeToInvoiceLineType(line.lineType),
      quoteLineItemId: line.quoteLineItemId,
      deliveryTicketLineItemId: line.id,
      productId: line.productId,
      itemCode: line.itemCode,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice,
      taxable,
      total,
      sortOrder: line.sortOrder,
    });
  }

  const salesTax = taxableAmount.mul(taxRate).div(100);
  const total = subtotal.add(salesTax);

  const settings = await getAppSettings();
  const dueDate = defaultInvoiceDueDate(settings.invoiceDueDays);

  const invoice = await client.invoice.create({
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
      subtotal,
      taxableAmount,
      taxRate,
      salesTax,
      total,
      invoiceDate: new Date(),
      dueDate,
      lineItems: { create: lineData },
    },
    select: { id: true },
  });

  return invoice.id;
}
