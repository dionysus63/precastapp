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
  listStockProductsForTicket,
  type DeliveryTicketLineInput,
  type SaveDeliveryTicketInput,
} from "@/app/delivery-tickets/actions";
import { updateInvoice } from "@/app/invoices/actions";
import {
  getQuoteLineFulfillment,
  markDeliveryTicketDelivered,
} from "@/lib/delivery-fulfillment";
import {
  INVOICE_PDF_INCLUDE,
  invoicePrintsDiscounts,
  mapInvoiceLineItemsForPdf,
} from "@/lib/invoice-pdf-data";
import { convertDeliveryTicketToInvoice } from "@/lib/invoicing-service";
import { prisma } from "@/lib/prisma";

/**
 * Step 3 of the pricing rework: a load is billed by how it left. The quote
 * here is priced delivered with the company's rules (stock precast 10%
 * delivered, 20% picked up; imported castings 10% both ways); a second quote
 * is priced for pickup.
 */
const tag = `LOADPRICE-${Date.now()}`;

const BASIN_LIST = 1450; // stock precast: 1305 delivered, 1160 picked up
const FRAME_LIST = 385; // imported casting: 346.50 both ways
const RISER_LIST = 600; // stock precast, awarded at 15% off: 510 on every load
const STRUCTURE_PRICE = 2380; // job structure: no product, no discount

let customerId: string;
let jobId: string;
let priceListId: string;
let basinId: string;
let frameId: string;
let riserId: string;
let quoteId: string;
let pickupQuoteId: string;
let basinLineId: string;
let frameLineId: string;
let riserLineId: string;
let structureLineId: string;
let pickupBasinLineId: string;
let originalRules: Awaited<ReturnType<typeof prisma.discountRule.findMany>>;

function quoteLine(
  quoteLineItemId: string,
  productId: string | null,
  code: string,
  quantity: number,
  unitPrice?: number,
): DeliveryTicketLineInput {
  return {
    quoteLineItemId,
    productId,
    lineType: productId ? "STOCK_PRODUCT" : "MISC",
    itemCode: `${tag}-${code}`,
    description: code,
    quantity,
    unitPrice: unitPrice ?? null,
  };
}

function jobTicket(
  fulfillmentMethod: "DELIVERY" | "PICKUP",
  lines: DeliveryTicketLineInput[],
  forQuoteId = quoteId,
): SaveDeliveryTicketInput {
  return {
    ticketType: "JOB",
    fulfillmentMethod,
    status: "DRAFT",
    jobId,
    quoteId: forQuoteId,
    priceListId,
    jobNumber: `${tag}-JOB`,
    quoteNumber: `${tag}-Q`,
    customerName: `${tag} Contractor`,
    projectName: `${tag} project`,
    lines,
  };
}

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

/** Create, deliver and invoice a ticket; returns the invoice as the PDF loads it. */
async function deliverAndInvoice(input: SaveDeliveryTicketInput) {
  const created = await createDeliveryTicket(input);
  expect(created).toMatchObject({ success: true });
  const ticketId = (created as { ticketId: string }).ticketId;
  await markDeliveryTicketDelivered(prisma, ticketId);
  const invoiceId = await convertDeliveryTicketToInvoice(prisma, ticketId);
  return prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: INVOICE_PDF_INCLUDE,
  });
}

/** Price, list price and discount of an invoice line, as plain numbers. */
function pricing(line: {
  unitPrice: { toString(): string };
  listPrice: { toString(): string } | null;
  discountPercent: { toString(): string } | null;
}) {
  return {
    unitPrice: Number(line.unitPrice),
    listPrice: line.listPrice != null ? Number(line.listPrice) : null,
    discountPercent:
      line.discountPercent != null ? Number(line.discountPercent) : null,
  };
}

