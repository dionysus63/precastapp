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

import { reopenVoidedInvoice } from "@/app/invoices/actions";
import {
  markDeliveryTicketDelivered,
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

  it("refuses while a live invoice bills the delivery", async () => {
    await markDeliveryTicketDelivered(prisma, ticketId);
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `${tag}-I1`,
        year: 2099,
        yearTwoDigit: 99,
        sequenceNumber: Number(String(Date.now()).slice(-7)),
        deliveryTicketId: ticketId,
        customerName: `${tag} Customer`,
        projectName: `${tag} project`,
        status: "SENT",
      },
    });

    await expect(
      undoTicketDelivery(prisma, ticketId, "CANCELLED"),
    ).rejects.toThrow(/void it/i);
    expect(
      (await prisma.deliveryTicket.findUniqueOrThrow({ where: { id: ticketId } }))
        .status,
    ).toBe("DELIVERED");
    expect(await stock()).toBe(7);

    // A voided invoice can be reopened as a draft (same number and ticket).
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "VOID" } });
    expect(await reopenVoidedInvoice(invoice.id)).toEqual({ success: true });
    const reopened = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(reopened.status).toBe("DRAFT");
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
