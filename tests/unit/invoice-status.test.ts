import { describe, expect, it } from "vitest";
import { mapDbInvoiceToDetailView } from "@/lib/invoice-mapper";
import {
  INVOICE_LIST_FILTERS,
  invoiceStatusLabel,
  invoiceStatusVariant,
  isUnpaidInvoiceStatus,
  parseInvoiceListFilter,
} from "@/lib/invoice-status";

describe("invoice status wording", () => {
  it("has no draft stage: DRAFT and SENT both read Open", () => {
    expect(invoiceStatusLabel("SENT")).toBe("Open");
    // Invoices made before the draft stage was removed.
    expect(invoiceStatusLabel("DRAFT")).toBe("Open");
    expect(invoiceStatusLabel("PAID")).toBe("Paid");
    expect(invoiceStatusLabel("VOID")).toBe("Void");

    expect(invoiceStatusVariant("DRAFT")).toBe(invoiceStatusVariant("SENT"));
    expect(invoiceStatusVariant("PAID")).toBe("success");
    expect(invoiceStatusVariant("VOID")).toBe("neutral");
  });

  it("treats open and legacy draft invoices as unpaid", () => {
    expect(isUnpaidInvoiceStatus("SENT")).toBe(true);
    expect(isUnpaidInvoiceStatus("DRAFT")).toBe(true);
    expect(isUnpaidInvoiceStatus("PAID")).toBe(false);
    expect(isUnpaidInvoiceStatus("VOID")).toBe(false);
  });
});

describe("the invoices list filter", () => {
  it("offers All, Price needed, Open, Paid and Void, in that order", () => {
    expect(INVOICE_LIST_FILTERS.map((filter) => filter.label)).toEqual([
      "All",
      "Price needed",
      "Open",
      "Paid",
      "Void",
    ]);
  });

  it("reads ?status= and falls back to All", () => {
    expect(parseInvoiceListFilter("PRICE_NEEDED")).toBe("PRICE_NEEDED");
    expect(parseInvoiceListFilter("OPEN")).toBe("OPEN");
    expect(parseInvoiceListFilter("PAID")).toBe("PAID");
    expect(parseInvoiceListFilter("VOID")).toBe("VOID");
    // Old links and anything unknown show every invoice.
    for (const value of ["", "DRAFT", "SENT", "drafts", "nonsense", null, undefined]) {
      expect(parseInvoiceListFilter(value)).toBe("ALL");
    }
  });
});

describe("the invoice page", () => {
  function view(status: string, needsPrice: boolean[]) {
    return mapDbInvoiceToDetailView({
      id: "inv-1",
      invoiceNumber: "I10231",
      status,
      customerName: "Bay Shore Paving",
      projectName: "Sunrise Hwy Drainage",
      jobNumber: null,
      subtotal: 100,
      discountAmount: 0,
      deliveryAmount: 0,
      salesTax: 8.63,
      total: 108.63,
      taxRate: 8.625,
      invoiceDate: null,
      dueDate: null,
      deliveryTicket: { ticketNumber: "T10231" },
      lineItems: needsPrice.map((flag, index) => ({
        id: `line-${index}`,
        lineNumber: index + 1,
        itemCode: `ITEM-${index}`,
        description: null,
        quantity: 1,
        unit: "EA",
        unitPrice: flag ? 0 : 100,
        total: flag ? 0 : 100,
        needsPrice: flag,
      })),
    });
  }

  it("says what an open invoice is waiting on", () => {
    expect(view("SENT", [false])).toMatchObject({
      statusLabel: "Open",
      statusDetail: "Not paid yet",
      priceNeededCount: 0,
    });
    expect(view("SENT", [false, true])).toMatchObject({
      statusDetail: "Price needed on 1 line",
      priceNeededCount: 1,
    });
    expect(view("DRAFT", [true, true])).toMatchObject({
      statusLabel: "Open",
      statusDetail: "Price needed on 2 lines",
      priceNeededCount: 2,
    });
  });

  it("stops asking for a price once the invoice is paid or void", () => {
    expect(view("PAID", [false])).toMatchObject({
      statusLabel: "Paid",
      statusDetail: "Paid in full",
      priceNeededCount: 0,
    });
    const voided = view("VOID", [true]);
    expect(voided).toMatchObject({
      statusLabel: "Void",
      statusDetail: "Voided, not billed",
      priceNeededCount: 0,
    });
    // The line still shows as unpriced, the same as on the printed page.
    expect(voided.lineItems[0]!.needsPrice).toBe(true);
  });
});
