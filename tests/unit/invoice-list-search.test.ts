import { describe, expect, it } from "vitest";
import {
  buildInvoiceListWhere,
  EMPTY_INVOICE_LIST_SEARCH,
  hasInvoiceListSearch,
  invoiceListSearchParams,
  MAX_SELECTED_INVOICES,
  parseInvoiceListSearch,
  parseInvoiceListView,
  parseMoneyInput,
  parseSelectedInvoiceIds,
  selectedInvoicesFileName,
  selectedInvoicesPdfUrl,
} from "@/lib/invoice-list-search";

describe("a typed dollar amount", () => {
  it("reads plain amounts, commas and a dollar sign", () => {
    expect(parseMoneyInput("1500")).toBe(1500);
    expect(parseMoneyInput("1,500.50")).toBe(1500.5);
    expect(parseMoneyInput("$1,500")).toBe(1500);
    expect(parseMoneyInput(".5")).toBe(0.5);
    expect(parseMoneyInput("12.")).toBe(12);
    expect(parseMoneyInput("0")).toBe(0);
  });

  it("reads anything else as nothing typed", () => {
    for (const value of ["", "abc", "-5", "1.2.3", "12x", ".", "1e3"]) {
      expect(parseMoneyInput(value)).toBeNull();
    }
  });
});

describe("the invoice list search in the address", () => {
  it("reads the six boxes and trims them", () => {
    expect(
      parseInvoiceListSearch({
        customer: "  Acme Paving ",
        job: "25-104",
        from: "2026-11-01",
        to: "2026-11-14",
        min: "1,000",
        max: "2500.00",
      }),
    ).toEqual({
      customer: "Acme Paving",
      job: "25-104",
      from: "2026-11-01",
      to: "2026-11-14",
      min: "1,000",
      max: "2500.00",
    });
  });

  it("drops dates and amounts that are not dates and amounts", () => {
    const search = parseInvoiceListSearch({
      from: "last week",
      to: "2026-13-40",
      min: "cheap",
      max: "-20",
    });
    expect(search).toEqual(EMPTY_INVOICE_LIST_SEARCH);
    expect(hasInvoiceListSearch(search)).toBe(false);
  });

  it("takes the first value of a repeated parameter", () => {
    expect(
      parseInvoiceListSearch({ customer: ["Acme", "Other"] }).customer,
    ).toBe("Acme");
  });

  it("writes back only the boxes that hold something", () => {
    expect(
      invoiceListSearchParams({
        ...EMPTY_INVOICE_LIST_SEARCH,
        customer: "Acme",
        max: "500",
      }),
    ).toEqual({ customer: "Acme", max: "500" });
    expect(
      hasInvoiceListSearch({ ...EMPTY_INVOICE_LIST_SEARCH, job: "x" }),
    ).toBe(true);
  });

  it("reads the status chip along with the search", () => {
    expect(parseInvoiceListView({ status: "PAID", customer: "Acme" })).toEqual({
      filter: "PAID",
      search: { ...EMPTY_INVOICE_LIST_SEARCH, customer: "Acme" },
    });
    expect(parseInvoiceListView({ status: "nonsense" }).filter).toBe("ALL");
  });
});