beforeAll(async () => {
  originalRules = await prisma.discountRule.findMany();
  await prisma.discountRule.deleteMany();
  await prisma.discountRule.createMany({
    data: [
      { group: "STOCK_PRECAST", deliveredPercent: 10, pickupPercent: 20 },
      { group: "CASTING_IMPORTED", deliveredPercent: 10, pickupPercent: 10 },
    ],
  });

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

  const precast = await prisma.productCategory.create({
    data: { name: `${tag} Precast`, productType: "STOCK_PRECAST" },
  });
  const castings = await prisma.productCategory.create({
    data: { name: `${tag} Castings`, productType: "CASTING" },
  });
  const supplier = await prisma.castingSupplier.create({
    data: { name: `${tag} Importer`, origin: "IMPORTED" },
  });
  basinId = (
    await prisma.product.create({
      data: {
        productCode: `${tag}-BASIN`,
        name: `${tag} catch basin`,
        categoryId: precast.id,
        productType: "STOCK_PRECAST",
        trackInventory: false,
      },
    })
  ).id;
  riserId = (
    await prisma.product.create({
      data: {
        productCode: `${tag}-RISER`,
        name: `${tag} riser`,
        categoryId: precast.id,
        productType: "STOCK_PRECAST",
        trackInventory: false,
      },
    })
  ).id;
  frameId = (
    await prisma.product.create({
      data: {
        productCode: `${tag}-FRAME`,
        name: `${tag} frame`,
        categoryId: castings.id,
        productType: "CASTING",
        castingSupplierId: supplier.id,
        trackInventory: false,
      },
    })
  ).id;

  const priceList = await prisma.priceList.create({
    data: {
      name: `${tag} list`,
      isDefault: false,
      items: {
        create: [
          // A typed pickup price is retired: it must change nothing below.
          { productId: basinId, unitPrice: BASIN_LIST, pickupPrice: 999 },
          { productId: riserId, unitPrice: RISER_LIST },
          { productId: frameId, unitPrice: FRAME_LIST },
        ],
      },
    },
  });
  priceListId = priceList.id;

  const baseQuote = {
    jobId,
    customerId,
    customerName: customer.name,
    projectName: `${tag} project`,
    status: "WON" as const,
    priceListId,
    taxRate: 0,
  };
  const quote = await prisma.quote.create({
    data: {
      ...baseQuote,
      quoteNumber: `${tag}-Q1`,
      discountBasis: "DELIVERED",
      lineItems: {
        create: [
          {
            lineNumber: 1,
            lineType: "STOCK_PRODUCT",
            productId: basinId,
            itemCode: `${tag}-BASIN`,
            description: "Catch basin",
            quantity: 20,
            unitPrice: 1305,
            listPrice: BASIN_LIST,
            discountPercent: 10,
            taxable: false,
            total: 1305 * 20,
          },
          {
            lineNumber: 2,
            lineType: "STOCK_PRODUCT",
            productId: frameId,
            itemCode: `${tag}-FRAME`,
            description: "Frame",
            quantity: 20,
            unitPrice: 346.5,
            listPrice: FRAME_LIST,
            discountPercent: 10,
            taxable: false,
            total: 346.5 * 20,
          },
          {
            // Awarded: the discount was typed on the quote.
            lineNumber: 3,
            lineType: "STOCK_PRODUCT",
            productId: riserId,
            itemCode: `${tag}-RISER`,
            description: "Riser",
            quantity: 20,
            unitPrice: 510,
            listPrice: RISER_LIST,
            discountPercent: 15,
            discountTyped: true,
            taxable: false,
            total: 510 * 20,
          },
          {
            lineNumber: 4,
            lineType: "MISC",
            itemCode: `${tag}-MH1`,
            description: "Manhole MH-1",
            quantity: 5,
            unitPrice: STRUCTURE_PRICE,
            taxable: false,
            total: STRUCTURE_PRICE * 5,
          },
        ],
      },
    },
    include: { lineItems: { orderBy: { lineNumber: "asc" } } },
  });
  quoteId = quote.id;
  [basinLineId, frameLineId, riserLineId, structureLineId] = quote.lineItems.map(
    (line) => line.id,
  ) as [string, string, string, string];

  const pickupQuote = await prisma.quote.create({
    data: {
      ...baseQuote,
      quoteNumber: `${tag}-Q2`,
      discountBasis: "PICKUP",
      lineItems: {
        create: [
          {
            lineNumber: 1,
            lineType: "STOCK_PRODUCT",
            productId: basinId,
            itemCode: `${tag}-BASIN`,
            description: "Catch basin",
            quantity: 20,
            unitPrice: 1160,
            listPrice: BASIN_LIST,
            discountPercent: 20,
            taxable: false,
            total: 1160 * 20,
          },
        ],
      },
    },
    include: { lineItems: true },
  });
  pickupQuoteId = pickupQuote.id;
  pickupBasinLineId = pickupQuote.lineItems[0]!.id;
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
  await prisma.castingSupplier.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.productCategory.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.discountRule.deleteMany();
  if (originalRules.length > 0) {
    await prisma.discountRule.createMany({ data: originalRules });
  }
  await prisma.$disconnect();
});

