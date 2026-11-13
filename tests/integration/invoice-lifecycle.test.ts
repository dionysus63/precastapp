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

import {
  deleteInvoice,
  getInvoiceFilterCounts,
  listInvoicesForPage,
  markInvoicePaid,
  reopenVoidedInvoice,
  updateInvoice,
  voidInvoice,
  type UpdateInvoiceInput,
} from "@/app/invoices/actions";
import { writeAuditLog } from "@/lib/auth/audit";
import type { InvoiceListFilter } from "@/lib/invoice-status";
import { prisma } from "@/lib/prisma";

const tag = `INVLIFE-${Date.now()}`;

let invoiceAId: string;
let invoiceCId: string;
let lineAId: string;
let lineBId: string;
let lineCId: string;

async function createTicketAndInvoice(
  suffix: string,
  sequence: number,
  options: {
    status?: "DRAFT" | "SENT" | "PAID" | "VOID";
    /** Make the single line one that is still waiting for a price. */
    needsPrice?: boolean;
  } = {},
) {
  const needsPrice = options.needsPrice === true;
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
      // An invoice is open (SENT) from the start; DRAFT only exists on
      // invoices made before the draft stage was removed.
      status: options.status ?? "SENT",
      invoiceDate: new Date(2026, 6, 1),
      subtotal: needsPrice ? 0 : 100,
      total: needsPrice ? 0 : 100,
      lineItems: {
        create: {
          lineNumber: 1,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-ITEM-${suffix}`,
          description: `Original line ${suffix}`,
          quantity: 1,
          unit: "EA",
          unitPrice: needsPrice ? 0 : 100,
          needsPrice,
          taxable: false,
          total: needsPrice ? 0 : 100,
          sortOrder: 0,
        },
      },
    },
    include: { lineItems: true },
  });
  return { invoice, ticket, lineId: invoice.lineItems[0]!.id };
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
  lines: UpdateInvoiceInput["lines"],
  deletedLineIds: string[] = [],
): UpdateInvoiceInput {
  return { invoiceId, taxRate: 0, discountAmount: 0, lines, deletedLineIds };
}

async function statusOf(invoiceId: string) {
  return (await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } }))
    .status;
}

describe("invoice status transitions", () => {
  it("marks an open invoice paid without touching the invoice date", async () => {
    const before = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
    });
    expect(before.status).toBe("SENT");

    const result = await markInvoicePaid(invoiceAId);
    expect(result.error).toBeUndefined();

    const paid = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceAId },
    });
    expect(paid.status).toBe("PAID");
    expect(paid.invoiceDate?.getTime()).toBe(before.invoiceDate?.getTime());

    // Paying twice is a no-op error, not a re-stamp.
    const again = await markInvoicePaid(invoiceAId);
    expect(again.error).toMatch(/only open invoices/i);
  });

  it("voids a paid invoice but never a voided one twice", async () => {
    const result = await voidInvoice(invoiceAId);
    expect(result.error).toBeUndefined();
    expect(await statusOf(invoiceAId)).toBe("VOID");

    const again = await voidInvoice(invoiceAId);
    expect(again.error).toMatch(/already void/i);
  });

  it("treats an invoice left in the old draft status as open", async () => {
    const legacy = await createTicketAndInvoice("L", 9915, { status: "DRAFT" });

    // Editable, voidable and payable like any open invoice: nothing has to
    // be finalized first.
    const edited = await updateInvoice(
      editInput(legacy.invoice.id, [
        {
          id: legacy.lineId,
          lineNumber: 1,
          lineType: "STOCK_PRODUCT",
          itemCode: `${tag}-ITEM-L`,
          description: "Edited while still DRAFT",
          quantity: 2,
          unit: "EA",
          unitPrice: 100,
          taxable: false,
        },
      ]),
    );
    expect(edited.error).toBeUndefined();

    expect((await markInvoicePaid(legacy.invoice.id)).error).toBeUndefined();
    expect(await statusOf(legacy.invoice.id)).toBe("PAID");

    const other = await createTicketAndInvoice("M", 9916, { status: "DRAFT" });
    expect((await voidInvoice(other.invoice.id)).error).toBeUndefined();
    expect(await statusOf(other.invoice.id)).toBe("VOID");
  });

  it("reopens a voided invoice as open, keeping its number and ticket", async () => {
    const { invoice, ticket } = await createTicketAndInvoice("R", 9917, {
      status: "VOID",
    });

    expect(await reopenVoidedInvoice(invoice.id)).toEqual({ success: true });
    const reopened = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(reopened.status).toBe("SENT");
    expect(reopened.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(reopened.deliveryTicketId).toBe(ticket.id);

    expect(await reopenVoidedInvoice(invoice.id)).toEqual({
      error: "Only voided invoices can be reopened.",
    });
  });

  it("deletes an unpaid invoice and leaves its ticket delivered", async () => {
    const { invoice, ticket } = await createTicketAndInvoice("X", 9918);
    vi.mocked(writeAuditLog).mockClear();

    expect(await deleteInvoice(invoice.id)).toEqual({ success: true });
    expect(
      await prisma.invoice.findUnique({ where: { id: invoice.id } }),
    ).toBeNull();
    expect(
      await prisma.invoiceLineItem.count({ where: { invoiceId: invoice.id } }),
    ).toBe(0);
    // The delivery stands, ready for Convert to Invoice on the ticket.
    expect(
      (await prisma.deliveryTicket.findUniqueOrThrow({ where: { id: ticket.id } }))
        .status,
    ).toBe("DELIVERED");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invoice.delete",
        entityId: invoice.id,
        summary: expect.stringContaining(invoice.invoiceNumber),
      }),
    );
  });

  it("never deletes a paid or voided invoice", async () => {
    const paid = await createTicketAndInvoice("Y", 9919, { status: "PAID" });
    const voided = await createTicketAndInvoice("Z", 9920, { status: "VOID" });

    for (const { invoice } of [paid, voided]) {
      const result = await deleteInvoice(invoice.id);
      expect(result.error).toMatch(/only unpaid invoices can be deleted/i);
      expect(
        await prisma.invoice.findUnique({ where: { id: invoice.id } }),
      ).not.toBeNull();
    }
  });
});

describe("invoice editing", () => {
  // Invoice A is VOID by this point (paid, then voided above). An invoice
  // is editable until it is paid or voided.
  it("rejects edits to a paid or voided invoice", async () => {
    const result = await updateInvoice(
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
    );
    expect(result.error).toMatch(/paid or voided/i);

    const paid = await createTicketAndInvoice("P", 9921, { status: "PAID" });
    const paidResult = await updateInvoice(
      editInput(paid.invoice.id, [
        {
          id: paid.lineId,
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
    );
    expect(paidResult.error).toMatch(/paid or voided/i);
    expect(
      Number(
        (
          await prisma.invoiceLineItem.findUniqueOrThrow({
            where: { id: paid.lineId },
          })
        ).unitPrice,
      ),
    ).toBe(100);
  });

  it("rejects a line id belonging to another invoice and rolls back atomically", async () => {
    const result = await updateInvoice(
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

  it("saves an edit atomically with recomputed totals", async () => {
    const result = await updateInvoice(
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
    // Still open: saving never changes the status.
    expect(invoice.status).toBe("SENT");
    expect(invoice.lineItems).toHaveLength(2);
    expect(Number(invoice.subtotal)).toBe(325);
    expect(Number(invoice.total)).toBe(325);
    expect(Number(invoice.lineItems[0]!.total)).toBe(300);
    expect(Number(invoice.lineItems[1]!.total)).toBe(25);
  });

  it("edits the same invoice again, removing a line", async () => {
    // Drop the service line added by the previous edit; correct the other.
    const serviceLine = await prisma.invoiceLineItem.findFirstOrThrow({
      where: { invoiceId: invoiceCId, itemCode: `${tag}-SVC` },
      select: { id: true },
    });
    const result = await updateInvoice(
      editInput(
        invoiceCId,
        [
          {
            id: lineCId,
            lineNumber: 1,
            lineType: "STOCK_PRODUCT",
            itemCode: `${tag}-ITEM-C`,
            description: "Corrected after printing",
            quantity: 3,
            unit: "EA",
            unitPrice: 100,
            taxable: false,
          },
        ],
        [serviceLine.id],
      ),
    );
    expect(result.error).toBeUndefined();

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceCId },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    expect(invoice.status).toBe("SENT");
    expect(invoice.lineItems).toHaveLength(1);
    expect(Number(invoice.total)).toBe(300);
  });

  it("returns saved line ids so a second save doesn't duplicate new lines", async () => {
    const { invoice, lineId } = await createTicketAndInvoice("D", 9914);
    const lines: UpdateInvoiceInput["lines"] = [
      {
        id: lineId,
        lineNumber: 1,
        lineType: "STOCK_PRODUCT",
        itemCode: `${tag}-ITEM-D`,
        description: "Original line D",
        quantity: 1,
        unit: "EA",
        unitPrice: 100,
        taxable: false,
      },
      {
        lineNumber: 2,
        lineType: "SERVICE",
        itemCode: `${tag}-SVC-D`,
        description: "Added service",
        quantity: 1,
        unit: "EA",
        unitPrice: 40,
        taxable: false,
      },
    ];

    const first = await updateInvoice(editInput(invoice.id, lines));
    expect(first.error).toBeUndefined();
    expect(first.lineIds).toHaveLength(2);
    expect(first.lineIds![0]).toBe(lineId);

    // The editor stays open and saves again, now carrying the returned ids.
    const second = await updateInvoice(
      editInput(
        invoice.id,
        lines.map((line, index) => ({ ...line, id: first.lineIds![index] })),
      ),
    );
    expect(second.error).toBeUndefined();
    expect(second.lineIds).toEqual(first.lineIds);

    const saved = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { lineItems: true },
    });
    expect(saved.lineItems).toHaveLength(2);
    expect(Number(saved.total)).toBe(140);
  });
});

describe("a line waiting for a price", () => {
  function line(
    id: string | undefined,
    suffix: string,
    patch: Partial<UpdateInvoiceInput["lines"][number]> = {},
  ): UpdateInvoiceInput["lines"][number] {
    return {
      id,
      lineNumber: 1,
      lineType: "STOCK_PRODUCT",
      itemCode: `${tag}-ITEM-${suffix}`,
      description: `Original line ${suffix}`,
      quantity: 2,
      unit: "EA",
      unitPrice: 0,
      taxable: false,
      ...patch,
    };
  }

  async function needsPriceOf(lineId: string) {
    return (
      await prisma.invoiceLineItem.findUniqueOrThrow({ where: { id: lineId } })
    ).needsPrice;
  }

  it("blocks Mark paid until the price is typed", async () => {
    const { invoice, lineId } = await createTicketAndInvoice("N1", 9931, {
      needsPrice: true,
    });

    const blocked = await markInvoicePaid(invoice.id);
    expect(blocked.error).toMatch(/still has a line waiting for a price/i);
    expect(await statusOf(invoice.id)).toBe("SENT");

    // Saving without a price keeps it waiting.
    const unchanged = await updateInvoice(
      editInput(invoice.id, [line(lineId, "N1", { needsPrice: true })]),
    );
    expect(unchanged.error).toBeUndefined();
    expect(await needsPriceOf(lineId)).toBe(true);
    expect((await markInvoicePaid(invoice.id)).error).toMatch(
      /waiting for a price/i,
    );

    // Typing the price clears it, whatever the editor says about the flag.
    const priced = await updateInvoice(
      editInput(invoice.id, [
        line(lineId, "N1", { unitPrice: 75, needsPrice: true }),
      ]),
    );
    expect(priced.error).toBeUndefined();
    expect(await needsPriceOf(lineId)).toBe(false);
    const saved = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(Number(saved.total)).toBe(150);

    expect((await markInvoicePaid(invoice.id)).error).toBeUndefined();
    expect(await statusOf(invoice.id)).toBe("PAID");
  });

  it("takes a typed 0 as no charge", async () => {
    const { invoice, lineId } = await createTicketAndInvoice("N2", 9932, {
      needsPrice: true,
    });

    const result = await updateInvoice(
      editInput(invoice.id, [line(lineId, "N2", { needsPrice: false })]),
    );
    expect(result.error).toBeUndefined();
    expect(await needsPriceOf(lineId)).toBe(false);
    expect((await markInvoicePaid(invoice.id)).error).toBeUndefined();
  });

  it("keeps waiting when an older screen saves without saying either way", async () => {
    const { invoice, lineId } = await createTicketAndInvoice("N3", 9933, {
      needsPrice: true,
    });

    // No needsPrice field at all, still $0: nobody priced it, so the invoice
    // must not quietly lose its PRICE NEEDED.
    const result = await updateInvoice(
      editInput(invoice.id, [line(lineId, "N3")]),
    );
    expect(result.error).toBeUndefined();
    expect(await needsPriceOf(lineId)).toBe(true);
  });

  it("can only be kept, never set, from the editor", async () => {
    const { invoice, lineId } = await createTicketAndInvoice("N4", 9934);

    // A priced line edited down to $0, and a brand new $0 line: both are
    // no charge, even when the request claims they need a price.
    const result = await updateInvoice(
      editInput(invoice.id, [
        line(lineId, "N4", { needsPrice: true }),
        line(undefined, "N4-NEW", { lineNumber: 2, needsPrice: true }),
      ]),
    );
    expect(result.error).toBeUndefined();
    const lines = await prisma.invoiceLineItem.findMany({
      where: { invoiceId: invoice.id },
    });
    expect(lines).toHaveLength(2);
    expect(lines.every((saved) => !saved.needsPrice)).toBe(true);
  });
});

describe("the invoices list", () => {
  const filters: InvoiceListFilter[] = [
    "ALL",
    "PRICE_NEEDED",
    "OPEN",
    "PAID",
    "VOID",
  ];

  it("puts each invoice under the right filter and counts it there", async () => {
    const before = await getInvoiceFilterCounts();

    const open = await createTicketAndInvoice("LIST-OPEN", 9941);
    const waiting = await createTicketAndInvoice("LIST-WAIT", 9942, {
      needsPrice: true,
    });
    const legacy = await createTicketAndInvoice("LIST-DRAFT", 9943, {
      status: "DRAFT",
    });
    const paid = await createTicketAndInvoice("LIST-PAID", 9944, {
      status: "PAID",
    });
    // A void invoice can still carry a line nobody priced: not "price needed".
    const voided = await createTicketAndInvoice("LIST-VOID", 9945, {
      status: "VOID",
      needsPrice: true,
    });

    const after = await getInvoiceFilterCounts();
    expect(
      Object.fromEntries(
        filters.map((filter) => [filter, after[filter] - before[filter]]),
      ),
    ).toEqual({ ALL: 5, PRICE_NEEDED: 1, OPEN: 3, PAID: 1, VOID: 1 });

    const listed: Record<string, string[]> = {};
    for (const filter of filters) {
      const { invoices } = await listInvoicesForPage({ filter, page: 1 });
      listed[filter] = invoices
        .filter((row) => row.invoiceNumber.startsWith(`${tag}-ILIST`))
        .map((row) => row.invoiceNumber.replace(`${tag}-ILIST-`, ""))
        .sort();
    }
    expect(listed).toEqual({
      ALL: ["DRAFT", "OPEN", "PAID", "VOID", "WAIT"],
      PRICE_NEEDED: ["WAIT"],
      OPEN: ["DRAFT", "OPEN", "WAIT"],
      PAID: ["PAID"],
      VOID: ["VOID"],
    });

    // The row carries what the list shows: price before tax, and the item
    // codes still waiting for a price (none once the invoice is void).
    const { invoices } = await listInvoicesForPage({ filter: "ALL", page: 1 });
    const row = (id: string) => invoices.find((invoice) => invoice.id === id)!;
    expect(row(open.invoice.id)).toMatchObject({
      status: "SENT",
      price: 100,
      salesTax: 0,
      total: 100,
      ticketNumber: `${tag}-TLIST-OPEN`,
      priceNeededItems: [],
    });
    expect(row(waiting.invoice.id).priceNeededItems).toEqual([
      `${tag}-ITEM-LIST-WAIT`,
    ]);
    expect(row(legacy.invoice.id).status).toBe("DRAFT");
    expect(row(paid.invoice.id).priceNeededItems).toEqual([]);
    expect(row(voided.invoice.id).priceNeededItems).toEqual([]);
  });
});
