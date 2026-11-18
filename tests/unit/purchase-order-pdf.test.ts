import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  paginatePurchaseOrderRows,
  renderPurchaseOrderPdf,
  wrapPdfText,
  type PurchaseOrderPdfData,
} from "@/lib/purchase-order-pdf";
import {
  buildPurchaseOrderPdfData,
  shipToPartyForPdf,
  vendorPartyForPdf,
  type PurchaseOrderForPdf,
} from "@/lib/purchase-order-pdf-data";
import {
  draftPurchaseOrderMoney,
  parsePurchaseOrderDraftPreviewInput,
} from "@/lib/purchase-order-draft-preview";

const company = {
  name: "Long Island Precast",
  address: "20 Stiriz Road, Brookhaven, NY 11719",
  phone: "(631) 286-0240",
  email: "office@example.com",
};

const vendor = {
  name: "Halliday Products",
  address: "1234 Example Road",
  city: "Orlando",
  state: "FL",
  zip: "32810",
  phone: "(555) 010-0142",
  email: null,
};

function purchaseOrder(lineCount: number): PurchaseOrderForPdf {
  return {
    poNumber: "HA-0001",
    orderDate: new Date(Date.UTC(2026, 10, 17)),
    expectedDate: new Date(Date.UTC(2026, 11, 8)),
    enteredBy: "Nick",
    attention: "Inside Sales",
    notes: "Call 24 hours before delivery.",
    taxable: false,
    quoteOnly: false,
    quoteNumber: null,
    quoteDate: null,
    vendor,
    lines: Array.from({ length: lineCount }, (_, index) => ({
      itemCode: `ITEM-${index + 1}`,
      description: 'Access door, single leaf, 36" x 36" clear opening, aluminum',
      quantityOrdered: "4.0000",
      unit: "EA",
      unitPrice: "1185.0000",
      total: "4740.00",
    })),
    total: 4740 * lineCount,
  };
}

function sampleData(lineCount: number): PurchaseOrderPdfData {
  return buildPurchaseOrderPdfData(purchaseOrder(lineCount), company);
}

describe("buildPurchaseOrderPdfData", () => {
  it("formats dates, quantities and money for print", () => {
    const data = sampleData(1);
    expect(data.orderDate).toBe("11/17/2026");
    expect(data.expectedDate).toBe("12/8/2026");
    expect(data.lines[0]).toMatchObject({
      quantity: "4",
      unitPrice: "$1,185.00",
      amount: "$4,740.00",
    });
    expect(data.total).toBe("$4,740.00");
  });

  it("keeps the extra decimals of a per-foot price", () => {
    const po = purchaseOrder(1);
    po.lines[0]!.unitPrice = "0.1275";
    po.lines[0]!.quantityOrdered = "2.5";
    const line = buildPurchaseOrderPdfData(po, company).lines[0]!;
    expect(line.unitPrice).toBe("$0.1275");
    expect(line.quantity).toBe("2.5");
  });

  it("says whether the purchase is taxable", () => {
    const po = purchaseOrder(1);
    expect(buildPurchaseOrderPdfData(po, company).tax).toBe("Non-taxable");
    po.taxable = true;
    expect(buildPurchaseOrderPdfData(po, company).tax).toBe("Taxable");
  });

  it("leaves a missing expected date blank", () => {
    const po = purchaseOrder(1);
    po.expectedDate = null;
    expect(buildPurchaseOrderPdfData(po, company).expectedDate).toBe("");
  });
});

