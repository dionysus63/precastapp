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
vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import { deleteDrillSheet } from "@/app/drill-sheets/actions";
import { deleteStructureTemplate } from "@/app/structures/actions";
import { convertTicketToInvoice, deliverTicket } from "@/app/operations/actions";
import { markDeliveryTicketDelivered } from "@/lib/delivery-fulfillment";
import { prisma } from "@/lib/prisma";

const tag = `STATUSGUARD-${Date.now()}`;

let jobId: string;

function ticket(status: "DRAFT" | "SCHEDULED" | "CANCELLED" | "DELIVERED", extra = {}) {
  return prisma.deliveryTicket.create({
    data: {
      customerName: `${tag} Customer`,
      projectName: `${tag} project`,
      status,
      deliveryDate: new Date(2099, 2, 17),
      ...extra,
    },
  });
}

beforeAll(async () => {
  const job = await prisma.job.create({
    data: {
      jobNumber: `${tag}-JOB`,
      year: 2099,
      yearTwoDigit: 99,
      sequenceNumber: Number(String(Date.now()).slice(-7)),
      customerName: `${tag} Customer`,
      projectName: `${tag} project`,
      status: "ACTIVE",
    },
  });
  jobId = job.id;
});

afterAll(async () => {
  // Marking a ticket delivered makes its invoice.
  await prisma.invoice.deleteMany({
    where: { customerName: `${tag} Customer` },
  });
  await prisma.deliveryTicket.deleteMany({
    where: { customerName: `${tag} Customer` },
  });
  await prisma.jobStructure.deleteMany({ where: { jobId } });
  await prisma.job.delete({ where: { id: jobId } });
  await prisma.$disconnect();
});

describe("delivery ticket status guards", () => {
  it("refuses to deliver a cancelled ticket", async () => {
    const cancelled = await ticket("CANCELLED");
    await expect(
      markDeliveryTicketDelivered(prisma, cancelled.id),
    ).rejects.toThrow(/cancelled/i);

    const result = await deliverTicket(cancelled.id);
    expect(result).toHaveProperty("error");
    expect(
      (await prisma.deliveryTicket.findUniqueOrThrow({ where: { id: cancelled.id } }))
        .status,
    ).toBe("CANCELLED");
  });

  it("delivering a ticket makes its invoice and leaves the day's other tickets alone", async () => {
    const draft = await ticket("DRAFT");
    const scheduled = await ticket("SCHEDULED");

    const result = await deliverTicket(scheduled.id);
    expect(result).toMatchObject({ success: true, invoiceCreated: true });

    const [draftAfter, scheduledAfter] = await Promise.all([
      prisma.deliveryTicket.findUniqueOrThrow({ where: { id: draft.id } }),
      prisma.deliveryTicket.findUniqueOrThrow({ where: { id: scheduled.id } }),
    ]);
    expect(draftAfter.status).toBe("DRAFT");
    expect(scheduledAfter.status).toBe("DELIVERED");
    // The delivered ticket gets its invoice in the same click.
    expect(
      await prisma.invoice.count({
        where: { deliveryTicketId: { in: [draft.id, scheduled.id] } },
      }),
    ).toBe(1);
    expect(
      await prisma.invoice.findUnique({
        where: { deliveryTicketId: scheduled.id },
        select: { status: true },
      }),
    ).toEqual({ status: "SENT" });
  });

  it("doesn't flip payment received on a sale that's already complete", async () => {
    const completed = await ticket("DELIVERED", {
      deliveredAt: new Date(),
      ticketType: "WALK_IN",
      fulfillmentMethod: "PICKUP",
      paymentReceived: false,
    });

    const result = await deliverTicket(completed.id, { paymentReceived: true });
    expect(result).toMatchObject({ success: true });
    expect((result as { warning: string | null }).warning).toMatch(
      /already completed/i,
    );
    expect(
      (await prisma.deliveryTicket.findUniqueOrThrow({ where: { id: completed.id } }))
        .paymentReceived,
    ).toBe(false);
  });
});

describe("a delivered ticket with no invoice", () => {
  it("gets one from Convert to Invoice, and only one", async () => {
    // Delivered with no invoice: delivered before invoices were made at
    // delivery, or its invoice was deleted on purpose.
    const delivered = await ticket("DELIVERED", {
      deliveredAt: new Date(2099, 2, 17, 10),
      ticketNumber: `${tag}-T1X`,
    });
    const invoiceOf = () =>
      prisma.invoice.findUnique({
        where: { deliveryTicketId: delivered.id },
        select: { id: true, status: true },
      });
    expect(await invoiceOf()).toBeNull();

    // The catch-up is its own, deliberate click on that ticket.
    const made = await convertTicketToInvoice(delivered.id);
    const invoice = await invoiceOf();
    expect(invoice).toMatchObject({ status: "SENT" });
    expect(made).toEqual({ invoiceId: invoice?.id });

    // A second click hands back the same invoice instead of making another.
    expect(await convertTicketToInvoice(delivered.id)).toEqual({
      invoiceId: invoice?.id,
    });
    expect(
      await prisma.invoice.count({ where: { deliveryTicketId: delivered.id } }),
    ).toBe(1);
  });
});

describe("structure delete guard", () => {
  it("refuses to delete a structure that's been made, deletes one that hasn't", async () => {
    const made = await prisma.jobStructure.create({
      data: {
        jobId,
        structureType: "CUSTOM_STRUCTURE",
        structureNumber: "MH-MADE",
        quantity: 1,
        unit: "EA",
        status: "MADE",
      },
    });
    const fresh = await prisma.jobStructure.create({
      data: {
        jobId,
        structureType: "CUSTOM_STRUCTURE",
        structureNumber: "MH-NEW",
        quantity: 1,
        unit: "EA",
      },
    });

    const refused = await deleteDrillSheet(made.id);
    expect(refused).toEqual({
      error: expect.stringMatching(/MH-MADE is made/),
    });
    expect(await prisma.jobStructure.findUnique({ where: { id: made.id } })).not.toBeNull();

    const deleted = await deleteDrillSheet(fresh.id);
    expect(deleted).toBeUndefined();
    expect(await prisma.jobStructure.findUnique({ where: { id: fresh.id } })).toBeNull();
  });
});

describe("structure template delete guard", () => {
  it("keeps a template that drill sheets use; deletes an unused one", async () => {
    const used = await prisma.structureTemplate.create({
      data: { name: `${tag} used template`, shape: "CIRCULAR" },
    });
    const unused = await prisma.structureTemplate.create({
      data: { name: `${tag} unused template`, shape: "CIRCULAR" },
    });
    await prisma.jobStructure.create({
      data: {
        jobId,
        structureType: "CONFIGURABLE_PRODUCT",
        structureNumber: "MH-TPL",
        quantity: 1,
        unit: "EA",
        structureTemplateId: used.id,
      },
    });

    try {
      const refused = await deleteStructureTemplate(used.id);
      expect(refused).toEqual({
        error: expect.stringMatching(/1 drill sheet uses this template/),
      });
      expect(
        await prisma.structureTemplate.findUnique({ where: { id: used.id } }),
      ).not.toBeNull();

      expect(await deleteStructureTemplate(unused.id)).toBeUndefined();
      expect(
        await prisma.structureTemplate.findUnique({ where: { id: unused.id } }),
      ).toBeNull();
    } finally {
      await prisma.jobStructure.deleteMany({ where: { structureTemplateId: used.id } });
      await prisma.structureTemplate.deleteMany({
        where: { name: { startsWith: tag } },
      });
    }
  });
});
