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

import { createDeliveryTicket } from "@/app/delivery-tickets/actions";
import {
  getQuoteLineFulfillment,
  markDeliveryTicketDelivered,
} from "@/lib/delivery-fulfillment";
import { prisma } from "@/lib/prisma";

// A structure quoted as a quantity (sound wall panels) ships over several
// loads. The structure must stay schedulable until every unit is delivered.
const tag = `PARTIALSHIP-${Date.now()}`;
const QUOTED_QTY = 10;

let customerId: string;
let jobId: string;
let quoteId: string;
let quoteLineId: string;
let structureId: string;

function structureLine(quantity: number) {
  return {
    quoteLineItemId: quoteLineId,
    productId: null,
    jobStructureId: structureId,
    jobStructurePieceId: null,
    lineType: "CUSTOM_STRUCTURE" as const,
    itemCode: "SW-1",
    description: `${tag} Sound Wall Panel`,
    quantity,
    unit: "EA",
    weightEach: 6000,
    yardLocation: null,
  };
}

function ticketInput(quantity: number) {
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
    lines: [structureLine(quantity)],
  };
}

async function structureStatus() {
  const structure = await prisma.jobStructure.findUniqueOrThrow({
    where: { id: structureId },
    select: { status: true },
  });
  return structure.status;
}

async function fulfillmentLine() {
  const lines = await getQuoteLineFulfillment(prisma, quoteId);
  return lines.find((line) => line.quoteLineItemId === quoteLineId)!;
}

async function deliverNewTicket(quantity: number) {
  const created = await createDeliveryTicket(ticketInput(quantity));
  expect("success" in created && created.success).toBe(true);
  const ticketId = (created as { ticketId: string }).ticketId;
  await markDeliveryTicketDelivered(prisma, ticketId);
  return ticketId;
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
      sequenceNumber: 9903,
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
      structureNumber: "SW-1",
      description: `${tag} Sound Wall Panel`,
      quantity: QUOTED_QTY,
      unit: "EA",
      weight: 6000,
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
            itemCode: "SW-1",
            description: `${tag} Sound Wall Panel`,
            quantity: QUOTED_QTY,
            unit: "EA",
            unitPrice: 1500,
            taxable: false,
            total: 1500 * QUOTED_QTY,
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
  await prisma.deliveryTicketLineItem.deleteMany({
    where: { deliveryTicket: { customerName: { startsWith: tag } } },
  });
  await prisma.deliveryTicket.deleteMany({
    where: { customerName: { startsWith: tag } },
  });
  await prisma.quoteLineItem.deleteMany({ where: { quoteId } });
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.jobStructure.deleteMany({ where: { id: structureId } });
  await prisma.job.deleteMany({ where: { jobNumber: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("shipping a quantity structure over several loads", () => {
  it("keeps the structure MADE and schedulable after a partial delivery", async () => {
    await deliverNewTicket(4);

    expect(await structureStatus()).toBe("MADE");
    const line = await fulfillmentLine();
    expect(line.shippedQty).toBe(4);
    expect(line.remainingQty).toBe(QUOTED_QTY - 4);
    expect(line.eligible).toBe(true);
    expect(line.eligibilityReason).toBeNull();
  });

  it("still lets the remaining units ship when an old partial delivery left it SHIPPED", async () => {
    // Structures marked SHIPPED by the earlier first-delivery rule.
    await prisma.jobStructure.update({
      where: { id: structureId },
      data: { status: "SHIPPED" },
    });

    const line = await fulfillmentLine();
    expect(line.eligible).toBe(true);
    expect(line.madeSoFarQty).toBe(QUOTED_QTY);

    const created = await createDeliveryTicket(ticketInput(3));
    expect("success" in created && created.success).toBe(true);
    const ticketId = (created as { ticketId: string }).ticketId;
    await markDeliveryTicketDelivered(prisma, ticketId);

    // 7 of 10 delivered: not fully shipped, so the status is left alone.
    expect(await structureStatus()).toBe("SHIPPED");
    expect((await fulfillmentLine()).remainingQty).toBe(3);

    await prisma.jobStructure.update({
      where: { id: structureId },
      data: { status: "MADE" },
    });
  });

  it("marks the structure SHIPPED once the last units deliver", async () => {
    await deliverNewTicket(3);

    expect(await structureStatus()).toBe("SHIPPED");
    const line = await fulfillmentLine();
    expect(line.remainingQty).toBe(0);
    expect(line.eligible).toBe(false);
    expect(line.eligibilityReason).toBe("Fully shipped");
  });
});
