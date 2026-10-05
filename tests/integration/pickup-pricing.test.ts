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

import {
  createDeliveryTicket,
  updateDeliveryTicket,
  type DeliveryTicketLineInput,
  type SaveDeliveryTicketInput,
} from "@/app/delivery-tickets/actions";
import {
  getQuoteLineFulfillment,
  markDeliveryTicketDelivered,
} from "@/lib/delivery-fulfillment";
import { convertDeliveryTicketToInvoice } from "@/lib/invoicing-service";
import { prisma } from "@/lib/prisma";

const tag = `PICKUP-${Date.now()}`;

// R10 ring: quoted at the delivered list price, cheaper picked up at the yard.
const RING_PRICE = 362;
const RING_PICKUP_PRICE = 320;
// Cover: on the list with no pickup price (bill the delivered price).
const COVER_PRICE = 100;
const FREIGHT_PER_LOAD = 450;

let customerId: string;
let jobId: string;
let priceListId: string;
let ringId: string;
let coverId: string;
let quoteId: string;
let ringLineId: string;
let coverLineId: string;
let freightLineId: string;

function ringLine(quantity: number, unitPrice?: number): DeliveryTicketLineInput {
  return {
    quoteLineItemId: ringLineId,
    productId: ringId,
    lineType: "STOCK_PRODUCT",
    itemCode: `${tag}-R10`,
    description: "10' Ring",
    quantity,
    unitPrice: unitPrice ?? null,
  };
}

function coverLine(quantity: number, unitPrice?: number): DeliveryTicketLineInput {
  return {
    quoteLineItemId: coverLineId,
    productId: coverId,
    lineType: "STOCK_PRODUCT",
    itemCode: `${tag}-COVER`,
    description: "Cover",
    quantity,
    unitPrice: unitPrice ?? null,
  };
}

function freightLine(quantity: number): DeliveryTicketLineInput {
  return {
    quoteLineItemId: freightLineId,
    lineType: "SERVICE",
    itemCode: "DELIVERY",
    description: "Delivery — Zone 2",
    quantity,
  };
}

function jobTicket(
  fulfillmentMethod: "DELIVERY" | "PICKUP",
  lines: DeliveryTicketLineInput[],
): SaveDeliveryTicketInput {
  return {
    ticketType: "JOB",
    fulfillmentMethod,
    status: "DRAFT",
    jobId,
    quoteId,
    priceListId,
    jobNumber: `${tag}-JOB`,
    quoteNumber: `${tag}-Q1`,
    customerName: `${tag} Contractor`,
    projectName: `${tag} project`,
    lines,
  };
}

