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
vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { applyGalleyBreakdown } from "@/app/quotes/galley-actions";
import { getQuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import { prisma } from "@/lib/prisma";

const tag = `GALLEY-${Date.now()}`;
const familyCode = `${tag}-40`;

let categoryId: string;
let quoteId: string;
const productIdByType = new Map<string, string>();

beforeAll(async () => {
  const category = await prisma.productCategory.create({
    data: { name: `${tag} category`, productType: "STOCK_PRECAST" },
  });
  categoryId = category.id;

  for (const [type, suffix] of [
    ["END", "E"],
    ["MIDDLE", "M"],
    ["CB", "CB"],
  ] as const) {
    const product = await prisma.product.create({
      data: {
        productCode: `${familyCode}-${suffix}`,
        name: `${tag} Storm Galley 4' - ${type}`,
        categoryId,
        weight: 7645,
        galleyFamilyCode: familyCode,
        galleyType: type,
      },
    });
    productIdByType.set(type, product.id);
  }

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q1`,
      customerName: `${tag} Contractor`,
      projectName: `${tag} project`,
      status: "WON",
      subtotal: 14120,
      taxableAmount: 14120,
      total: 14120,
      lineItems: {
        create: [
          {
            lineNumber: 1,
            lineType: "STOCK_PRODUCT",
            itemCode: familyCode,
            description: `${tag} Storm Galley 4'`,
            quantity: 20,
            unit: "EA",
            unitPrice: 706,
            weight: 7645,
            taxable: true,
            total: 14120,
            sortOrder: 1,
            galleyFamilyCode: familyCode,
          },
          {
            lineNumber: 2,
            lineType: "SERVICE",
            itemCode: "SVC",
            description: "Crane time",
            quantity: 1,
            unit: "EA",
            unitPrice: 500,
            taxable: false,
            total: 500,
            sortOrder: 2,
          },
        ],
      },
    },
  });
  quoteId = quote.id;
});

afterAll(async () => {
  await prisma.deliveryTicket.deleteMany({
    where: { customerName: `${tag} Contractor` },
  });
  await prisma.quote.deleteMany({ where: { quoteNumber: `${tag}-Q1` } });
  await prisma.product.deleteMany({
    where: { galleyFamilyCode: familyCode },
  });
  if (categoryId) {
    await prisma.productCategory.delete({ where: { id: categoryId } });
  }
});

describe("galley family fulfillment guard", () => {
  it("marks the family-total line ineligible until broken down", async () => {
    const fulfillment = await getQuoteLineFulfillment(prisma, quoteId);
    const familyLine = fulfillment.find(
      (line) => line.itemCode === familyCode,
    );
    expect(familyLine).toBeDefined();
    expect(familyLine!.eligible).toBe(false);
    expect(familyLine!.isGalleyFamilyTotal).toBe(true);
    expect(familyLine!.eligibilityReason).toMatch(/Break down/);
  });
});

describe("applyGalleyBreakdown", () => {
  it("rejects counts that do not sum to the quoted total", async () => {
    const result = await applyGalleyBreakdown(quoteId, familyCode, {
      END: 2,
      MIDDLE: 10,
      CB: 2,
    });
    expect(result).toHaveProperty("error");
  });

  it("replaces the family line with typed product lines, totals unchanged", async () => {
    const result = await applyGalleyBreakdown(quoteId, familyCode, {
      END: 4,
      MIDDLE: 14,
      CB: 2,
    });
    expect(result).toEqual({ ok: true });

    const quote = await prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });

    const galleyLines = quote.lineItems.filter((line) =>
      line.itemCode.startsWith(familyCode),
    );
    expect(galleyLines).toHaveLength(3);
    expect(
      galleyLines.map((line) => [line.itemCode, Number(line.quantity)]),
    ).toEqual([
      [`${familyCode}-E`, 4],
      [`${familyCode}-M`, 14],
      [`${familyCode}-CB`, 2],
    ]);
    for (const line of galleyLines) {
      expect(line.productId).toBeTruthy();
      expect(line.galleyFamilyCode).toBeNull();
      expect(Number(line.unitPrice)).toBe(706);
    }

    // The service line survives after the galley lines, renumbered.
    expect(quote.lineItems.map((line) => line.lineNumber)).toEqual([1, 2, 3, 4]);
    expect(quote.lineItems[3]!.itemCode).toBe("SVC");

    // Money is invariant: 20 × $706 before and after.
    expect(Number(quote.subtotal)).toBe(14620);
    expect(Number(quote.total)).toBe(14620);

    const fulfillment = await getQuoteLineFulfillment(prisma, quoteId);
    const typedLines = fulfillment.filter((line) =>
      line.itemCode.startsWith(familyCode),
    );
    expect(typedLines.every((line) => line.eligible)).toBe(true);
  });

  it("re-balances an existing breakdown while unticketed", async () => {
    const result = await applyGalleyBreakdown(quoteId, familyCode, {
      END: 2,
      MIDDLE: 16,
      CB: 2,
    });
    expect(result).toEqual({ ok: true });

    const lines = await prisma.quoteLineItem.findMany({
      where: { quoteId, productId: { not: null } },
      orderBy: { sortOrder: "asc" },
    });
    const galleyLines = lines.filter((line) =>
      line.itemCode.startsWith(familyCode),
    );
    expect(
      galleyLines.map((line) => [line.itemCode, Number(line.quantity)]),
    ).toEqual([
      [`${familyCode}-E`, 2],
      [`${familyCode}-M`, 16],
      [`${familyCode}-CB`, 2],
    ]);
  });

  it("drops a type entirely when its count is zero", async () => {
    const result = await applyGalleyBreakdown(quoteId, familyCode, {
      END: 0,
      MIDDLE: 18,
      CB: 2,
    });
    expect(result).toEqual({ ok: true });

    const galleyLines = await prisma.quoteLineItem.findMany({
      where: { quoteId, itemCode: { startsWith: familyCode } },
      orderBy: { sortOrder: "asc" },
    });
    expect(galleyLines).toHaveLength(2);
    expect(
      galleyLines.map((line) => [line.itemCode, Number(line.quantity)]),
    ).toEqual([
      [`${familyCode}-M`, 18],
      [`${familyCode}-CB`, 2],
    ]);
  });

  it("freezes the mix once a line is on a delivery ticket", async () => {
    const middleLine = await prisma.quoteLineItem.findFirstOrThrow({
      where: { quoteId, itemCode: `${familyCode}-M` },
    });
    await prisma.deliveryTicket.create({
      data: {
        customerName: `${tag} Contractor`,
        projectName: `${tag} project`,
        quoteId,
        lineItems: {
          create: [
            {
              lineNumber: 1,
              lineType: "STOCK_PRODUCT",
              itemCode: `${familyCode}-M`,
              quantity: 2,
              unit: "EA",
              quoteLineItemId: middleLine.id,
              productId: middleLine.productId,
            },
          ],
        },
      },
    });

    const result = await applyGalleyBreakdown(quoteId, familyCode, {
      END: 2,
      MIDDLE: 16,
      CB: 2,
    });
    expect(result).toHaveProperty("error");
    expect(String((result as { error: string }).error)).toMatch(
      /delivery tickets or invoices/,
    );
  });
});
