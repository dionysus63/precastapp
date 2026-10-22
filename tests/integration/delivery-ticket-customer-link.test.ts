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
  updateDeliveryTicket,
} from "@/app/delivery-tickets/actions";
import { prisma } from "@/lib/prisma";

const tag = `CUSTLINK-${Date.now()}`;

let customerId: string;
let jobId: string;
let quoteId: string;
let quoteLineId: string;

function productLine(quantity: number) {
  return {
    quoteLineItemId: quoteLineId,
    productId: null,
    jobStructureId: null,
    jobStructurePieceId: null,
    lineType: "STOCK_PRODUCT" as const,
    itemCode: "CB-48",
    description: `${tag} catch basin`,
    quantity,
    unit: "EA",
    weightEach: 4000,
    yardLocation: null,
  };
}

function ticketInput(overrides: Record<string, unknown> = {}) {
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
    lines: [productLine(1)],
    ...overrides,
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
      sequenceNumber: 9903,
      customerId,
      customerName: customer.name,
      projectName: `${tag} project`,
      status: "AWARDED",
    },
  });
  jobId = job.id;

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
            lineType: "STOCK_PRODUCT",
            itemCode: "CB-48",
            description: `${tag} catch basin`,
            quantity: 10,
            unit: "EA",
            unitPrice: 1000,
            taxable: false,
            total: 10000,
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
  await prisma.job.deleteMany({ where: { jobNumber: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("delivery ticket customer linking", () => {
  it("links the job's customer when the input carries only a name", async () => {
    const result = await createDeliveryTicket(ticketInput());
    expect("success" in result && result.success).toBe(true);

    const ticket = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: (result as { ticketId: string }).ticketId },
      select: { customerId: true },
    });
    expect(ticket.customerId).toBe(customerId);
  });

  it("links by exact name match when there is no job link", async () => {
    const result = await createDeliveryTicket(
      ticketInput({
        ticketType: "WALK_IN",
        fulfillmentMethod: "PICKUP",
        jobId: null,
        quoteId: null,
        quoteNumber: null,
        jobNumber: null,
        customerName: `${tag.toLowerCase()} CONTRACTOR`,
        lines: [{ ...productLine(1), quoteLineItemId: null }],
      }),
    );
    expect("success" in result && result.success).toBe(true);

    const ticket = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: (result as { ticketId: string }).ticketId },
      select: { customerId: true },
    });
    expect(ticket.customerId).toBe(customerId);
  });

  it("backfills the link when an unlinked ticket is edited", async () => {
    const created = await createDeliveryTicket(ticketInput());
    const ticketId = (created as { ticketId: string }).ticketId;
    await prisma.deliveryTicket.update({
      where: { id: ticketId },
      data: { customerId: null },
    });

    const updated = await updateDeliveryTicket(ticketId, ticketInput());
    expect("success" in updated && updated.success).toBe(true);

    const ticket = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { customerId: true },
    });
    expect(ticket.customerId).toBe(customerId);
  });

  it("keeps fields the editor doesn't send when a ticket is edited", async () => {
    const created = await createDeliveryTicket(ticketInput());
    const ticketId = (created as { ticketId: string }).ticketId;
    await prisma.deliveryTicket.update({
      where: { id: ticketId },
      data: {
        deliveryTime: "07:00",
        loadSequence: "2 of 3",
        internalNotes: "Crane on site",
        siteContactName: "Foreman",
        craneRequired: true,
        customLine: "2nd",
      },
    });

    const updated = await updateDeliveryTicket(ticketId, ticketInput());
    expect("success" in updated && updated.success).toBe(true);

    const ticket = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(ticket.deliveryTime).toBe("07:00");
    expect(ticket.loadSequence).toBe("2 of 3");
    expect(ticket.internalNotes).toBe("Crane on site");
    expect(ticket.siteContactName).toBe("Foreman");
    expect(ticket.craneRequired).toBe(true);
    expect(ticket.customLine).toBe("2nd");

    // An explicit value still saves, and an explicit blank clears.
    await updateDeliveryTicket(
      ticketId,
      ticketInput({ customLine: "  Load 3  ", internalNotes: null }),
    );
    const edited = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(edited.customLine).toBe("Load 3");
    expect(edited.internalNotes).toBeNull();
  });

  it("leaves customerId null when nothing matches", async () => {
    const result = await createDeliveryTicket(
      ticketInput({
        ticketType: "WALK_IN",
        fulfillmentMethod: "PICKUP",
        jobId: null,
        quoteId: null,
        quoteNumber: null,
        jobNumber: null,
        customerName: `${tag} One-Off Buyer`,
        lines: [{ ...productLine(1), quoteLineItemId: null }],
      }),
    );
    expect("success" in result && result.success).toBe(true);

    const ticket = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: (result as { ticketId: string }).ticketId },
      select: { customerId: true },
    });
    expect(ticket.customerId).toBeNull();
  });
});