/** Create, deliver and invoice a job ticket; returns the invoice lines in order. */
async function deliverAndInvoice(input: SaveDeliveryTicketInput) {
  const created = await createDeliveryTicket(input);
  expect(created).toMatchObject({ success: true });
  const ticketId = (created as { ticketId: string }).ticketId;
  await markDeliveryTicketDelivered(prisma, ticketId);
  const invoiceId = await convertDeliveryTicketToInvoice(prisma, ticketId);
  return prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lineItems: { orderBy: { lineNumber: "asc" } } },
  });
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
  const product = (code: string) =>
    prisma.product.create({
      data: {
        productCode: `${tag}-${code}`,
        name: `${tag} ${code}`,
        categoryId: category.id,
        trackInventory: false,
      },
    });
  ringId = (await product("R10")).id;
  coverId = (await product("COVER")).id;

  const priceList = await prisma.priceList.create({
    data: {
      name: `${tag} Delivered list`,
      isDefault: false,
      items: {
        create: [
          { productId: ringId, unitPrice: RING_PRICE, pickupPrice: RING_PICKUP_PRICE },
          { productId: coverId, unitPrice: COVER_PRICE, pickupPrice: null },
        ],
      },
    },
  });
  priceListId = priceList.id;

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q1`,
      jobId,
      customerId,
      customerName: customer.name,
      projectName: `${tag} project`,
      status: "WON",
      priceListId,
      taxRate: 0,
      lineItems: {
        create: [
          {
            lineNumber: 1,
            lineType: "STOCK_PRODUCT",
            productId: ringId,
            itemCode: `${tag}-R10`,
            description: "10' Ring",
            quantity: 20,
            unit: "EA",
            unitPrice: RING_PRICE,
            taxable: false,
            total: RING_PRICE * 20,
          },
          {
            lineNumber: 2,
            lineType: "STOCK_PRODUCT",
            productId: coverId,
            itemCode: `${tag}-COVER`,
            description: "Cover",
            quantity: 10,
            unit: "EA",
            unitPrice: COVER_PRICE,
            taxable: false,
            total: COVER_PRICE * 10,
          },
          {
            lineNumber: 3,
            lineType: "SERVICE",
            itemCode: "DELIVERY",
            description: "Delivery — Zone 2",
            quantity: 3,
            unit: "LOAD",
            unitPrice: FREIGHT_PER_LOAD,
            taxable: false,
            total: FREIGHT_PER_LOAD * 3,
          },
        ],
      },
    },
    include: { lineItems: { orderBy: { lineNumber: "asc" } } },
  });
  quoteId = quote.id;
  [ringLineId, coverLineId, freightLineId] = quote.lineItems.map(
    (line) => line.id,
  ) as [string, string, string];
});

afterAll(async () => {
  await prisma.invoice.deleteMany({
    where: { customerName: { startsWith: tag } },
  });
  await prisma.deliveryTicket.deleteMany({
    where: { customerName: { startsWith: tag } },
  });
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.job.deleteMany({ where: { jobNumber: { startsWith: tag } } });
  await prisma.priceList.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.product.deleteMany({ where: { productCode: { startsWith: tag } } });
  await prisma.productCategory.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("pickup prices on the quote's fulfillment lines", () => {
  it("exposes the list's pickup price for product lines and flags freight", async () => {
    const lines = await getQuoteLineFulfillment(prisma, quoteId);
    const byId = new Map(lines.map((line) => [line.quoteLineItemId, line]));

    expect(byId.get(ringLineId)).toMatchObject({
      quotedUnitPrice: RING_PRICE,
      pickupUnitPrice: RING_PICKUP_PRICE,
      isDeliveryService: false,
    });
    // No pickup price on the list: null means "bill the delivered price".
    expect(byId.get(coverLineId)).toMatchObject({
      quotedUnitPrice: COVER_PRICE,
      pickupUnitPrice: null,
      isDeliveryService: false,
    });
    expect(byId.get(freightLineId)).toMatchObject({
      pickupUnitPrice: null,
      isDeliveryService: true,
    });
  });
});

describe("freight on pickup tickets", () => {
  it("refuses a delivery-charge line on a customer-pickup ticket", async () => {
    const result = await createDeliveryTicket(
      jobTicket("PICKUP", [ringLine(1, RING_PICKUP_PRICE), freightLine(1)]),
    );
    expect(result).toEqual({
      error: expect.stringMatching(
        /delivery charge — it can't go on a customer-pickup ticket/,
      ),
    });
    expect(
      await prisma.deliveryTicket.count({ where: { quoteId } }),
    ).toBe(0);
  });
});

describe("invoicing pickup vs delivered tickets", () => {
  it("bills the pickup override on a JOB pickup ticket and notes it on the invoice", async () => {
    const invoice = await deliverAndInvoice(
      jobTicket("PICKUP", [
        ringLine(2, RING_PICKUP_PRICE),
        // An override equal to the quoted price is not a repricing.
        coverLine(1, COVER_PRICE),
      ]),
    );

    const [ring, cover] = invoice.lineItems;
    expect(Number(ring!.unitPrice)).toBe(RING_PICKUP_PRICE);
    expect(ring!.description).toBe("10' Ring (pickup price)");
    // The override changes only the price: taxability still follows the quote.
    expect(ring!.taxable).toBe(false);
    expect(Number(cover!.unitPrice)).toBe(COVER_PRICE);
    expect(cover!.description).toBe("Cover");

    expect(Number(invoice.total)).toBe(RING_PICKUP_PRICE * 2 + COVER_PRICE);
    expect(Number(invoice.deliveryAmount)).toBe(0);
  });

  it("bills a pickup line without an override at the quote price, unlabelled", async () => {
    const invoice = await deliverAndInvoice(jobTicket("PICKUP", [ringLine(1)]));
    expect(Number(invoice.lineItems[0]!.unitPrice)).toBe(RING_PRICE);
    expect(invoice.lineItems[0]!.description).toBe("10' Ring");
  });

  it("bills a delivered ticket the normal quote price plus its freight line", async () => {
    const invoice = await deliverAndInvoice(
      jobTicket("DELIVERY", [ringLine(2), freightLine(1)]),
    );

    const [ring, freight] = invoice.lineItems;
    expect(Number(ring!.unitPrice)).toBe(RING_PRICE);
    expect(ring!.description).not.toContain("(pickup price)");
    expect(freight!.lineType).toBe("SERVICE");
    expect(Number(freight!.unitPrice)).toBe(FREIGHT_PER_LOAD);

    expect(Number(invoice.deliveryAmount)).toBe(FREIGHT_PER_LOAD);
    expect(Number(invoice.total)).toBe(RING_PRICE * 2 + FREIGHT_PER_LOAD);
  });

  it("refuses a quoted-line price override on a delivered ticket", async () => {
    // The "pickup override only on JOB+PICKUP" rule is enforced server side
    // too, not just by the editor's payload builder.
    const before = await prisma.deliveryTicket.count({ where: { quoteId } });
    const result = await createDeliveryTicket(
      jobTicket("DELIVERY", [ringLine(1, RING_PICKUP_PRICE)]),
    );
    expect(result).toEqual({
      error: expect.stringMatching(
        /can only be repriced on a job pickup ticket/,
      ),
    });
    expect(await prisma.deliveryTicket.count({ where: { quoteId } })).toBe(
      before,
    );
  });

  it("refuses a quoted-line price override when updating a ticket to delivery", async () => {
    const created = await createDeliveryTicket(
      jobTicket("PICKUP", [ringLine(1, RING_PICKUP_PRICE)]),
    );
    expect(created).toMatchObject({ success: true });
    const ticketId = (created as { ticketId: string }).ticketId;

    const result = await updateDeliveryTicket(
      ticketId,
      jobTicket("DELIVERY", [ringLine(1, RING_PICKUP_PRICE)]),
    );
    expect(result).toEqual({
      error: expect.stringMatching(
        /can only be repriced on a job pickup ticket/,
      ),
    });
    const saved = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { fulfillmentMethod: true },
    });
    expect(saved.fulfillmentMethod).toBe("PICKUP");

    // Dropping the override (what the editor sends) saves as delivery.
    const reverted = await updateDeliveryTicket(
      ticketId,
      jobTicket("DELIVERY", [ringLine(1)]),
    );
    expect(reverted).toEqual({ success: true, ticketId });
  });
});

describe("walk-in tickets", () => {
  function walkInTicket(lines: DeliveryTicketLineInput[]): SaveDeliveryTicketInput {
    return {
      ticketType: "WALK_IN",
      fulfillmentMethod: "PICKUP",
      status: "DRAFT",
      priceListId,
      customerName: `${tag} Walk-in`,
      projectName: "Walk-in sale",
      lines,
    };
  }

  const walkInRing = (): DeliveryTicketLineInput => ({
    productId: ringId,
    lineType: "STOCK_PRODUCT",
    itemCode: `${tag}-R10`,
    description: "10' Ring",
    quantity: 2,
    unitPrice: RING_PICKUP_PRICE,
  });

  it("refuses a line linked to a quote line", async () => {
    const result = await createDeliveryTicket(
      walkInTicket([walkInRing(), ringLine(1)]),
    );
    expect(result).toEqual({
      error: expect.stringMatching(/walk-in tickets can't carry quote or structure lines/),
    });
    expect(
      await prisma.deliveryTicket.count({
        where: { customerName: `${tag} Walk-in` },
      }),
    ).toBe(0);
  });

  it("refuses a line linked to a job structure", async () => {
    const result = await createDeliveryTicket(
      walkInTicket([
        {
          jobStructureId: "not-a-real-structure",
          lineType: "CUSTOM_STRUCTURE",
          itemCode: `${tag}-MH1`,
          quantity: 1,
        },
      ]),
    );
    expect(result).toEqual({
      error: expect.stringMatching(/walk-in tickets can't carry quote or structure lines/),
    });
  });

  it("still saves walk-in product and custom lines with their prices", async () => {
    const created = await createDeliveryTicket(
      walkInTicket([
        walkInRing(),
        {
          lineType: "MISC",
          itemCode: `${tag}-MISC`,
          description: "Grout bag",
          quantity: 1,
          unitPrice: 12,
        },
      ]),
    );
    expect(created).toMatchObject({ success: true });
    const ticketId = (created as { ticketId: string }).ticketId;

    const lines = await prisma.deliveryTicketLineItem.findMany({
      where: { deliveryTicketId: ticketId },
      orderBy: { lineNumber: "asc" },
    });
    expect(lines.map((line) => Number(line.unitPrice))).toEqual([
      RING_PICKUP_PRICE,
      12,
    ]);

    // Updating a walk-in with a quote-linked line is refused as well.
    const updated = await updateDeliveryTicket(
      ticketId,
      walkInTicket([walkInRing(), ringLine(1)]),
    );
    expect(updated).toEqual({
      error: expect.stringMatching(/walk-in tickets can't carry quote or structure lines/),
    });
  });
});
