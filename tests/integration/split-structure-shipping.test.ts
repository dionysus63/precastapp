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
  splitStructureForShipping,
  unsplitStructure,
} from "@/app/delivery-tickets/actions";
import { updateInvoice } from "@/app/invoices/actions";
import { deliverTicket } from "@/app/operations/actions";
import { markDeliveryTicketDelivered } from "@/lib/delivery-fulfillment";
import { convertDeliveryTicketToInvoice } from "@/lib/invoicing-service";
import { prisma } from "@/lib/prisma";

const tag = `SPLITTEST-${Date.now()}`;
const STRUCTURE_PRICE = 20000;

let customerId: string;
let jobId: string;
let quoteId: string;
let quoteLineId: string;
let structureId: string;
let pieceIds: string[] = [];
let ticketAId: string;
let ticketBId: string;

function pieceLine(pieceId: string, name: string, weightEach: number) {
  return {
    quoteLineItemId: quoteLineId,
    productId: null,
    jobStructureId: structureId,
    jobStructurePieceId: pieceId,
    lineType: "CUSTOM_STRUCTURE" as const,
    itemCode: "WW-1",
    description: `Wet Well — ${name}`,
    quantity: 1,
    unit: "EA",
    weightEach,
    yardLocation: null,
  };
}

function ticketInput(lines: ReturnType<typeof pieceLine>[]) {
  return {
    ticketType: "JOB" as const,
    fulfillmentMethod: "DELIVERY" as const,
    status: "DRAFT" as const,
    jobId,
    quoteId,
    quoteNumber: `${tag}-Q1`,
    jobNumber: `${tag}-JOB`,
    customerName: `${tag} Contractor`,
    projectName: `${tag} project`,
    deliveryDate: null,
    lines,
  };
}

beforeAll(async () => {
  const customer = await prisma.customer.create({
    data: { name: `${tag} Contractor` },
  });
  customerId = customer.id;

  const job = await prisma.job.create({
    data: {
      jobNumber: `${tag}-JOB`,
      year: 2026,
      yearTwoDigit: 26,
      sequenceNumber: 9902,
      customerId,
      customerName: customer.name,
      projectName: `${tag} project`,
      status: "AWARDED",
    },
  });
  jobId = job.id;

  const structure = await prisma.jobStructure.create({
    data: {
      jobId,
      structureType: "CUSTOM_STRUCTURE",
      structureNumber: "WW-1",
      description: `${tag} Wet Well`,
      quantity: 1,
      unit: "EA",
      weight: 24600,
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
      taxRate: 0,
      lineItems: {
        create: [
          {
            lineNumber: 1,
            lineType: "CUSTOM_STRUCTURE",
            jobStructureId: structureId,
            itemCode: "WW-1",
            description: `${tag} Wet Well`,
            quantity: 1,
            unit: "EA",
            unitPrice: STRUCTURE_PRICE,
            taxable: false,
            total: STRUCTURE_PRICE,
          },
        ],
      },
    },
    include: { lineItems: true },
  });
  quoteId = quote.id;
  quoteLineId = quote.lineItems[0].id;
});

