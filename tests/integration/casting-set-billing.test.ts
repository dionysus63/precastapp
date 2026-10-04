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

import { convertDeliveryTicketToInvoice } from "@/lib/invoicing-service";
import { prisma } from "@/lib/prisma";

const tag = `CASTSET-${Date.now()}`;
const SET_PRICE = 500;

let categoryId: string;
let frameId: string;
let grateId: string;
let assemblyId: string;
let quoteId: string;
let setLineId: string;
let ticketCounter = 0;

type TicketLine = {
  productId: string;
  itemCode: string;
  quantity: number;
  unitPrice?: number;
};

async function deliveredTicket(lines: TicketLine[]) {
  ticketCounter += 1;
  const ticket = await prisma.deliveryTicket.create({
    data: {
      // Ends in a letter so the invoice takes a sequence number instead of
      // mirroring the ticket digits.
      ticketNumber: `${tag}-T${ticketCounter}X`,
      customerName: `${tag} Contractor`,
      projectName: `${tag} project`,
      quoteId,
      status: "DELIVERED",
      deliveredAt: new Date(),
      lineItems: {
        create: lines.map((line, index) => ({
          lineNumber: index + 1,
          sortOrder: index + 1,
          lineType: "STOCK_PRODUCT" as const,
          quoteLineItemId: setLineId,
          productId: line.productId,
          itemCode: line.itemCode,
          description: line.itemCode,
          quantity: line.quantity,
          unit: "EA",
          unitPrice: line.unitPrice ?? null,
        })),
      },
    },
  });
  return ticket.id;
}

async function invoiceFor(ticketId: string) {
  const invoiceId = await convertDeliveryTicketToInvoice(prisma, ticketId);
  return prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lineItems: { orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }] } },
  });
}

beforeAll(async () => {
  const category = await prisma.productCategory.create({
    data: { name: `${tag} castings`, productType: "CASTING" },
  });
  categoryId = category.id;

  const product = (code: string, kind: "CASTING_COMPONENT" | "CASTING_ASSEMBLY") =>
    prisma.product.create({
      data: {
        productCode: `${tag}-${code}`,
        name: `${tag} ${code}`,
        categoryId,
        productType: "CASTING",
        productKind: kind,
        trackInventory: false,
      },
    });
  frameId = (await product("FRAME", "CASTING_COMPONENT")).id;
  grateId = (await product("GRATE", "CASTING_COMPONENT")).id;
  assemblyId = (await product("SET", "CASTING_ASSEMBLY")).id;
  await prisma.productCastingComponent.createMany({
    data: [
      { assemblyId, componentId: frameId, pieceRole: "FRAME", quantity: 1 },
      { assemblyId, componentId: grateId, pieceRole: "COVER_GRATE", quantity: 1 },
    ],
  });

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q1`,
      customerName: `${tag} Contractor`,
      projectName: `${tag} project`,
      status: "WON",
      taxRate: 8.625,
      lineItems: {
        create: {
          lineNumber: 1,
          lineType: "STOCK_PRODUCT",
          productId: assemblyId,
          itemCode: `${tag}-SET`,
          description: "Frame &amp; Grate",
          quantity: 6,
          unit: "EA",
          unitPrice: SET_PRICE,
          taxable: false,
          total: SET_PRICE * 6,
        },
      },
    },
    include: { lineItems: true },
  });
  quoteId = quote.id;
  setLineId = quote.lineItems[0]!.id;
});

afterAll(async () => {
  await prisma.invoice.deleteMany({
    where: { customerName: `${tag} Contractor` },
  });
  await prisma.deliveryTicket.deleteMany({
    where: { customerName: `${tag} Contractor` },
  });
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.productCastingComponent.deleteMany({ where: { assemblyId } });
  await prisma.product.deleteMany({ where: { productCode: { startsWith: tag } } });
  await prisma.productCategory.delete({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("casting sets shipped in pieces", () => {
  it("bills a set once, on the invoice that ships its first piece", async () => {
    const first = await invoiceFor(
      await deliveredTicket([
        { productId: frameId, itemCode: `${tag}-FRAME`, quantity: 1 },
      ]),
    );
    expect(Number(first.total)).toBe(SET_PRICE);
    const [frameLine, setCharge] = first.lineItems;
    expect(Number(frameLine!.unitPrice)).toBe(0);
    expect(frameLine!.description).toContain("(partial set)");
    expect(Number(setCharge!.quantity)).toBe(1);
    expect(Number(setCharge!.unitPrice)).toBe(SET_PRICE);
    expect(setCharge!.deliveryTicketLineItemId).toBeNull();
    expect(setCharge!.quoteLineItemId).toBe(setLineId);
    expect(setCharge!.description).toBe("Frame & Grate (set shipped in pieces)");

    // The matching grate completes that set: nothing more to bill.
    const second = await invoiceFor(
      await deliveredTicket([
        { productId: grateId, itemCode: `${tag}-GRATE`, quantity: 1 },
      ]),
    );
    expect(Number(second.total)).toBe(0);
    expect(second.lineItems).toHaveLength(1);
  });

  it("bills whole-set lines normally next to pieces that start new sets", async () => {
    const invoice = await invoiceFor(
      await deliveredTicket([
        { productId: assemblyId, itemCode: `${tag}-SET`, quantity: 2 },
        { productId: frameId, itemCode: `${tag}-FRAME`, quantity: 3 },
        { productId: grateId, itemCode: `${tag}-GRATE`, quantity: 1 },
      ]),
    );
    // 2 whole sets + 3 more sets started by the loose frames.
    expect(Number(invoice.total)).toBe(SET_PRICE * 5);
    const charge = invoice.lineItems.find(
      (line) => line.deliveryTicketLineItemId === null,
    );
    expect(Number(charge!.quantity)).toBe(3);
  });

  it("keeps an agreed per-piece price and the quote line's taxability", async () => {
    const invoice = await invoiceFor(
      await deliveredTicket([
        {
          productId: grateId,
          itemCode: `${tag}-GRATE`,
          quantity: 1,
          unitPrice: 180,
        },
      ]),
    );
    expect(invoice.lineItems).toHaveLength(1);
    expect(Number(invoice.lineItems[0]!.unitPrice)).toBe(180);
    // The quote line is non-taxable; a price override doesn't change that.
    expect(invoice.lineItems[0]!.taxable).toBe(false);
    expect(Number(invoice.salesTax)).toBe(0);
  });
});