describe("what the database is asked for", () => {
  it("asks for everything when no chip and no box is set", () => {
    expect(buildInvoiceListWhere("ALL")).toEqual({});
    expect(buildInvoiceListWhere("ALL", EMPTY_INVOICE_LIST_SEARCH)).toEqual({});
  });

  it("keeps the status chips as they were", () => {
    expect(buildInvoiceListWhere("PAID")).toEqual({ status: "PAID" });
    expect(buildInvoiceListWhere("VOID")).toEqual({ status: "VOID" });
    expect(buildInvoiceListWhere("OPEN")).toEqual({
      status: { in: ["DRAFT", "SENT"] },
    });
    expect(buildInvoiceListWhere("PRICE_NEEDED")).toEqual({
      status: { in: ["DRAFT", "SENT"] },
      lineItems: { some: { needsPrice: true } },
    });
  });

  it("matches any part of the contractor name, in any letter case", () => {
    expect(
      buildInvoiceListWhere("ALL", {
        ...EMPTY_INVOICE_LIST_SEARCH,
        customer: "acme",
      }),
    ).toEqual({ customerName: { contains: "acme", mode: "insensitive" } });
  });

  it("matches the job by its name or its job number", () => {
    expect(
      buildInvoiceListWhere("ALL", {
        ...EMPTY_INVOICE_LIST_SEARCH,
        job: "25-104",
      }),
    ).toEqual({
      OR: [
        { projectName: { contains: "25-104", mode: "insensitive" } },
        { jobNumber: { contains: "25-104", mode: "insensitive" } },
      ],
    });
  });

  it("includes both ends of the invoice date range, in local time", () => {
    const where = buildInvoiceListWhere("ALL", {
      ...EMPTY_INVOICE_LIST_SEARCH,
      from: "2026-11-01",
      to: "2026-11-14",
    });
    expect(where).toEqual({
      invoiceDate: {
        gte: new Date(2026, 10, 1),
        lte: new Date(2026, 10, 14, 23, 59, 59, 999),
      },
    });
  });

  it("takes a date range with one end open", () => {
    expect(
      buildInvoiceListWhere("ALL", {
        ...EMPTY_INVOICE_LIST_SEARCH,
        from: "2026-11-01",
      }),
    ).toEqual({ invoiceDate: { gte: new Date(2026, 10, 1) } });
    expect(
      buildInvoiceListWhere("ALL", {
        ...EMPTY_INVOICE_LIST_SEARCH,
        to: "2026-11-14",
      }),
    ).toEqual({
      invoiceDate: { lte: new Date(2026, 10, 14, 23, 59, 59, 999) },
    });
  });

  it("filters the invoice total, both ends included", () => {
    expect(
      buildInvoiceListWhere("ALL", {
        ...EMPTY_INVOICE_LIST_SEARCH,
        min: "1,000",
        max: "$2,500.50",
      }),
    ).toEqual({ total: { gte: 1000, lte: 2500.5 } });
    expect(
      buildInvoiceListWhere("ALL", { ...EMPTY_INVOICE_LIST_SEARCH, min: "0" }),
    ).toEqual({ total: { gte: 0 } });
  });

  it("requires the chip and every filled box together", () => {
    expect(
      buildInvoiceListWhere("PAID", {
        ...EMPTY_INVOICE_LIST_SEARCH,
        customer: "Acme",
        max: "500",
      }),
    ).toEqual({
      AND: [
        { status: "PAID" },
        { customerName: { contains: "Acme", mode: "insensitive" } },
        { total: { lte: 500 } },
      ],
    });
  });
});

describe("the ticked invoices", () => {
  it("reads ids from the address without repeats, in the order given", () => {
    expect(parseSelectedInvoiceIds("b, a,b,,c")).toEqual(["b", "a", "c"]);
  });

  it("refuses none, junk and more than one print can hold", () => {
    expect(parseSelectedInvoiceIds(null)).toBeNull();
    expect(parseSelectedInvoiceIds(" , ")).toBeNull();
    expect(parseSelectedInvoiceIds("../etc/passwd")).toBeNull();
    const many = Array.from(
      { length: MAX_SELECTED_INVOICES + 1 },
      (_, index) => `id${index}`,
    );
    expect(parseSelectedInvoiceIds(many.join(","))).toBeNull();
    expect(parseSelectedInvoiceIds(many.slice(1).join(","))).toHaveLength(
      MAX_SELECTED_INVOICES,
    );
  });

  it("builds the address of their one PDF", () => {
    expect(selectedInvoicesPdfUrl(["a", "b"])).toBe(
      "/api/invoices/selected/pdf?ids=a%2Cb",
    );
    expect(selectedInvoicesPdfUrl(["a"], { download: true })).toBe(
      "/api/invoices/selected/pdf?ids=a&download=1",
    );
    // The route reads back exactly what the screen sent.
    const url = new URL(selectedInvoicesPdfUrl(["a", "b"]), "http://x");
    expect(parseSelectedInvoiceIds(url.searchParams.get("ids"))).toEqual([
      "a",
      "b",
    ]);
  });

  it("names the file after the invoice, or the range of invoices", () => {
    expect(selectedInvoicesFileName(["I10212"])).toBe("invoice-I10212.pdf");
    expect(selectedInvoicesFileName(["I10215", "I10210", "I10212"])).toBe(
      "invoices-3-selected-I10210-to-I10215.pdf",
    );
  });
});
