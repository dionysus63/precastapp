import { describe, expect, it } from "vitest";
import type { DbInvoiceForPdf } from "@/lib/invoice-pdf-data";
import {
  buildInvoiceSummaryHtml,
  buildInvoiceSummaryRows,
} from "@/lib/invoice-summary-html";

function invoice(overrides: {
  ticketNumber: string | null;
  customerName: string;
  projectName: string;
  subtotal: number;
  discountAmount?: number;
  salesTax: number;
  total: number;
  needsPrice?: boolean;
}): DbInvoiceForPdf {
  return {
    customerName: overrides.customerName,
    projectName: overrides.projectName,
    subtotal: overrides.subtotal,
    discountAmount: overrides.discountAmount ?? 0,
    salesTax: overrides.salesTax,
    total: overrides.total,
    deliveryTicket: { ticketNumber: overrides.ticketNumber },
    lineItems: [{ needsPrice: overrides.needsPrice ?? false }],
  } as unknown as DbInvoiceForPdf;
}

const stack = [
  invoice({
    ticketNumber: "T10231",
    customerName: "Bay Shore Paving",
    projectName: "Sunrise Hwy Drainage",
    subtotal: 1200.1,
    salesTax: 103.51,
    total: 1303.61,
  }),
  invoice({
    ticketNumber: "T10232",
    customerName: "North Fork Excavating & Sons",
    projectName: "Main St <Phase 2>",
    subtotal: 500.2,
    discountAmount: 50,
    salesTax: 38.83,
    total: 489.03,
  }),
  invoice({
    ticketNumber: "T10233",
    customerName: "Islip Site Work",
    projectName: "Carleton Ave",
    subtotal: 0.1,
    salesTax: 0.01,
    total: 0.11,
    needsPrice: true,
  }),
];

describe("buildInvoiceSummaryRows", () => {
  it("lists one row per invoice with the price before tax", () => {
    const { rows } = buildInvoiceSummaryRows(stack);
    expect(rows.map((row) => row.ticketNumber)).toEqual([
      "T10231",
      "T10232",
      "T10233",
    ]);
    expect(rows[0]).toMatchObject({
      contractor: "Bay Shore Paving",
      jobName: "Sunrise Hwy Drainage",
      price: 1200.1,
      tax: 103.51,
      total: 1303.61,
      needsPrice: false,
    });
    // Price is the subtotal with the discount taken off.
    expect(rows[1]!.price).toBeCloseTo(450.2, 2);
    expect(rows[2]!.needsPrice).toBe(true);
  });

  it("leaves invoices waiting for a price out of the totals", () => {
    const { totals } = buildInvoiceSummaryRows(stack);
    expect(totals).toEqual({
      price: 1650.3,
      tax: 142.34,
      total: 1792.64,
      waitingForPrice: 1,
    });
  });

  it("adds cents exactly over a long stack", () => {
    // 40 tickets at $0.10 is $4.00, not 3.9999999999999996.
    const many = Array.from({ length: 40 }, (_, index) =>
      invoice({
        ticketNumber: `T${index}`,
        customerName: "C",
        projectName: "P",
        subtotal: 0.1,
        salesTax: 0.01,
        total: 0.11,
      }),
    );
    expect(buildInvoiceSummaryRows(many).totals).toEqual({
      price: 4,
      tax: 0.4,
      total: 4.4,
      waitingForPrice: 0,
    });
  });

  it("shows a dash for a ticket with no number", () => {
    const { rows } = buildInvoiceSummaryRows([
      invoice({
        ticketNumber: null,
        customerName: "C",
        projectName: "P",
        subtotal: 1,
        salesTax: 0,
        total: 1,
      }),
    ]);
    expect(rows[0]!.ticketNumber).toBe("—");
  });
});

describe("buildInvoiceSummaryHtml", () => {
  const html = buildInvoiceSummaryHtml(stack, {
    heading: "Invoices made 11/13/2026",
    order: "in invoice number order",
  });

  it("prints the five QuickBooks values and the total on one line per ticket", () => {
    expect(html).toContain("<h1>Invoice Summary</h1>");
    for (const header of ["Ticket", "Contractor", "Job name", "Price", "Tax", "Total"]) {
      expect(html).toMatch(new RegExp(`<th[^>]*>${header}</th>`));
    }
    expect(html).toContain("T10231");
    expect(html).toContain("Bay Shore Paving");
    expect(html).toContain("$1,200.10");
    expect(html).toContain("$103.51");
    expect(html).toContain("$1,303.61");
    expect(html).toContain("Invoices made 11/13/2026 · 3 invoices · in invoice number order");
  });

  it("escapes names typed by the office", () => {
    expect(html).toContain("North Fork Excavating &amp; Sons");
    expect(html).toContain("Main St &lt;Phase 2&gt;");
    expect(html).not.toContain("<Phase 2>");
  });

  it("prints PRICE NEEDED instead of amounts, and says the totals leave it out", () => {
    expect(html).toContain("PRICE NEEDED, not in the totals");
    // The partial amounts of the unpriced invoice are nowhere on the page.
    expect(html).not.toContain("$0.11");
    expect(html).toContain("Totals, without 1 that needs a price");
    expect(html).toContain("$1,650.30");
    expect(html).toContain("$142.34");
    expect(html).toContain("$1,792.64");
  });

  it("labels plain totals when every invoice is priced", () => {
    const priced = buildInvoiceSummaryHtml(stack.slice(0, 2), {
      heading: "Invoices made 11/13/2026",
      order: "",
    });
    expect(priced).toContain(">Totals</td>");
    expect(priced).not.toContain("PRICE NEEDED");
    expect(priced).toContain("Invoices made 11/13/2026 · 2 invoices</div>");

    const one = buildInvoiceSummaryHtml(stack.slice(0, 1), {
      heading: "",
      order: "",
    });
    expect(one).toContain("1 invoice</div>");
  });
});