describe("what the ticket editor is told", () => {
  it("gives each quote line its price for a delivered and a picked-up load", async () => {
    const lines = await getQuoteLineFulfillment(prisma, quoteId);
    const byId = new Map(lines.map((line) => [line.quoteLineItemId, line]));

    // Standard discount: 10% delivered, 20% picked up.
    expect(byId.get(basinLineId)).toMatchObject({
      quotedUnitPrice: 1305,
      loadUnitPrice: { DELIVERED: 1305, PICKUP: 1160 },
    });
    // Imported casting: the same either way.
    expect(byId.get(frameLineId)?.loadUnitPrice).toEqual({
      DELIVERED: 346.5,
      PICKUP: 346.5,
    });
    // Awarded price and a job structure: as quoted on every load.
    expect(byId.get(riserLineId)?.loadUnitPrice).toEqual({
      DELIVERED: 510,
      PICKUP: 510,
    });
    expect(byId.get(structureLineId)?.loadUnitPrice).toEqual({
      DELIVERED: STRUCTURE_PRICE,
      PICKUP: STRUCTURE_PRICE,
    });
  });

  it("prices a quote made for pickup the other way round", async () => {
    const [basin] = await getQuoteLineFulfillment(prisma, pickupQuoteId);
    expect(basin).toMatchObject({
      quotedUnitPrice: 1160,
      loadUnitPrice: { DELIVERED: 1305, PICKUP: 1160 },
    });
  });

  it("lists products at list price less the discount of their group", async () => {
    const products = await listStockProductsForTicket(priceListId);
    const byId = new Map(products.map((product) => [product.id, product]));
    // The typed pickup price (999) is not read any more.
    expect(byId.get(basinId)).toMatchObject({
      unitPrice: BASIN_LIST,
      deliveredPrice: 1305,
      pickupPrice: 1160,
    });
    expect(byId.get(frameId)).toMatchObject({
      unitPrice: FRAME_LIST,
      deliveredPrice: 346.5,
      pickupPrice: 346.5,
    });
  });
});

describe("invoicing a load of a quote priced delivered", () => {
  it("bills a delivered load as quoted, with the quote's discounts", async () => {
    const invoice = await deliverAndInvoice(
      jobTicket("DELIVERY", [
        quoteLine(basinLineId, basinId, "BASIN", 2),
        quoteLine(structureLineId, null, "MH1", 1),
      ]),
    );
    const [basin, structure] = invoice.lineItems;
    expect(pricing(basin!)).toEqual({
      unitPrice: 1305,
      listPrice: BASIN_LIST,
      discountPercent: 10,
    });
    expect(basin!.description).toBe("BASIN");
    expect(pricing(structure!)).toEqual({
      unitPrice: STRUCTURE_PRICE,
      listPrice: null,
      discountPercent: null,
    });
    expect(Number(invoice.total)).toBe(1305 * 2 + STRUCTURE_PRICE);
    expect(invoicePrintsDiscounts(invoice)).toBe(true);
  });

  it("bills a picked-up load at the pickup discount and keeps awarded prices", async () => {
    const invoice = await deliverAndInvoice(
      jobTicket("PICKUP", [
        quoteLine(basinLineId, basinId, "BASIN", 2),
        quoteLine(frameLineId, frameId, "FRAME", 2),
        quoteLine(riserLineId, riserId, "RISER", 1),
        quoteLine(structureLineId, null, "MH1", 1),
      ]),
    );
    const [basin, frame, riser, structure] = invoice.lineItems;

    expect(pricing(basin!)).toEqual({
      unitPrice: 1160,
      listPrice: BASIN_LIST,
      discountPercent: 20,
    });
    // Billed below the quote: the invoice says why.
    expect(basin!.description).toBe("BASIN (pickup price)");
    expect(basin!.taxable).toBe(false);

    expect(pricing(frame!)).toEqual({
      unitPrice: 346.5,
      listPrice: FRAME_LIST,
      discountPercent: 10,
    });
    expect(frame!.description).toBe("FRAME");

    expect(pricing(riser!)).toEqual({
      unitPrice: 510,
      listPrice: RISER_LIST,
      discountPercent: 15,
    });
    expect(riser!.description).toBe("RISER");

    expect(pricing(structure!).unitPrice).toBe(STRUCTURE_PRICE);
    expect(Number(invoice.total)).toBe(
      1160 * 2 + 346.5 * 2 + 510 + STRUCTURE_PRICE,
    );

    // The printed invoice carries the list price and discount columns.
    const rows = mapInvoiceLineItemsForPdf(invoice.lineItems);
    expect(rows[0]).toMatchObject({
      listPrice: "$1,450.00",
      discount: "20%",
      unitPrice: "$1,160.00",
      total: "$2,320.00",
    });
    // A line with no discount shows its one price in both price columns.
    expect(rows[3]).toMatchObject({
      listPrice: "$2,380.00",
      discount: "",
      unitPrice: "$2,380.00",
    });
  });

  it("lets a price typed on the pickup ticket win, with no discount beside it", async () => {
    const invoice = await deliverAndInvoice(
      jobTicket("PICKUP", [quoteLine(basinLineId, basinId, "BASIN", 1, 1100)]),
    );
    expect(pricing(invoice.lineItems[0]!)).toEqual({
      unitPrice: 1100,
      listPrice: null,
      discountPercent: null,
    });
    expect(invoice.lineItems[0]!.description).toBe("BASIN (pickup price)");
    expect(invoicePrintsDiscounts(invoice)).toBe(false);
  });
});

