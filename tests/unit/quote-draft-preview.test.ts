import { describe, expect, it } from "vitest";
import {
  buildDraftQuoteForPdf,
  parseQuoteDraftPreviewInput,
  QUOTE_DRAFT_PREVIEW_MAX_LINES,
  type QuoteDraftPreviewInput,
  type QuoteDraftPreviewLine,
} from "@/lib/quote-draft-preview";
import {
  buildQuoteFormData,
  mapQuoteLineItemsForPdf,
} from "@/lib/quote-pdf-data";
import { generateQuotePdfBytes } from "@/lib/quote-pdf-fill";

function line(
  overrides: Partial<QuoteDraftPreviewLine> = {},
): QuoteDraftPreviewLine {
  return {
    lineType: "STOCK_PRODUCT",
    itemCode: "CB-4x4",
    description: "4' x 4' Catch Basin",
    quantity: 2,
    unitPrice: 1450,
    taxable: true,
    isDrainRing: false,
    ringDiameterFeet: null,
    poolHeightFeet: null,
    drainRingStyle: "DRAIN",
    ...overrides,
  };
}

function draft(
  overrides: Partial<QuoteDraftPreviewInput> = {},
): QuoteDraftPreviewInput {
  return {
    quoteId: null,
    customerName: "Sample Contractor",
    projectName: "Sample Project",
    jobNumber: "26-001",
    projectAddress: "20 Job Road, Job Town, NY 11701",
    contactName: "Pat Estimator",
    contactEmail: "pat@example.com",
    contactPhone: "631-555-0100",
    estimator: "Nick",
    quoteDate: "2026-11-14",
    expirationDate: "2026-12-14",
    taxRate: 8.625,
    customerNotes: "Castings by others.",
    termsAndConditions: "Net 30",
    fob: "Job Site",
    lines: [],
    ...overrides,
  };
}

describe("parseQuoteDraftPreviewInput", () => {
  it("survives anything a caller sends", () => {
    for (const raw of [null, undefined, "x", 5, [], { lines: "no" }]) {
      const parsed = parseQuoteDraftPreviewInput(raw);
      expect(parsed.lines).toEqual([]);
      expect(parsed.customerName).toBe("");
      expect(parsed.taxRate).toBe(0);
    }
  });

  it("keeps half-typed rows as zero and drops junk entries", () => {
    const parsed = parseQuoteDraftPreviewInput({
      taxRate: "8",
      lines: [
        null,
        "row",
        { lineType: "STOCK_PRODUCT", description: "No numbers yet" },
        { lineType: "SERVICE", quantity: Number.NaN, unitPrice: -5 },
        { lineType: "STOCK_PRODUCT", quantity: -3, unitPrice: 10 },
      ],
    });
    expect(parsed.taxRate).toBe(0);
    expect(parsed.lines).toHaveLength(3);
    expect(parsed.lines[0]).toMatchObject({ quantity: 0, unitPrice: 0 });
    expect(parsed.lines[1]).toMatchObject({ quantity: 0, unitPrice: -5 });
    expect(parsed.lines[2]).toMatchObject({ quantity: 0, unitPrice: 10 });
  });

  it("caps the number of lines", () => {
    const parsed = parseQuoteDraftPreviewInput({
      lines: Array.from({ length: QUOTE_DRAFT_PREVIEW_MAX_LINES + 50 }, () =>
        line(),
      ),
    });
    expect(parsed.lines).toHaveLength(QUOTE_DRAFT_PREVIEW_MAX_LINES);
  });

  it("blanks empty text to null and trims the rest", () => {
    const parsed = parseQuoteDraftPreviewInput({
      quoteId: "  ",
      customerName: "  Sample Contractor ",
      jobNumber: "",
      fob: " Factory ",
    });
    expect(parsed.quoteId).toBeNull();
    expect(parsed.customerName).toBe("Sample Contractor");
    expect(parsed.jobNumber).toBeNull();
    expect(parsed.fob).toBe("Factory");
  });
});

