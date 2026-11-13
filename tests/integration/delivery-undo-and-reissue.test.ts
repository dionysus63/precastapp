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
vi.mock("server-only", () => ({}));

import {
  getUndoDeliveryImpact,
  updateDeliveryTicketStatus,
} from "@/app/delivery-tickets/actions";
import { reopenVoidedInvoice, voidInvoice } from "@/app/invoices/actions";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  markDeliveryTicketDelivered,
  UndoDeliveryNeedsInvoiceRemovalError,
  undoTicketDelivery,
} from "@/lib/delivery-fulfillment";
import { loadProductEditVersion } from "@/lib/product-edit-version";
import { prisma } from "@/lib/prisma";

const tag = `UNDO-${Date.now()}`;

let productId: string;
let ticketId: string;

async function stock() {
  return (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
    .currentStockQuantity;
}

beforeAll(async () => {
  const category = await prisma.productCategory.create({
    data: { name: `${tag} Category`, productType: "STOCK_PRECAST" },
  });
  const product = await prisma.product.create({
    data: {
      productCode: `${tag}-P1`,
      name: `${tag} Product`,
      categoryId: category.id,
      trackInventory: true,
      currentStockQuantity: 10,
    },
  });
  productId = product.id;

  const ticket = await prisma.deliveryTicket.create({
    data: {
      ticketNumber: `${tag}-T1X`,
      customerName: `${tag} Customer`,
      projectName: `${tag} project`,
      status: "SCHEDULED",
      lineItems: {
        create: {
          lineNumber: 1,
          lineType: "STOCK_PRODUCT",
          productId,
          itemCode: `${tag}-P1`,
          quantity: 3,
          unit: "EA",
          unitPrice: 50,
        },
      },
    },
  });
  ticketId = ticket.id;
});

afterAll(async () => {
  await prisma.invoice.deleteMany({ where: { customerName: `${tag} Customer` } });
  await prisma.deliveryTicket.deleteMany({ where: { customerName: `${tag} Customer` } });
  await prisma.inventoryTransaction.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { productCode: { startsWith: tag } } });
  await prisma.productCategory.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("undoing a delivery", () => {
  it("restores stock and lets the ticket be delivered (and undone) again", async () => {
    await markDeliveryTicketDelivered(prisma, ticketId);
    expect(await stock()).toBe(7);

    await undoTicketDelivery(prisma, ticketId, "SCHEDULED", "Test User");
    expect(await stock()).toBe(10);
    const reopened = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { lineItems: true },
    });
    expect(reopened.status).toBe("SCHEDULED");
    expect(reopened.deliveredAt).toBeNull();
    expect(reopened.lineItems[0]!.status).toBe("NOT_READY");

    // Second cycle: deducts and credits again (reversals pair by count).
    await markDeliveryTicketDelivered(prisma, ticketId);
    expect(await stock()).toBe(7);
    await undoTicketDelivery(prisma, ticketId, "SCHEDULED");
    expect(await stock()).toBe(10);
  });

  async function ticketNow() {
    return prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { invoice: true },
    });
  }

  it("takes the unpaid invoice away with the delivery, but only after asking", async () => {
    // Marking delivered makes the invoice.
    const delivered = await updateDeliveryTicketStatus(ticketId, "DELIVERED");
    expect(delivered).toMatchObject({ success: true, warning: null });
    const invoice = (await ticketNow()).invoice!;
    expect(invoice.status).toBe("SENT");
    expect(Number(invoice.total)).toBeGreaterThan(0);
    expect((delivered as { invoiceMade: string }).invoiceMade).toBe(
      invoice.invoiceNumber,
    );

    // The screen asks first, so it can name the invoice.
    expect(await getUndoDeliveryImpact(ticketId)).toEqual({
      invoice: { invoiceNumber: invoice.invoiceNumber, status: "SENT" },
    });

    // Without the user's yes the undo is refused and nothing changes.
    await expect(
      undoTicketDelivery(prisma, ticketId, "SCHEDULED"),
    ).rejects.toBeInstanceOf(UndoDeliveryNeedsInvoiceRemovalError);
    const refused = await updateDeliveryTicketStatus(ticketId, "SCHEDULED");
    expect(refused).toMatchObject({
      error: expect.stringMatching(/deletes that invoice too/i),
      needsInvoiceRemoval: { invoiceNumber: invoice.invoiceNumber },
    });
    expect((await ticketNow()).status).toBe("DELIVERED");
    expect((await ticketNow()).invoice?.id).toBe(invoice.id);
    expect(await stock()).toBe(7);

    // With it, the delivery and its invoice are both undone, and it is logged.
    vi.mocked(writeAuditLog).mockClear();
    const undone = await updateDeliveryTicketStatus(ticketId, "SCHEDULED", {
      removeUnpaidInvoice: true,
    });
    expect(undone).toMatchObject({ success: true });
    const after = await ticketNow();
    expect(after.status).toBe("SCHEDULED");
    expect(after.invoice).toBeNull();
    expect(await stock()).toBe(10);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invoice.delete",
        summary: expect.stringContaining(invoice.invoiceNumber),
      }),
    );
    expect(await getUndoDeliveryImpact(ticketId)).toEqual({ invoice: null });
  });

  it("refuses while the invoice is paid, and keeps a voided one on file", async () => {
    // Delivered again: a fresh invoice.
    await updateDeliveryTicketStatus(ticketId, "DELIVERED");
    const invoice = (await ticketNow()).invoice!;
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID" },
    });

    // A paid invoice blocks the undo, yes or no.
    const blocked = await updateDeliveryTicketStatus(ticketId, "CANCELLED", {
      removeUnpaidInvoice: true,
    });
    expect(blocked).toMatchObject({
      error: expect.stringMatching(/is paid\. Void the invoice first/i),
    });
    expect(blocked).not.toHaveProperty("needsInvoiceRemoval");
    expect((await ticketNow()).status).toBe("DELIVERED");
    expect((await ticketNow()).invoice?.status).toBe("PAID");
    expect(await stock()).toBe(7);

    // Voided, it no longer bills anything: the undo goes through without
    // being asked about it, and the void stays as the record it is.
    expect(await voidInvoice(invoice.id)).toEqual({ success: true });
    const undone = await updateDeliveryTicketStatus(ticketId, "SCHEDULED");
    expect(undone).toMatchObject({ success: true });
    expect((await ticketNow()).status).toBe("SCHEDULED");
    expect((await ticketNow()).invoice).toMatchObject({
      id: invoice.id,
      status: "VOID",
    });
    expect(await stock()).toBe(10);

    // Delivering again does not bill over the void; it says so instead.
    const redelivered = await updateDeliveryTicketStatus(ticketId, "DELIVERED");
    expect(redelivered).toMatchObject({ success: true, invoiceMade: null });
    expect((redelivered as { warning: string }).warning).toMatch(
      /is void, so no new invoice was made/i,
    );
    expect(
      await prisma.invoice.count({ where: { deliveryTicketId: ticketId } }),
    ).toBe(1);

    // A voided invoice can be reopened: open again, same number and ticket.
    expect(await reopenVoidedInvoice(invoice.id)).toEqual({ success: true });
    const reopened = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(reopened.status).toBe("SENT");
    expect(reopened.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(reopened.deliveryTicketId).toBe(ticketId);
    expect(await reopenVoidedInvoice(invoice.id)).toEqual({
      error: "Only voided invoices can be reopened.",
    });
  });
});

describe("product edit version", () => {
  it("ignores stock movements but changes when an edited field does", async () => {
    const before = await loadProductEditVersion(prisma, productId);
    await prisma.product.update({
      where: { id: productId },
      data: { currentStockQuantity: { increment: 5 } },
    });
    expect(await loadProductEditVersion(prisma, productId)).toBe(before);

    await prisma.product.update({
      where: { id: productId },
      data: { name: `${tag} Renamed` },
    });
    expect(await loadProductEditVersion(prisma, productId)).not.toBe(before);
  });
});