describe("a quote only purchase order", () => {
  function quoteOnlyOrder(): PurchaseOrderForPdf {
    return {
      ...purchaseOrder(0),
      quoteOnly: true,
      quoteNumber: " Q122819 ",
      quoteDate: new Date(Date.UTC(2026, 10, 17)),
      total: "30318.00",
    };
  }

  it("prints the quote's number and date in place of lines", () => {
    const data = buildPurchaseOrderPdfData(quoteOnlyOrder(), company);
    expect(data.quote).toEqual({ number: "Q122819", date: "11/17/2026" });
    expect(data.lines).toEqual([]);
    expect(data.total).toBe("$30,318.00");
  });

  it("leaves a missing number or date blank", () => {
    const po = quoteOnlyOrder();
    po.quoteNumber = null;
    po.quoteDate = null;
    expect(buildPurchaseOrderPdfData(po, company).quote).toEqual({
      number: "",
      date: "",
    });
  });

  it("is not set on an order with lines", () => {
    expect(sampleData(2).quote).toBeNull();
  });

  it("draws on one page", async () => {
    const bytes = await renderPurchaseOrderPdf(
      buildPurchaseOrderPdfData(quoteOnlyOrder(), company),
      { headerImagePng: null },
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe("vendorPartyForPdf", () => {
  it("prints the address, the order's attention and phone under the name", () => {
    expect(vendorPartyForPdf(vendor, " Inside Sales ")).toEqual({
      name: "Halliday Products",
      lines: [
        "1234 Example Road",
        "Orlando, FL 32810",
        "Attn: Inside Sales",
        "(555) 010-0142",
      ],
    });
  });

  it("puts phone and email on one line when everything is filled in", () => {
    const party = vendorPartyForPdf(
      { ...vendor, email: "sales@example.com" },
      "Inside Sales",
    );
    expect(party.lines).toHaveLength(4);
    expect(party.lines[3]).toBe("(555) 010-0142   sales@example.com");
  });

  it("prints only the name for a vendor with nothing else on file", () => {
    expect(
      vendorPartyForPdf(
        {
          name: "Halliday",
          address: null,
          city: null,
          state: null,
          zip: null,
          phone: null,
          email: null,
        },
        null,
      ),
    ).toEqual({ name: "Halliday", lines: [] });
  });

  it("leaves the Attn line out of an order with no attention", () => {
    expect(vendorPartyForPdf(vendor, null).lines).toEqual([
      "1234 Example Road",
      "Orlando, FL 32810",
      "(555) 010-0142",
    ]);
  });
});

describe("shipToPartyForPdf", () => {
  it("splits the company's one-line address after the street", () => {
    expect(shipToPartyForPdf(company)).toEqual({
      name: "Long Island Precast",
      lines: ["20 Stiriz Road", "Brookhaven, NY 11719", "(631) 286-0240"],
    });
  });
});

describe("paginatePurchaseOrderRows", () => {
  const rows = (count: number, height = 10) =>
    Array.from({ length: count }, (_, index) => ({ id: index, height }));

  it("keeps everything on one page when rows and closing block fit", () => {
    expect(paginatePurchaseOrderRows(rows(5), 100, 200, 40)).toHaveLength(1);
  });

  it("runs on to further pages and never drops or repeats a row", () => {
    const pages = paginatePurchaseOrderRows(rows(45), 100, 200, 40);
    expect(pages.map((page) => page.length)).toEqual([10, 20, 15]);
    expect(pages.flat().map((row) => row.id)).toEqual(
      Array.from({ length: 45 }, (_, index) => index),
    );
  });

  it("moves the closing block to a new page with the last row", () => {
    // 8 rows fit (80 of 100) but leave no room for the 40 high block.
    const pages = paginatePurchaseOrderRows(rows(8), 100, 200, 40);
    expect(pages.map((page) => page.length)).toEqual([7, 1]);
  });

  it("gives an order with no lines one page", () => {
    expect(paginatePurchaseOrderRows([], 100, 200, 40)).toEqual([[]]);
  });
});

describe("wrapPdfText", () => {
  it("wraps on words, keeps typed line breaks and cuts an endless word", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapPdfText("one two three\nfour", font, 10, 40);
    expect(lines).toEqual(["one two", "three", "four"]);
    const cut = wrapPdfText("A".repeat(40), font, 10, 60);
    expect(cut.length).toBeGreaterThan(1);
    expect(cut.join("")).toBe("A".repeat(40));
    for (const line of cut) {
      expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(60);
    }
  });
});

describe("renderPurchaseOrderPdf", () => {
  it("draws a short order on one letter page", async () => {
    const bytes = await renderPurchaseOrderPdf(sampleData(6), { headerImagePng: null });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });

  it("runs a long order on to more pages", async () => {
    const bytes = await renderPurchaseOrderPdf(sampleData(80), { headerImagePng: null });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("draws an empty order and text Helvetica cannot encode", async () => {
    const data = sampleData(0);
    data.notes = "Diameter ⌀ 48″, arrows → and emoji 🚚";
    data.vendor.name = "Vendör ✓";
    const bytes = await renderPurchaseOrderPdf(data, { headerImagePng: null });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe("purchase order draft preview input", () => {
  it("drops untouched rows and reads half-typed numbers as zero", () => {
    const draft = parsePurchaseOrderDraftPreviewInput({
      purchaseOrderId: null,
      vendorId: "v1",
      orderDate: "2026-11-17",
      expectedDate: "",
      enteredBy: " Nick ",
      notes: "",
      lines: [
        { itemCode: "A", description: "", quantityOrdered: 2, unit: "EA", unitPrice: 1.5 },
        { itemCode: "", description: "", quantityOrdered: 0, unit: "EA", unitPrice: 0 },
        { itemCode: "B", description: "x", quantityOrdered: "abc", unit: "EA", unitPrice: -4 },
      ],
    });
    expect(draft.enteredBy).toBe("Nick");
    expect(draft.expectedDate).toBeNull();
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[1]).toMatchObject({ quantityOrdered: 0, unitPrice: 0 });
  });

  it("reads the quote of a quote only order, half typed or not", () => {
    const draft = parsePurchaseOrderDraftPreviewInput({
      vendorId: "v1",
      lines: [],
      quote: { number: " Q122819 ", date: "2026-11-17", total: 30318 },
    });
    expect(draft.quote).toEqual({ number: "Q122819", date: "2026-11-17", total: 30318 });
    expect(
      parsePurchaseOrderDraftPreviewInput({
        quote: { number: 5, date: "11/17/2026", total: "abc" },
      }).quote,
    ).toEqual({ number: "", date: null, total: 0 });
    expect(parsePurchaseOrderDraftPreviewInput({ quote: "yes" }).quote).toBeNull();
  });

  it("refuses anything that is not the editor's shape without throwing on junk", () => {
    expect(parsePurchaseOrderDraftPreviewInput(null).lines).toEqual([]);
    expect(parsePurchaseOrderDraftPreviewInput({ lines: "x" }).vendorId).toBeNull();
    expect(() =>
      parsePurchaseOrderDraftPreviewInput({ lines: new Array(401).fill({}) }),
    ).toThrow("Too many lines");
  });

  it("adds up like a save: lines unrounded, shown to the cent", () => {
    const money = draftPurchaseOrderMoney([
      { itemCode: "A", description: "", quantityOrdered: 3, unit: "LF", unitPrice: 0.335 },
      { itemCode: "B", description: "", quantityOrdered: 3, unit: "LF", unitPrice: 0.335 },
    ]);
    // 1.005 each: both lines show $1.01, the total is 2.01, not 2.02.
    expect(money.lineTotals.map(String)).toEqual(["1.01", "1.01"]);
    expect(money.total.toString()).toBe("2.01");
  });
});
