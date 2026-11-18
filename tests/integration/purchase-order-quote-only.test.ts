import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadDraftPurchaseOrderForPdf } from "@/lib/purchase-order-draft-preview";
import { purchaseOrderForPdfSelect } from "@/lib/purchase-order-pdf-data";
import {
  createPurchaseOrderRecord,
  updatePurchaseOrderRecord,
} from "@/lib/purchase-order-service";
import { prisma } from "@/lib/prisma";

const tag = `QUOTEONLY-${Date.now()}`;

let vendorId: string;

beforeAll(async () => {
  const vendor = await prisma.vendor.create({ data: { name: `${tag} Vendor` } });
  vendorId = vendor.id;
});

afterAll(async () => {
  await prisma.purchaseOrder.deleteMany({ where: { vendorId } });
  await prisma.vendor.deleteMany({ where: { id: vendorId } });
  await prisma.$disconnect();
});

const orderDate = new Date(Date.UTC(2099, 0, 1));
const quoteDate = new Date(Date.UTC(2098, 11, 20));

describe("a purchase order placed against the vendor's quote", () => {
  it("saves the quote's number, date and total, and no lines", async () => {
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, {
        vendorId,
        orderDate,
        // Lines typed before switching to "Quote only" are not saved.
        lines: [{ itemCode: "IGNORED", quantityOrdered: 2, unitPrice: 5 }],
        quote: { number: " Q122819 ", date: quoteDate, total: 30318.004 },
      }),
    );
    const saved = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    expect(saved.quoteOnly).toBe(true);
    expect(saved.quoteNumber).toBe("Q122819");
    expect(saved.quoteDate?.toISOString().slice(0, 10)).toBe("2098-12-20");
    expect(saved.total.toString()).toBe("30318");
    expect(saved.subtotal.toString()).toBe("30318");
    expect(saved.lines).toEqual([]);

    const forPdf = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      select: purchaseOrderForPdfSelect,
    });
    expect(forPdf).toMatchObject({ quoteOnly: true, quoteNumber: "Q122819", lines: [] });
  });

  it("needs a total, and the quote's number or its date", async () => {
    const save = (quote: { number?: string; date?: Date; total: number }) =>
      prisma.$transaction((tx) =>
        createPurchaseOrderRecord(tx, { vendorId, orderDate, lines: [], quote }),
      );
    await expect(save({ number: "Q1", total: 0 })).rejects.toThrow("quote total");
    await expect(save({ total: 100 })).rejects.toThrow("quote number or the quote date");
    const id = await save({ date: quoteDate, total: 100 });
    const saved = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
    expect(saved.quoteNumber).toBeNull();
    expect(saved.total.toString()).toBe("100");
  });

  it("switches between lines and quote only on edit", async () => {
    const lines = [{ itemCode: `${tag}-ITEM`, quantityOrdered: 3, unitPrice: 10 }];
    const id = await prisma.$transaction((tx) =>
      createPurchaseOrderRecord(tx, { vendorId, orderDate, lines }),
    );
    const created = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
    expect(created.quoteOnly).toBe(false);

    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, id, {
        vendorId,
        orderDate,
        lines,
        quote: { number: "Q7", total: 250.5 },
      }),
    );
    const asQuote = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    expect(asQuote).toMatchObject({ quoteOnly: true, quoteNumber: "Q7" });
    expect(asQuote.total.toString()).toBe("250.5");
    expect(asQuote.lines).toEqual([]);
    expect(asQuote.poNumber).toBe(created.poNumber);

    await prisma.$transaction((tx) =>
      updatePurchaseOrderRecord(tx, id, { vendorId, orderDate, lines }),
    );
    const asLines = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    expect(asLines).toMatchObject({ quoteOnly: false, quoteNumber: null, quoteDate: null });
    expect(asLines.total.toString()).toBe("30");
    expect(asLines.lines).toHaveLength(1);
  });

  it("previews with the quote in place of the lines", async () => {
    const draft = await loadDraftPurchaseOrderForPdf(prisma, {
      purchaseOrderId: null,
      vendorId,
      orderDate: "2099-01-01",
      expectedDate: null,
      enteredBy: null,
      notes: null,
      lines: [
        { itemCode: "A", description: "", quantityOrdered: 2, unit: "EA", unitPrice: 5 },
      ],
      quote: { number: "Q122819", date: "2098-12-20", total: 30318 },
    });
    expect(draft.quoteOnly).toBe(true);
    expect(draft.quoteNumber).toBe("Q122819");
    expect(draft.quoteDate?.toISOString().slice(0, 10)).toBe("2098-12-20");
    expect(draft.lines).toEqual([]);
    expect(draft.total.toString()).toBe("30318");
  });
});
