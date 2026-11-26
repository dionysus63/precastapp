import { describe, expect, it } from "vitest";
import type { PDFFont } from "pdf-lib";
import { PDFDocument } from "pdf-lib";
import {
  buildQuoteFormData,
  mapQuoteLineItemsForPdf,
  quotePrintsDiscounts,
  type DbQuoteForPdf,
} from "@/lib/quote-pdf-data";
import { generateQuotePdfBytes, listQuoteFormFields } from "@/lib/quote-pdf-fill";
import {
  DISCOUNT_TABLE_COLUMNS,
  STANDARD_TABLE_COLUMNS,
  MAIN_TABLE_LAYOUT,
  TABLE_LEFT_X,
  TABLE_RIGHT_X,
  type QuoteTableColumns,
} from "@/lib/quote-pdf-layout";
import { measureRowHeight } from "@/lib/quote-pdf-line-items";

const decimal = (value: number | string) => ({ toString: () => String(value) });

type Line = DbQuoteForPdf["lineItems"][number];

function pdfLine(
  lineNumber: number,
  overrides: Partial<Line> = {},
): Line {
  return {
    id: `line-${lineNumber}`,
    lineNumber,
    lineType: "STOCK_PRODUCT",
    productId: null,
    itemCode: `R-${lineNumber}`,
    description: "4' x 8' drainage ring",
    quantity: decimal(2),
    unit: "EA",
    unitPrice: decimal(1000),
    total: decimal(2000),
    weight: null,
    yards: null,
    taxable: true,
    statusNote: null,
    notes: null,
    ...overrides,
  } as Line;
}

function discountedLine(lineNumber: number, percent = 10): Line {
  return pdfLine(lineNumber, {
    unitPrice: decimal(1000 - percent * 10),
    total: decimal(2 * (1000 - percent * 10)),
    listPrice: decimal(1000),
    discountPercent: decimal(percent),
  });
}

function pdfQuote(
  lineItems: Line[],
  overrides: Partial<DbQuoteForPdf> = {},
): DbQuoteForPdf {
  return {
    id: "quote-1",
    quoteNumber: "Q-1",
    revisionNumber: 0,
    jobId: null,
    customerId: null,
    jobNumber: "26-001",
    customerName: "Sample Contractor",
    projectName: "Main Street Drainage",
    projectAddress: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    status: "DRAFT",
    quoteType: "STANDARD",
    estimator: "Nick",
    quoteDate: new Date(2026, 10, 26),
    bidDueDate: null,
    expirationDate: null,
    customerPO: null,
    subtotal: decimal(3800),
    discountAmount: decimal(0),
    deliveryAmount: decimal(750),
    taxableAmount: decimal(3800),
    taxRate: decimal(8.625),
    salesTax: decimal(327.75),
    total: decimal(4127.75),
    totalWeight: decimal(0),
    totalYards: decimal(0),
    internalNotes: null,
    customerNotes: null,
    termsAndConditions: null,
    fob: null,
    leadTime: null,
    deliveryNotes: null,
    priceListId: null,
    sentAt: null,
    jobBidderId: null,
    createdAt: new Date(2026, 10, 26),
    updatedAt: new Date(2026, 10, 26),
    lineItems,
    ...overrides,
  } as DbQuoteForPdf;
}

function edges(columns: QuoteTableColumns): number[] {
  const ordered = [
    columns.item,
    columns.qty,
    columns.description,
    columns.listPrice,
    columns.discount,
    columns.unitPrice,
    columns.total,
  ].filter((column) => column != null);
  return ordered.flatMap((column) => [column.x, column.x + column.width]);
}