afterAll(async () => {
  await prisma.invoiceLineItem.deleteMany({
    where: { invoice: { customerName: { startsWith: tag } } },
  });
  await prisma.invoice.deleteMany({
    where: { customerName: { startsWith: tag } },
  });
  await prisma.deliveryTicketLineItem.deleteMany({
    where: { deliveryTicket: { customerName: { startsWith: tag } } },
  });
  await prisma.deliveryTicket.deleteMany({
    where: { customerName: { startsWith: tag } },
  });
  await prisma.jobStructurePiece.deleteMany({
    where: { jobStructure: { jobId } },
  });
  await prisma.quoteLineItem.deleteMany({
    where: { quote: { quoteNumber: { startsWith: tag } } },
  });
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.jobStructure.deleteMany({ where: { jobId } });
  await prisma.job.deleteMany({ where: { jobNumber: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("split structure shipping", () => {
  it("rejects a split with fewer than two pieces", async () => {
    const result = await splitStructureForShipping(structureId, [
      { name: "Only piece", weightLbs: null },
    ]);
    expect(result).toEqual({ error: "Split into at least two pieces." });
  });

  it("splits the structure into named pieces", async () => {
    const result = await splitStructureForShipping(structureId, [
      { name: "Base", weightLbs: 8200 },
      { name: "Riser 1", weightLbs: 5500 },
      { name: "Top Slab", weightLbs: 5400 },
    ]);
    expect(result).toEqual({ success: true });

    const pieces = await prisma.jobStructurePiece.findMany({
      where: { jobStructureId: structureId },
      orderBy: { sortOrder: "asc" },
    });
    expect(pieces.map((piece) => piece.name)).toEqual([
      "Base",
      "Riser 1",
      "Top Slab",
    ]);
    pieceIds = pieces.map((piece) => piece.id);
  });

  it("rejects a whole-structure line once split", async () => {
    const result = await createDeliveryTicket(
      ticketInput([
        {
          ...pieceLine(pieceIds[0], "whole", 24600),
          jobStructurePieceId: null as unknown as string,
        },
      ]),
    );
    expect("error" in result && result.error).toMatch(/split into pieces/i);
  });

  it("ships pieces across two tickets and rejects double-claims", async () => {
    const ticketA = await createDeliveryTicket(
      ticketInput([
        pieceLine(pieceIds[0], "Base", 8200),
        pieceLine(pieceIds[1], "Riser 1", 5500),
      ]),
    );
    expect("success" in ticketA && ticketA.success).toBe(true);
    ticketAId = (ticketA as { ticketId: string }).ticketId;

    // Piece already claimed by ticket A
    const doubleClaim = await createDeliveryTicket(
      ticketInput([pieceLine(pieceIds[0], "Base", 8200)]),
    );
    expect("error" in doubleClaim && doubleClaim.error).toMatch(/already on/i);

    const ticketB = await createDeliveryTicket(
      ticketInput([pieceLine(pieceIds[2], "Top Slab", 5400)]),
    );
    expect("success" in ticketB && ticketB.success).toBe(true);
    ticketBId = (ticketB as { ticketId: string }).ticketId;
  });

  it("refuses to unsplit while pieces are on tickets", async () => {
    const result = await unsplitStructure(structureId);
    expect("error" in result && result.error).toMatch(/already on delivery tickets/i);
  });

  it("marks the structure SHIPPED only after the last piece delivers", async () => {
    await markDeliveryTicketDelivered(prisma, ticketAId);
    let structure = await prisma.jobStructure.findUniqueOrThrow({
      where: { id: structureId },
    });
    expect(structure.status).toBe("MADE");

    await markDeliveryTicketDelivered(prisma, ticketBId);
    structure = await prisma.jobStructure.findUniqueOrThrow({
      where: { id: structureId },
    });
    expect(structure.status).toBe("SHIPPED");
    expect(structure.shippedDate).not.toBeNull();
  });

  it("bills the structure price exactly once across the invoices", async () => {
    const invoiceAId = await convertDeliveryTicketToInvoice(prisma, ticketAId);
    const invoiceA = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
      include: { lineItems: { orderBy: { lineNumber: "asc" } } },
    });
    expect(Number(invoiceA.total)).toBe(STRUCTURE_PRICE);
    const [firstLine, secondLine] = invoiceA.lineItems;
    expect(Number(firstLine.unitPrice)).toBe(STRUCTURE_PRICE);
    expect(Number(secondLine.unitPrice)).toBe(0);
    expect(secondLine.description).toContain("(included)");
    // An "(included)" piece is $0 on purpose: it never waits for a price.
    expect(invoiceA.lineItems.map((line) => line.needsPrice)).toEqual([
      false,
      false,
    ]);

    const invoiceBId = await convertDeliveryTicketToInvoice(prisma, ticketBId);
    const invoiceB = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceBId },
      include: { lineItems: true },
    });
    expect(Number(invoiceB.total)).toBe(0);
    expect(Number(invoiceB.lineItems[0].unitPrice)).toBe(0);
    expect(invoiceB.lineItems[0].description).toContain("(included)");
    expect(invoiceB.lineItems[0].needsPrice).toBe(false);
  });

  it("asks for an unpriced structure's price once, on its first piece", async () => {
    // A structure nobody priced: $0 on the quote line.
    const structure = await prisma.jobStructure.create({
      data: {
        jobId,
        structureType: "CUSTOM_STRUCTURE",
        structureNumber: "WW-2",
        description: `${tag} Unpriced Wet Well`,
        quantity: 1,
        unit: "EA",
        status: "MADE",
        pieces: {
          create: [
            { name: "Base", sortOrder: 0 },
            { name: "Riser", sortOrder: 1 },
            { name: "Top Slab", sortOrder: 2 },
          ],
        },
      },
      include: { pieces: { orderBy: { sortOrder: "asc" } } },
    });
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `${tag}-Q2`,
        jobId,
        customerId,
        customerName: `${tag} Contractor`,
        projectName: `${tag} project`,
        status: "WON",
        taxRate: 0,
        lineItems: {
          create: {
            lineNumber: 1,
            lineType: "CUSTOM_STRUCTURE",
            jobStructureId: structure.id,
            itemCode: "WW-2",
            description: `${tag} Unpriced Wet Well`,
            quantity: 1,
            unit: "EA",
            unitPrice: 0,
            taxable: false,
            total: 0,
          },
        },
      },
      include: { lineItems: true },
    });
    const ticketWith = (suffix: string, pieces: typeof structure.pieces) =>
      prisma.deliveryTicket.create({
        data: {
          ticketNumber: `${tag}-U${suffix}X`,
          ticketType: "JOB",
          status: "SCHEDULED",
          jobId,
          quoteId: quote.id,
          jobNumber: `${tag}-JOB`,
          customerName: `${tag} Contractor`,
          projectName: `${tag} project`,
          lineItems: {
            create: pieces.map((piece, index) => ({
              lineNumber: index + 1,
              sortOrder: index,
              lineType: "CUSTOM_STRUCTURE" as const,
              quoteLineItemId: quote.lineItems[0]!.id,
              jobStructureId: structure.id,
              jobStructurePieceId: piece.id,
              itemCode: "WW-2",
              description: `Unpriced Wet Well — ${piece.name}`,
              quantity: 1,
              unit: "EA",
            })),
          },
        },
      });
    const [base, riser, topSlab] = structure.pieces;
    const firstTicket = await ticketWith("1", [base!, riser!]);
    const secondTicket = await ticketWith("2", [topSlab!]);

    // First load: the invoice is made anyway, and its first piece carries
    // the missing price. The second piece is "(included)" as always.
    expect(await deliverTicket(firstTicket.id)).toMatchObject({
      success: true,
      invoiceCreated: true,
      warning: null,
    });
    const first = await prisma.invoice.findUniqueOrThrow({
      where: { deliveryTicketId: firstTicket.id },
      include: { lineItems: { orderBy: { lineNumber: "asc" } } },
    });
    expect(first.lineItems.map((line) => line.needsPrice)).toEqual([
      true,
      false,
    ]);
    expect(first.lineItems[0]!.description).not.toContain("(included)");
    expect(first.lineItems[1]!.description).toContain("(included)");

    // Second load, still unpriced: the price is already being asked for on
    // the first invoice, so this piece is "(included)", not a second ask.
    expect(await deliverTicket(secondTicket.id)).toMatchObject({
      success: true,
      invoiceCreated: true,
    });
    const second = await prisma.invoice.findUniqueOrThrow({
      where: { deliveryTicketId: secondTicket.id },
      include: { lineItems: true },
    });
    expect(second.lineItems).toHaveLength(1);
    expect(second.lineItems[0]).toMatchObject({ needsPrice: false });
    expect(second.lineItems[0]!.description).toContain("(included)");

    // Typing the price on the first invoice bills the structure once.
    const priced = await updateInvoice({
      invoiceId: first.id,
      taxRate: 0,
      discountAmount: 0,
      deletedLineIds: [],
      lines: first.lineItems.map((line, index) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: line.description ?? "",
        quantity: Number(line.quantity),
        unit: line.unit,
        unitPrice: index === 0 ? 18500 : 0,
        needsPrice: false,
        taxable: line.taxable,
      })),
    });
    expect(priced.error).toBeUndefined();
    const saved = await prisma.invoice.findUniqueOrThrow({
      where: { id: first.id },
      include: { lineItems: true },
    });
    expect(Number(saved.total)).toBe(18500);
    expect(saved.lineItems.some((line) => line.needsPrice)).toBe(false);
  });
});
