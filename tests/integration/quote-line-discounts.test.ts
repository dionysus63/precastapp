import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing with no meaning outside a request. The quote
// actions, the totals math and the database run real.
const actor = vi.hoisted(() => ({ id: "", displayName: "Test User" }));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn(async () => actor),
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

import {
  createQuote,
  updateQuote,
  type CreateQuoteInput,
} from "@/app/quotes/actions";
import { prisma } from "@/lib/prisma";
import { mapQuoteToFormInitialValues } from "@/lib/quote-mapper";
import { QUOTE_PDF_INCLUDE, quotePrintsDiscounts } from "@/lib/quote-pdf-data";
import { reviseQuoteInTransaction } from "@/lib/quote-revision";

const tag = `QDISC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
let quoteCounter = 0;

type LineInput = CreateQuoteInput["lineItems"][number];

function lineInput(lineNumber: number, overrides: Partial<LineInput>): LineInput {
  return {
    lineNumber,
    lineType: "STOCK_PRODUCT",
    productId: null,
    itemCode: `R-${lineNumber}`,
    description: "Drainage ring",
    quantity: 2,
    unit: "EA",
    unitPrice: 1000,
    weight: null,
    yards: null,
    taxable: false,
    total: 0,
    statusNote: null,
    notes: null,
    ...overrides,
  };
}

function quoteInput(
  projectName: string,
  lineItems: LineInput[],
  overrides: Partial<CreateQuoteInput> = {},
): CreateQuoteInput {
  return {
    customerId: null,
    customerName: `${tag} Contractor`,
    jobId: null,
    jobNumber: null,
    projectName,
    projectAddress: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    status: "DRAFT",
    quoteType: "STOCK_ONLY",
    estimator: null,
    quoteDate: null,
    bidDueDate: null,
    expirationDate: null,
    priceListId: null,
    customerPO: null,
    taxRate: 0,
    internalNotes: null,
    customerNotes: null,
    termsAndConditions: null,
    fob: null,
    leadTime: null,
    deliveryNotes: null,
    lineItems,
    // The server works the totals out itself from the lines.
    totals: {
      subtotal: 0,
      discount: 0,
      delivery: 0,
      taxableAmount: 0,
      salesTax: 0,
      total: 0,
      totalWeight: 0,
      totalYards: 0,
    },
    ...overrides,
  };
}

async function createAndLoad(
  lineItems: LineInput[],
  overrides: Partial<CreateQuoteInput> = {},
) {
  quoteCounter += 1;
  const projectName = `${tag} Project ${quoteCounter}`;
  const result = await createQuote(quoteInput(projectName, lineItems, overrides));
  expect(result).toBeUndefined();
  return loadQuote({ projectName });
}

function loadQuote(where: { projectName: string } | { id: string }) {
  return prisma.quote.findFirstOrThrow({
    where,
    include: { lineItems: { orderBy: { lineNumber: "asc" } } },
  });
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username: `${tag}-user`.toLowerCase(),
      displayName: `${tag} User`,
      initials: "TU",
      role: "MANAGER",
    },
  });
  actor.id = user.id;
});

afterAll(async () => {
  await prisma.quote.deleteMany({
    where: { customerName: `${tag} Contractor` },
  });
  await prisma.auditLog.deleteMany({ where: { userId: actor.id } });
  await prisma.user.deleteMany({ where: { id: actor.id } });
  await prisma.$disconnect();
});

describe("quote line discounts", () => {
  it("bills a discounted line at its net price and keeps list price and percent", async () => {
    const quote = await createAndLoad(
      [
        // The browser's own net price is not trusted: 1 is replaced by 900.
        lineInput(1, { unitPrice: 1, listPrice: 1000, discountPercent: 10 }),
        lineInput(2, { unitPrice: 500, listPrice: 500, discountPercent: 0 }),
      ],
      { discountBasis: "PICKUP", showDiscount: false },
    );

    const [discounted, plain] = quote.lineItems;
    expect(Number(discounted.unitPrice)).toBe(900);
    expect(Number(discounted.listPrice)).toBe(1000);
    expect(Number(discounted.discountPercent)).toBe(10);
    expect(discounted.discountTyped).toBe(false);
    expect(Number(discounted.total)).toBe(1800);

    expect(Number(plain.unitPrice)).toBe(500);
    expect(plain.listPrice).toBeNull();
    expect(plain.discountPercent).toBeNull();
    expect(Number(plain.total)).toBe(1000);

    // Totals come from the net prices; nothing sits in the old whole-quote
    // discount amount.
    expect(Number(quote.subtotal)).toBe(2800);
    expect(Number(quote.total)).toBe(2800);
    expect(Number(quote.discountAmount)).toBe(0);
    expect(quote.discountBasis).toBe("PICKUP");
    expect(quote.showDiscount).toBe(false);
  });

  it("starts a quote as delivered with its discounts shown", async () => {
    const quote = await createAndLoad([lineInput(1, {})]);
    expect(quote.discountBasis).toBe("DELIVERED");
    expect(quote.showDiscount).toBe(true);
    expect(quote.lineItems[0].listPrice).toBeNull();
    expect(Number(quote.lineItems[0].unitPrice)).toBe(1000);
  });

  it("opens the saved quote with the list price and its discount in the form", async () => {
    const quote = await createAndLoad([
      lineInput(1, { listPrice: 1000, discountPercent: 12.5, discountTyped: true }),
      lineInput(2, { unitPrice: 500, listPrice: 500 }),
    ]);

    const form = mapQuoteToFormInitialValues(
      quote as unknown as Parameters<typeof mapQuoteToFormInitialValues>[0],
    );
    expect(form.discountBasis).toBe("DELIVERED");
    expect(form.showDiscount).toBe(true);
    expect(form.lineItems[0]).toMatchObject({
      unitPrice: "1000",
      discountPercent: "12.5",
      discountTyped: true,
    });
    // No discount is saved as "none", not as "follow today's standard".
    expect(form.lineItems[1]).toMatchObject({
      unitPrice: "500",
      discountPercent: "",
      discountTyped: false,
    });
  });

  it("re-prices the line when its discount is changed on an edit", async () => {
    const quote = await createAndLoad([
      lineInput(1, { listPrice: 1000, discountPercent: 10 }),
    ]);

    const result = await updateQuote(
      quote.id,
      quoteInput(
        quote.projectName,
        [
          lineInput(1, {
            existingLineItemId: quote.lineItems[0].id,
            unitPrice: 900,
            listPrice: 1000,
            discountPercent: 15,
            discountTyped: true,
          }),
        ],
        { expectedUpdatedAt: quote.updatedAt.toISOString(), showDiscount: false },
      ),
    );
    expect(result).toBeUndefined();

    const saved = await loadQuote({ id: quote.id });
    expect(Number(saved.lineItems[0].unitPrice)).toBe(850);
    expect(Number(saved.lineItems[0].discountPercent)).toBe(15);
    expect(saved.lineItems[0].discountTyped).toBe(true);
    expect(Number(saved.subtotal)).toBe(1700);
    expect(saved.showDiscount).toBe(false);
  });

  it("keeps a discount typed down to 0% on the line", async () => {
    const quote = await createAndLoad([
      lineInput(1, { listPrice: 1000, discountPercent: 0, discountTyped: true }),
    ]);
    const [line] = quote.lineItems;
    expect(Number(line.unitPrice)).toBe(1000);
    expect(Number(line.listPrice)).toBe(1000);
    expect(Number(line.discountPercent)).toBe(0);
    expect(line.discountTyped).toBe(true);
  });

  it("carries discounts, the basis and the show switch onto a revision", async () => {
    const quote = await createAndLoad(
      [lineInput(1, { listPrice: 1000, discountPercent: 20, discountTyped: true })],
      { status: "SENT", discountBasis: "PICKUP", showDiscount: false },
    );

    const revisionId = await prisma.$transaction((tx) =>
      reviseQuoteInTransaction(tx, quote.id),
    );
    const revision = await loadQuote({ id: revisionId });

    expect(revision.discountBasis).toBe("PICKUP");
    expect(revision.showDiscount).toBe(false);
    expect(Number(revision.lineItems[0].unitPrice)).toBe(800);
    expect(Number(revision.lineItems[0].listPrice)).toBe(1000);
    expect(Number(revision.lineItems[0].discountPercent)).toBe(20);
    expect(revision.lineItems[0].discountTyped).toBe(true);
    expect(Number(revision.subtotal)).toBe(1600);
  });

  it("prints the discount table only while the quote shows its discounts", async () => {
    const shown = await createAndLoad([
      lineInput(1, { listPrice: 1000, discountPercent: 10 }),
    ]);
    const hidden = await createAndLoad(
      [lineInput(1, { listPrice: 1000, discountPercent: 10 })],
      { showDiscount: false },
    );
    const forPdf = (id: string) =>
      prisma.quote.findUniqueOrThrow({ where: { id }, include: QUOTE_PDF_INCLUDE });

    expect(quotePrintsDiscounts(await forPdf(shown.id))).toBe(true);
    expect(quotePrintsDiscounts(await forPdf(hidden.id))).toBe(false);
  });
});
