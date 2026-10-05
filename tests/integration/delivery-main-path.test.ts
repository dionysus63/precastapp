import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request: permission
// checks come from the session cookie and revalidatePath needs a request
// store. Everything else (Prisma, transactions, business rules) runs real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import { createDeliveryTicket } from "@/app/delivery-tickets/actions";
import { deliverTicket } from "@/app/operations/actions";
import { getAppSettings } from "@/lib/app-settings";
import { convertDeliveryTicketToInvoice } from "@/lib/invoicing-service";
import { prisma } from "@/lib/prisma";

const tag = `MAINPATH-${Date.now()}`;

const QUOTE_TAX_RATE = 8;
const TRACKED_QUOTE_PRICE = 75;
const TRACKED_LIST_PRICE = 99;
const UNTRACKED_QUOTE_PRICE = 40;
const STRUCTURE_PRICE = 5000;

let customerId: string;
let jobId: string;
let categoryId: string;
let priceListId: string;
let trackedId: string;
let untrackedId: string;
let unpricedId: string;
let structureId: string;
let quoteId: string;
let trackedQuoteLineId: string;
let untrackedQuoteLineId: string;
let structureQuoteLineId: string;
let jobTicketId: string;

async function stockOf(productId: string) {
  return (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
    .currentStockQuantity;
}

beforeAll(async () => {
  const customer = await prisma.customer.create({
    data: { name: `${tag} Contractor` },
  });
  customerId = customer.id;

  const job = await prisma.job.create({
    data: {
      jobNumber: `${tag}-JOB`,
      year: 2099,
      yearTwoDigit: 99,
      sequenceNumber: Number(String(Date.now()).slice(-7)),
      customerId,
      customerName: customer.name,
      projectName: `${tag} project`,
      status: "AWARDED",
    },
  });
  jobId = job.id;

  const category = await prisma.productCategory.create({
    data: { name: `${tag} Category`, productType: "STOCK_PRECAST" },
  });
  categoryId = category.id;

  const product = (code: string, trackInventory: boolean, stock: number) =>
    prisma.product.create({
      data: {
        productCode: `${tag}-${code}`,
        name: `${tag} ${code}`,
        categoryId,
        trackInventory,
        currentStockQuantity: stock,
      },
    });
  trackedId = (await product("TRACKED", true, 20)).id;
  untrackedId = (await product("UNTRACKED", false, 0)).id;
  unpricedId = (await product("UNPRICED", false, 0)).id;

  const priceList = await prisma.priceList.create({
    data: {
      name: `${tag} List`,
      isDefault: false,
      items: {
        create: [
          { productId: trackedId, unitPrice: TRACKED_LIST_PRICE },
          { productId: untrackedId, unitPrice: 55 },
        ],
      },
    },
  });
  priceListId = priceList.id;

  const structure = await prisma.jobStructure.create({
    data: {
      jobId,
      structureType: "CUSTOM_STRUCTURE",
      structureNumber: "MH-1",
      description: `${tag} Manhole`,
      quantity: 1,
      unit: "EA",
      weight: 9000,
      status: "MADE",
    },
  });
  structureId = structure.id;

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q1`,
      jobId,
      customerId,
      customerName: customer.name,
      projectName: `${tag} project`,
      status: "WON",
      priceListId,
      taxRate: QUOTE_TAX_RATE,
      lineItems: {
        create: [
          {
            lineNumber: 1,
            lineType: "STOCK_PRODUCT",
            productId: trackedId,
            itemCode: `${tag}-TRACKED`,
            description: "Tracked block",
            quantity: 10,
            unit: "EA",
            unitPrice: TRACKED_QUOTE_PRICE,
            taxable: true,
            total: TRACKED_QUOTE_PRICE * 10,
          },
          {
            lineNumber: 2,
            lineType: "STOCK_PRODUCT",
            productId: untrackedId,
            itemCode: `${tag}-UNTRACKED`,
            description: "Untracked item",
            quantity: 5,
            unit: "EA",
            unitPrice: UNTRACKED_QUOTE_PRICE,
            taxable: true,
            total: UNTRACKED_QUOTE_PRICE * 5,
          },
          {
            lineNumber: 3,
            lineType: "CUSTOM_STRUCTURE",
            jobStructureId: structureId,
            itemCode: "MH-1",
            description: `${tag} Manhole`,
            quantity: 1,
            unit: "EA",
            unitPrice: STRUCTURE_PRICE,
            taxable: false,
            total: STRUCTURE_PRICE,
          },
        ],
      },
    },
    include: { lineItems: { orderBy: { lineNumber: "asc" } } },
  });
  quoteId = quote.id;
  [trackedQuoteLineId, untrackedQuoteLineId, structureQuoteLineId] =
    quote.lineItems.map((line) => line.id) as [string, string, string];
});

afterAll(async () => {
  await prisma.invoice.deleteMany({
    where: { customerName: { startsWith: tag } },
  });
  const ticketLineIds = (
    await prisma.deliveryTicketLineItem.findMany({
      where: { deliveryTicket: { customerName: { startsWith: tag } } },
      select: { id: true },
    })
  ).map((line) => line.id);
  await prisma.deliveryTicket.deleteMany({
    where: { customerName: { startsWith: tag } },
  });
  await prisma.inventoryTransaction.deleteMany({
    where: {
      OR: [
        { productId: { in: [trackedId, untrackedId, unpricedId] } },
        { referenceId: { in: ticketLineIds } },
      ],
    },
  });
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.jobStructure.deleteMany({ where: { jobId } });
  await prisma.job.deleteMany({ where: { jobNumber: { startsWith: tag } } });
  await prisma.priceList.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.product.deleteMany({ where: { productCode: { startsWith: tag } } });
  await prisma.productCategory.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("delivering a job ticket built from a quote", () => {
  it("deducts tracked stock, writes the ledger row, ships the structure and activates the job", async () => {
    const created = await createDeliveryTicket({
      ticketType: "JOB",
      fulfillmentMethod: "DELIVERY",
      status: "DRAFT",
      jobId,
      quoteId,
      priceListId,
      jobNumber: `${tag}-JOB`,
      quoteNumber: `${tag}-Q1`,
      customerName: `${tag} Contractor`,
      projectName: `${tag} project`,
      lines: [
        {
          quoteLineItemId: trackedQuoteLineId,
          productId: trackedId,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-TRACKED`,
          description: "Tracked block",
          quantity: 4,
        },
        {
          quoteLineItemId: untrackedQuoteLineId,
          productId: untrackedId,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-UNTRACKED`,
          description: "Untracked item",
          quantity: 2,
        },
        {
          quoteLineItemId: structureQuoteLineId,
          jobStructureId: structureId,
          lineType: "CUSTOM_STRUCTURE",
          itemCode: "MH-1",
          description: "Manhole MH-1",
          quantity: 1,
        },
      ],
    });
    expect(created).toMatchObject({ success: true });
    jobTicketId = (created as { ticketId: string }).ticketId;

    const result = await deliverTicket(jobTicketId);
    expect(result).toMatchObject({ success: true, invoice: null, warning: null });

    const ticket = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: jobTicketId },
      include: { lineItems: { orderBy: { lineNumber: "asc" } } },
    });
    expect(ticket.status).toBe("DELIVERED");
    expect(ticket.deliveredAt).not.toBeNull();
    expect(ticket.ticketNumber).toBeTruthy();

    // Tracked product: on-hand drops by the delivered quantity...
    expect(await stockOf(trackedId)).toBe(16);
    const [trackedLine, untrackedLine] = ticket.lineItems;
    expect(trackedLine!.status).toBe("DELIVERED");

    // ...and exactly one DELIVERY ledger row points at the ticket line.
    const ledger = await prisma.inventoryTransaction.findMany({
      where: { productId: trackedId },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      transactionType: "DELIVERY",
      referenceType: "DELIVERY_TICKET_LINE_ITEM",
      referenceId: trackedLine!.id,
    });
    expect(Number(ledger[0]!.quantityChange)).toBe(-4);
    expect(ledger[0]!.transactionDate.getTime()).toBe(
      ticket.deliveredAt!.getTime(),
    );

    // Untracked product: no ledger row, balance untouched.
    expect(
      await prisma.inventoryTransaction.count({ where: { productId: untrackedId } }),
    ).toBe(0);
    expect(await stockOf(untrackedId)).toBe(0);
    expect(untrackedLine!.status).not.toBe("DELIVERED");

    // Whole-structure line ships its structure on the delivery timestamp.
    const structure = await prisma.jobStructure.findUniqueOrThrow({
      where: { id: structureId },
    });
    expect(structure.status).toBe("SHIPPED");
    expect(structure.shippedDate?.getTime()).toBe(ticket.deliveredAt!.getTime());

    // First delivery promotes an AWARDED job to ACTIVE.
    expect(
      (await prisma.job.findUniqueOrThrow({ where: { id: jobId } })).status,
    ).toBe("ACTIVE");
  });

  it("delivering again is a no-op for stock and the ledger", async () => {
    const again = await deliverTicket(jobTicketId);
    expect(again).toMatchObject({ success: true });
    expect(await stockOf(trackedId)).toBe(16);
    expect(
      await prisma.inventoryTransaction.count({ where: { productId: trackedId } }),
    ).toBe(1);
  });

  it("invoices the ticket at quote prices with the quote's tax rate and taxability", async () => {
    const invoiceId = await convertDeliveryTicketToInvoice(prisma, jobTicketId);
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lineItems: { orderBy: { lineNumber: "asc" } } },
    });
    const ticket = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: jobTicketId },
      include: { lineItems: { orderBy: { lineNumber: "asc" } } },
    });

    expect(invoice).toMatchObject({
      status: "DRAFT",
      deliveryTicketId: jobTicketId,
      jobId,
      quoteId,
      customerId,
      jobNumber: `${tag}-JOB`,
    });
    // Invoice number mirrors the ticket digits: T10024 -> I10024.
    expect(invoice.invoiceNumber.replace(/^\D+/, "")).toBe(
      ticket.ticketNumber!.replace(/^\D+/, ""),
    );

    // One invoice line per ticket line, linked back, same item and quantity.
    expect(invoice.lineItems).toHaveLength(ticket.lineItems.length);
    invoice.lineItems.forEach((line, index) => {
      const ticketLine = ticket.lineItems[index]!;
      expect(line.deliveryTicketLineItemId).toBe(ticketLine.id);
      expect(line.quoteLineItemId).toBe(ticketLine.quoteLineItemId);
      expect(line.itemCode).toBe(ticketLine.itemCode);
      expect(Number(line.quantity)).toBe(Number(ticketLine.quantity));
    });

    const [tracked, untracked, structure] = invoice.lineItems;
    // Quote price wins over the price list (99) for the quoted product.
    expect(Number(tracked!.unitPrice)).toBe(TRACKED_QUOTE_PRICE);
    expect(Number(tracked!.total)).toBe(TRACKED_QUOTE_PRICE * 4);
    expect(tracked!.taxable).toBe(true);
    expect(Number(untracked!.unitPrice)).toBe(UNTRACKED_QUOTE_PRICE);
    expect(Number(untracked!.total)).toBe(UNTRACKED_QUOTE_PRICE * 2);
    expect(structure!.lineType).toBe("CUSTOM_STRUCTURE");
    expect(Number(structure!.unitPrice)).toBe(STRUCTURE_PRICE);
    expect(structure!.taxable).toBe(false);

    const taxable = TRACKED_QUOTE_PRICE * 4 + UNTRACKED_QUOTE_PRICE * 2; // 380
    const subtotal = taxable + STRUCTURE_PRICE; // 5380
    const salesTax = (taxable * QUOTE_TAX_RATE) / 100; // 30.40
    expect(Number(invoice.taxRate)).toBe(QUOTE_TAX_RATE);
    expect(Number(invoice.subtotal)).toBe(subtotal);
    expect(Number(invoice.taxableAmount)).toBe(taxable);
    expect(Number(invoice.salesTax)).toBeCloseTo(salesTax, 2);
    expect(Number(invoice.total)).toBeCloseTo(subtotal + salesTax, 2);
    expect(Number(invoice.deliveryAmount)).toBe(0);
  });
});

describe("delivering a walk-in ticket with no quote", () => {
  async function walkInTicket(
    suffix: string,
    lines: Array<{ productId: string; code: string; quantity: number }>,
  ) {
    return prisma.deliveryTicket.create({
      data: {
        // Ends in a letter so the invoice takes a sequence number instead of
        // mirroring the ticket digits.
        ticketNumber: `${tag}-W${suffix}X`,
        ticketType: "WALK_IN",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "PAY_NOW",
        status: "SCHEDULED",
        priceListId,
        customerName: `${tag} Walk-in ${suffix}`,
        projectName: `${tag} counter sale`,
        lineItems: {
          create: lines.map((line, index) => ({
            lineNumber: index + 1,
            sortOrder: index,
            lineType: "STOCK_PRODUCT" as const,
            productId: line.productId,
            itemCode: `${tag}-${line.code}`,
            description: line.code,
            quantity: line.quantity,
            unit: "EA",
          })),
        },
      },
    });
  }

  it("bills price-list prices at the default tax rate and auto-creates a PAID pay-now invoice", async () => {
    const settings = await getAppSettings();
    const defaultTaxRate = Number(settings.defaultTaxRate);
    const stockBefore = await stockOf(trackedId);

    const ticket = await walkInTicket("1", [
      { productId: trackedId, code: "TRACKED", quantity: 2 },
    ]);
    const result = await deliverTicket(ticket.id, { paymentReceived: true });
    expect(result).toMatchObject({ success: true, warning: null });
    expect(await stockOf(trackedId)).toBe(stockBefore - 2);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { deliveryTicketId: ticket.id },
      include: { lineItems: true },
    });
    expect((result as { invoice: { id: string } }).invoice.id).toBe(invoice.id);
    expect(invoice.status).toBe("PAID");
    expect(invoice.quoteId).toBeNull();
    expect(invoice.lineItems).toHaveLength(1);
    expect(Number(invoice.lineItems[0]!.unitPrice)).toBe(TRACKED_LIST_PRICE);
    expect(invoice.lineItems[0]!.taxable).toBe(true);

    const subtotal = TRACKED_LIST_PRICE * 2;
    expect(Number(invoice.taxRate)).toBe(defaultTaxRate);
    expect(Number(invoice.subtotal)).toBe(subtotal);
    expect(Number(invoice.salesTax)).toBeCloseTo(
      Math.round(subtotal * defaultTaxRate) / 100,
      2,
    );
    expect(Number(invoice.total)).toBeCloseTo(
      subtotal + Number(invoice.salesTax),
      2,
    );
  });

  it("fails closed when a line has no quote, list or ticket price", async () => {
    const ticket = await walkInTicket("2", [
      { productId: unpricedId, code: "UNPRICED", quantity: 1 },
    ]);

    // Delivery still completes; the pay-now invoice is refused with a warning.
    const result = await deliverTicket(ticket.id, { paymentReceived: true });
    expect(result).toMatchObject({ success: true, invoice: null });
    expect((result as { warning: string }).warning).toMatch(/No price found/);

    await expect(
      convertDeliveryTicketToInvoice(prisma, ticket.id),
    ).rejects.toThrow(/No price found for line/);
    expect(
      await prisma.invoice.findUnique({ where: { deliveryTicketId: ticket.id } }),
    ).toBeNull();
  });
});
