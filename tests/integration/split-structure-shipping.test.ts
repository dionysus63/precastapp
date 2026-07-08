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

import {
  createDeliveryTicket,
  splitStructureForShipping,
  unsplitStructure,
} from "@/app/delivery-tickets/actions";
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
    where: { jobStructureId: structureId },
  });
  await prisma.quoteLineItem.deleteMany({ where: { quoteId } });
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.jobStructure.deleteMany({ where: { id: structureId } });
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

    const invoiceBId = await convertDeliveryTicketToInvoice(prisma, ticketBId);
    const invoiceB = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceBId },
      include: { lineItems: true },
    });
    expect(Number(invoiceB.total)).toBe(0);
    expect(Number(invoiceB.lineItems[0].unitPrice)).toBe(0);
    expect(invoiceB.lineItems[0].description).toContain("(included)");
  });
});