describe("invoicing a load of a quote priced for pickup", () => {
  it("bills a picked-up load as quoted", async () => {
    const invoice = await deliverAndInvoice(
      jobTicket(
        "PICKUP",
        [quoteLine(pickupBasinLineId, basinId, "BASIN", 1)],
        pickupQuoteId,
      ),
    );
    expect(pricing(invoice.lineItems[0]!)).toEqual({
      unitPrice: 1160,
      listPrice: BASIN_LIST,
      discountPercent: 20,
    });
    expect(invoice.lineItems[0]!.description).toBe("BASIN");
  });

  it("bills a delivered load at the delivered discount and says so", async () => {
    const invoice = await deliverAndInvoice(
      jobTicket(
        "DELIVERY",
        [quoteLine(pickupBasinLineId, basinId, "BASIN", 1)],
        pickupQuoteId,
      ),
    );
    expect(pricing(invoice.lineItems[0]!)).toEqual({
      unitPrice: 1305,
      listPrice: BASIN_LIST,
      discountPercent: 10,
    });
    expect(invoice.lineItems[0]!.description).toBe("BASIN (delivered price)");
  });

  it("hides the discount columns when the quote hides its discounts", async () => {
    await prisma.quote.update({
      where: { id: pickupQuoteId },
      data: { showDiscount: false },
    });
    const invoice = await deliverAndInvoice(
      jobTicket(
        "PICKUP",
        [quoteLine(pickupBasinLineId, basinId, "BASIN", 1)],
        pickupQuoteId,
      ),
    );
    expect(pricing(invoice.lineItems[0]!).discountPercent).toBe(20);
    expect(invoicePrintsDiscounts(invoice)).toBe(false);
  });
});

describe("invoicing a walk-in sale", () => {
  it("shows the list price and pickup discount behind a price off the list", async () => {
    const invoice = await deliverAndInvoice(
      walkInTicket([
        {
          productId: basinId,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-BASIN`,
          description: "Catch basin",
          quantity: 1,
          // What the ticket editor fills in: list less 20%.
          unitPrice: 1160,
        },
        {
          productId: riserId,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-RISER`,
          description: "Riser",
          quantity: 1,
          // A price agreed at the counter.
          unitPrice: 450,
        },
      ]),
    );
    const [basin, riser] = invoice.lineItems;
    expect(pricing(basin!)).toEqual({
      unitPrice: 1160,
      listPrice: BASIN_LIST,
      discountPercent: 20,
    });
    expect(pricing(riser!)).toEqual({
      unitPrice: 450,
      listPrice: null,
      discountPercent: null,
    });
  });
});

describe("editing the invoice", () => {
  it("drops the list price and discount of a line whose price is typed over", async () => {
    const invoice = await deliverAndInvoice(
      jobTicket("PICKUP", [
        quoteLine(basinLineId, basinId, "BASIN", 1),
        quoteLine(frameLineId, frameId, "FRAME", 1),
      ]),
    );
    const [basin, frame] = invoice.lineItems;
    const asInput = (
      line: (typeof invoice.lineItems)[number],
      unitPrice: number,
    ) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: line.description ?? "",
      quantity: Number(line.quantity),
      unit: line.unit,
      unitPrice,
      taxable: line.taxable,
    });

    const result = await updateInvoice({
      invoiceId: invoice.id,
      taxRate: 0,
      discountAmount: 0,
      deletedLineIds: [],
      lines: [asInput(basin!, 1000), asInput(frame!, 346.5)],
    });
    expect(result).not.toHaveProperty("error");

    const saved = await prisma.invoiceLineItem.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { lineNumber: "asc" },
    });
    expect(pricing(saved[0]!)).toEqual({
      unitPrice: 1000,
      listPrice: null,
      discountPercent: null,
    });
    // Untouched: its discount stays.
    expect(pricing(saved[1]!)).toEqual({
      unitPrice: 346.5,
      listPrice: FRAME_LIST,
      discountPercent: 10,
    });
  });
});