describe("buildDraftQuoteForPdf", () => {
  const lines = [
    line({ lineType: "CATEGORY", itemCode: "", description: "Catch Basins" }),
    line({ quantity: 3, unitPrice: 18.375 }),
    line({ itemCode: "MH-48", description: "48\" Manhole", quantity: 4, unitPrice: 1680 }),
    line({ lineType: "NOTE", itemCode: "", description: "Castings by others." }),
    line({
      lineType: "SERVICE",
      itemCode: "Delivery",
      description: "Delivery, 2 loads",
      quantity: 2,
      unitPrice: 325,
      taxable: false,
    }),
  ];

  it("works out money the way a save does, never from the browser", () => {
    const quote = buildDraftQuoteForPdf(draft({ lines }), null);
    // 18.375 is stored as 18.38, so the line is 3 x 18.38.
    expect(quote.lineItems[1]!.unitPrice.toString()).toBe("18.38");
    expect(quote.lineItems[1]!.total.toString()).toBe("55.14");
    expect(quote.subtotal.toString()).toBe("7425.14");
    expect(quote.deliveryAmount.toString()).toBe("650");
    // Tax on the taxable lines only: 6775.14 x 8.625%.
    expect(quote.salesTax.toString()).toBe("584.36");
    expect(quote.total.toString()).toBe("8009.5");
    expect(quote.discountAmount.toString()).toBe("0");
  });

  it("fills the totals box and the meta strip of the last page", () => {
    const quote = buildDraftQuoteForPdf(draft({ lines }), null);
    const data = buildQuoteFormData(quote, { number: 1, count: 1 }, true);
    expect(data).toMatchObject({
      M_Quote_No: "",
      M_Date: "11/14/2026",
      M_Valid_Until: "12/14/2026",
      M_Terms: "Net 30",
      M_FOB: "Job Site",
      M_Salesperson: "Nick",
      "Quote to - Name": "Pat Estimator",
      "Quote to - Company": "Sample Contractor",
      "Project Name": "Sample Project",
      "Job Number": "26-001",
      "Project Address 1": "20 Job Road",
      "Project Address 2": "Job Town, NY 11701",
      Notes: "Castings by others.",
      TOT_Subtotal: "$7,425.14",
      TOT_Sales: "$584.36",
      TOT_TOTAL: "$8,009.50",
    });
    // The delivery line is a row of the table; the totals box has no row for it.
    expect(data).not.toHaveProperty("TOT_Freight");
  });

  it("bills a discounted line at its net price and keeps list price and percent", () => {
    const quote = buildDraftQuoteForPdf(
      parseQuoteDraftPreviewInput({
        customerName: "Sample Contractor",
        projectName: "Sample Project",
        taxRate: 0,
        lines: [
          {
            lineType: "STOCK_PRODUCT",
            itemCode: "R-1",
            description: "Ring",
            quantity: 2,
            // A stale browser price: replaced by list price less 10%.
            unitPrice: 1,
            listPrice: 1000,
            discountPercent: 10,
            taxable: false,
          },
        ],
      }),
      null,
    );
    const [line] = quote.lineItems;
    expect(line.unitPrice.toString()).toBe("900");
    expect(line.listPrice?.toString()).toBe("1000");
    expect(line.discountPercent?.toString()).toBe("10");
    expect(quote.subtotal.toString()).toBe("1800");
    expect(quote.showDiscount).toBe(true);
  });

  it("prints category, note and page break rows as the saved quote does", () => {
    const quote = buildDraftQuoteForPdf(
      draft({
        lines: [...lines, line({ lineType: "PAGE_BREAK", description: "" })],
      }),
      null,
    );
    const rows = mapQuoteLineItemsForPdf(quote.lineItems);
    expect(rows[0]).toMatchObject({ isCategoryLine: true, description: "Catch Basins" });
    expect(rows[1]).toMatchObject({
      item: "CB-4x4",
      qty: "3",
      unitPrice: "$18.38",
      total: "$55.14",
    });
    expect(rows[3]).toMatchObject({ isNoteLine: true, qty: "", total: "" });
    expect(rows[5]).toMatchObject({ isPageBreak: true });
  });

  it("shows the revision marker of the quote being edited only", () => {
    const fresh = buildDraftQuoteForPdf(draft(), null);
    const revised = buildDraftQuoteForPdf(draft({ quoteId: "quote-1" }), {
      revisionNumber: 2,
    });
    const page = { number: 1, count: 1 };
    expect(buildQuoteFormData(fresh, page, true).M_Quote_No).toBe("");
    expect(buildQuoteFormData(revised, page, true).M_Quote_No).toBe("R2");
  });

  it("describes a drain ring line by pools, as the saved quote does", () => {
    const quote = buildDraftQuoteForPdf(
      draft({
        lines: [
          line({
            itemCode: "DR-8",
            description: "typed text that the PDF replaces",
            quantity: 12,
            isDrainRing: true,
            ringDiameterFeet: 8,
            poolHeightFeet: 12,
          }),
        ],
      }),
      null,
    );
    const [row] = mapQuoteLineItemsForPdf(quote.lineItems);
    expect(row!.description).not.toBe("typed text that the PDF replaces");
    expect(row!.description).toMatch(/pool/i);
  });

  it("fills the real template, also with nothing typed yet", async () => {
    const empty = await generateQuotePdfBytes(
      buildDraftQuoteForPdf(
        parseQuoteDraftPreviewInput({ customerName: "Unassigned" }),
        null,
      ),
    );
    expect(Buffer.from(empty.slice(0, 5)).toString("latin1")).toBe("%PDF-");

    const filled = await generateQuotePdfBytes(
      buildDraftQuoteForPdf(draft({ lines }), null),
    );
    expect(filled.length).toBeGreaterThan(empty.length);
  });
});