describe("which table a quote prints", () => {
  it("prints the discount table when a line has a discount", () => {
    expect(quotePrintsDiscounts(pdfQuote([pdfLine(1), discountedLine(2)]))).toBe(
      true,
    );
  });

  it("prints the standard table when no line has a discount", () => {
    expect(quotePrintsDiscounts(pdfQuote([pdfLine(1), pdfLine(2)]))).toBe(false);
  });

  it("prints the standard table when Show discounts is switched off", () => {
    expect(
      quotePrintsDiscounts(
        pdfQuote([discountedLine(1)], { showDiscount: false }),
      ),
    ).toBe(false);
  });

  it("does not count a discount kept at 0%", () => {
    const typedZero = pdfLine(1, {
      listPrice: decimal(1000),
      discountPercent: decimal(0),
      discountTyped: true,
    });
    expect(quotePrintsDiscounts(pdfQuote([typedZero]))).toBe(false);
  });
});

describe("quote lines for print", () => {
  it("carries list price, discount and the net price of a discounted line", () => {
    const [row] = mapQuoteLineItemsForPdf([discountedLine(1, 12.5)]);
    expect(row.listPrice).toBe("$1,000.00");
    expect(row.discount).toBe("12.5%");
    expect(row.unitPrice).toBe("$875.00");
    expect(row.total).toBe("$1,750.00");
  });

  it("shows the one price in both price columns when there is no discount", () => {
    const [row] = mapQuoteLineItemsForPdf([pdfLine(1)]);
    expect(row.listPrice).toBe("$1,000.00");
    expect(row.discount).toBe("");
    expect(row.unitPrice).toBe("$1,000.00");
  });
});

describe("quote totals box", () => {
  it("fills Subtotal, Tax Rate, Sales Tax and TOTAL and no Freight / Delivery row", () => {
    const data = buildQuoteFormData(
      pdfQuote([pdfLine(1)]),
      { number: 1, count: 1 },
      true,
    );
    expect(data.TOT_Subtotal).toBe("$3,800.00");
    expect(data.TOT_TaxRate).toBe("8.625%");
    expect(data.TOT_Sales).toBe("$327.75");
    expect(data.TOT_TOTAL).toBe("$4,127.75");
    expect(data).not.toHaveProperty("TOT_Freight");
  });

  it("has no Freight field left on the template", async () => {
    const fields = await listQuoteFormFields();
    expect(fields.main).toEqual(
      expect.arrayContaining([
        "TOT_Subtotal",
        "TOT_TaxRate",
        "TOT_Sales",
        "TOT_TOTAL",
        "Notes",
      ]),
    );
    expect(fields.main).not.toContain("TOT_Freight");
  });
});

describe("item table columns", () => {
  it.each([
    ["standard", STANDARD_TABLE_COLUMNS],
    ["discount", DISCOUNT_TABLE_COLUMNS],
  ])("the %s table's columns meet edge to edge across the frame", (_name, columns) => {
    const all = edges(columns);
    expect(all[0]).toBe(TABLE_LEFT_X);
    expect(all[all.length - 1]).toBeCloseTo(TABLE_RIGHT_X, 6);
    for (let index = 1; index < all.length - 1; index += 2) {
      expect(all[index]).toBeCloseTo(all[index + 1]!, 6);
    }
  });

  it("wraps a long description sooner in the narrower discount table", () => {
    const font = {
      widthOfTextAtSize: (text: string, size: number) =>
        text.length * (size * 0.55),
    } as unknown as PDFFont;
    const row = {
      item: "R-1",
      qty: "2",
      // About 245pt wide: one line in the standard table, two beside discounts.
      description: "x".repeat(24) + " " + "y".repeat(24),
      unitPrice: "$900.00",
      total: "$1,800.00",
    };
    const standard = measureRowHeight(row, font, MAIN_TABLE_LAYOUT);
    const discount = measureRowHeight(
      row,
      font,
      MAIN_TABLE_LAYOUT,
      DISCOUNT_TABLE_COLUMNS,
    );
    expect(discount).toBe(standard + MAIN_TABLE_LAYOUT.lineHeight);
  });
});

describe("the printed quote", () => {
  it("renders one page with either table", async () => {
    for (const quote of [
      pdfQuote([pdfLine(1), pdfLine(2)]),
      pdfQuote([pdfLine(1), discountedLine(2)]),
      pdfQuote([discountedLine(1)], { showDiscount: false }),
    ]) {
      const bytes = await generateQuotePdfBytes(quote);
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
    }
  });
});
