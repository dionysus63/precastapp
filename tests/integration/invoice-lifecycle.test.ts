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
  finalizeInvoices,
  markInvoicePaid,
  updateDraftInvoice,
  voidInvoice,
  type UpdateDraftInvoiceInput,
} from "@/app/invoices/actions";
import { prisma } from "@/lib/prisma";

const tag = `INVLIFE-${Date.now()}`;

let invoiceAId: string;
let invoiceCId: string;
let lineAId: string;
let lineBId: string;
let lineCId: string;

async function createTicketAndInvoice(suffix: string, sequence: number) {
  const ticket = await prisma.deliveryTicket.create({
    data: {
      ticketNumber: `${tag}-T${suffix}`,
      year: 2026,
      yearTwoDigit: 26,
      sequenceNumber: sequence,
      customerName: `${tag} Customer`,
      projectName: `${tag} Project`,
      status: "DELIVERED",
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `${tag}-I${suffix}`,
      year: 2026,
      yearTwoDigit: 26,
      sequenceNumber: sequence,
      deliveryTicketId: ticket.id,
      customerName: `${tag} Customer`,
      projectName: `${tag} Project`,
      status: "DRAFT",
      subtotal: 100,
      total: 100,
      lineItems: {
        create: {
          lineNumber: 1,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-ITEM-${suffix}`,
          description: `Original line ${suffix}`,
          quantity: 1,
          unit: "EA",
          unitPrice: 100,
          taxable: false,
          total: 100,
          sortOrder: 0,
        },
      },
    },
    include: { lineItems: true },
  });
  return { invoice, lineId: invoice.lineItems[0]!.id };
}

beforeAll(async () => {
  const a = await createTicketAndInvoice("A", 9911);
  const b = await createTicketAndInvoice("B", 9912);
  const c = await createTicketAndInvoice("C", 9913);
  invoiceAId = a.invoice.id;
  invoiceCId = c.invoice.id;
  lineAId = a.lineId;
  lineBId = b.lineId;
  lineCId = c.lineId;
});

afterAll(async () => {
  await prisma.invoiceLineItem.deleteMany({
    where: { invoice: { invoiceNumber: { startsWith: tag } } },
  });
  await prisma.invoice.deleteMany({
    where: { invoiceNumber: { startsWith: tag } },
  });
  await prisma.deliveryTicket.deleteMany({
    where: { ticketNumber: { startsWith: tag } },
  });
});

function editInput(
  invoiceId: string,
  lines: UpdateDraftInvoiceInput["lines"],
  deletedLineIds: string[] = [],
): UpdateDraftInvoiceInput {
  return { invoiceId, taxRate: 0, discountAmount: 0, lines, deletedLineIds };
}

describe("invoice status transitions", () => {
  it("refuses to mark a draft invoice paid", async () => {
    const result = await markInvoicePaid(invoiceAId);
    expect(result.error).toMatch(/only finalized invoices/i);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
    });
    expect(invoice.status).toBe("DRAFT");
  });

  it("refuses to void a draft invoice", async () => {
    const result = await voidInvoice(invoiceAId);
    expect(result.error).toMatch(/finalized or paid/i);
  });

  it("finalizes drafts and refuses to re-finalize", async () => {
    const first = await finalizeInvoices([invoiceAId], "2026-07-01");
    expect(first.error).toBeUndefined();
    expect(first.finalized).toBe(1);

    const finalized = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
    });
    expect(finalized.status).toBe("SENT");
    expect(finalized.finalizedBy).toBe("Test User");
    const stampedAt = finalized.finalizedAt;

    const second = await finalizeInvoices([invoiceAId], "2026-07-05");
    expect(second.error).toMatch(/no draft invoices/i);

    const after = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
    });
    expect(after.finalizedAt?.getTime()).toBe(stampedAt?.getTime());
    expect(after.invoiceDate?.getTime()).toBe(
      finalized.invoiceDate?.getTime(),
    );
  });

  it("marks a finalized invoice paid without touching the invoice date", async () => {
    const before = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
    });

    const result = await markInvoicePaid(invoiceAId);
    expect(result.error).toBeUndefined();

    const paid = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
    });
    expect(paid.status).toBe("PAID");
    expect(paid.invoiceDate?.getTime()).toBe(before.invoiceDate?.getTime());

    // Paying twice is a no-op error, not a re-stamp.
    const again = await markInvoicePaid(invoiceAId);
    expect(again.error).toMatch(/only finalized invoices/i);
  });

  it("voids a paid invoice but never a voided one twice", async () => {
    const result = await voidInvoice(invoiceAId);
    expect(result.error).toBeUndefined();

    const voided = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
    });
    expect(voided.status).toBe("VOID");

    const again = await voidInvoice(invoiceAId);
    expect(again.error).toMatch(/finalized or paid/i);
  });
});

describe("draft invoice editing", () => {
  it("rejects edits to a non-draft invoice", async () => {
    await expect(
      updateDraftInvoice(
        editInput(invoiceAId, [
          {
            id: lineAId,
            lineNumber: 1,
            lineType: "STOCK_PRODUCT",
            itemCode: "HACK",
            description: "",
            quantity: 1,
            unit: "EA",
            unitPrice: 1,
            taxable: false,
          },
        ]),
      ),
    ).rejects.toThrow(/only draft invoices/i);
  });

  it("rejects a line id belonging to another invoice and rolls back atomically", async () => {
    const result = await updateDraftInvoice(
      editInput(invoiceCId, [
        // New line that must NOT survive the rollback.
        {
          lineNumber: 1,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-SMUGGLED`,
          description: "",
          quantity: 1,
          unit: "EA",
          unitPrice: 50,
          taxable: false,
        },
        // Foreign line id: belongs to invoice B, not C.
        {
          id: lineBId,
          lineNumber: 2,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-TAMPERED`,
          description: "",
          quantity: 9,
          unit: "EA",
          unitPrice: 999,
          taxable: false,
        },
      ]),
    );
    expect(result.error).toMatch(/changed or was removed/i);

    // Invoice B's line is untouched.
    const foreignLine = await prisma.invoiceLineItem.findUniqueOrThrow({
      where: { id: lineBId },
    });
    expect(foreignLine.itemCode).toBe(`${tag}-ITEM-B`);
    expect(Number(foreignLine.unitPrice)).toBe(100);

    // The whole save rolled back: no smuggled line on invoice C.
    const cLines = await prisma.invoiceLineItem.findMany({
      where: { invoiceId: invoiceCId },
    });
    expect(cLines).toHaveLength(1);
    expect(cLines[0]!.id).toBe(lineCId);
  });

  it("saves a draft edit atomically with recomputed totals", async () => {
    const result = await updateDraftInvoice(
      editInput(invoiceCId, [
        {
          id: lineCId,
          lineNumber: 1,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-ITEM-C`,
          description: "Updated line",
          quantity: 2,
          unit: "EA",
          unitPrice: 150,
          taxable: false,
        },
        {
          lineNumber: 2,
          lineType: "SERVICE",
          itemCode: `${tag}-SVC`,
          description: "Added service",
          quantity: 1,
          unit: "EA",
          unitPrice: 25,
          taxable: false,
        },
      ]),
    );
    expect(result.error).toBeUndefined();

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceCId },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    expect(invoice.lineItems).toHaveLength(2);
    expect(Number(invoice.subtotal)).toBe(325);
    expect(Number(invoice.total)).toBe(325);
    expect(Number(invoice.lineItems[0]!.total)).toBe(300);
    expect(Number(invoice.lineItems[1]!.total)).toBe(25);
  });
});
