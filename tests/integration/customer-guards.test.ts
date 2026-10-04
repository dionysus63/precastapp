import { afterAll, describe, expect, it, vi } from "vitest";

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
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import { deleteCustomer, importCustomers } from "@/app/customers/actions";
import { prisma } from "@/lib/prisma";

const tag = `CUSTGUARD-${Date.now()}`;

afterAll(async () => {
  await prisma.invoice.deleteMany({ where: { customerName: { startsWith: tag } } });
  await prisma.deliveryTicket.deleteMany({
    where: { customerName: { startsWith: tag } },
  });
  await prisma.customer.deleteMany({
    where: { name: { startsWith: tag, mode: "insensitive" } },
  });
  await prisma.$disconnect();
});

function deleteForm(id: string) {
  const formData = new FormData();
  formData.set("id", id);
  return formData;
}

describe("deleteCustomer", () => {
  it("refuses to delete a customer that has tickets and invoices", async () => {
    const customer = await prisma.customer.create({
      data: { name: `${tag} Walk-in Co` },
    });
    const ticket = await prisma.deliveryTicket.create({
      data: {
        customerId: customer.id,
        customerName: customer.name,
        projectName: "Counter sale",
        status: "DELIVERED",
      },
    });
    await prisma.invoice.create({
      data: {
        invoiceNumber: `${tag}-I1`,
        year: 2099,
        yearTwoDigit: 99,
        sequenceNumber: Number(String(Date.now()).slice(-7)),
        deliveryTicketId: ticket.id,
        customerId: customer.id,
        customerName: customer.name,
        projectName: "Counter sale",
      },
    });

    const result = await deleteCustomer(deleteForm(customer.id));
    expect(result).toEqual({
      error: expect.stringMatching(/1 delivery ticket, 1 invoice/),
    });
    expect(
      await prisma.customer.findUnique({ where: { id: customer.id } }),
    ).not.toBeNull();
  });

  it("deletes a customer with nothing attached", async () => {
    const customer = await prisma.customer.create({
      data: { name: `${tag} Unused Co` },
    });
    const result = await deleteCustomer(deleteForm(customer.id));
    expect(result).toBeUndefined();
    expect(await prisma.customer.findUnique({ where: { id: customer.id } })).toBeNull();
  });
});

describe("importCustomers", () => {
  it("skips names that already exist in a different case", async () => {
    await prisma.customer.create({ data: { name: `${tag} Acme Corp` } });

    const formData = new FormData();
    formData.set(
      "customers",
      JSON.stringify([
        { name: `${tag} ACME CORP`.toUpperCase(), status: "Active" },
        { name: `${tag} Fresh Co`, status: "Active" },
      ]),
    );
    const result = await importCustomers(formData);
    expect(result).toEqual({ imported: 1 });

    const acmes = await prisma.customer.count({
      where: { name: { equals: `${tag} Acme Corp`, mode: "insensitive" } },
    });
    expect(acmes).toBe(1);
  });
});
