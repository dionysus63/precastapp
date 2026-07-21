import { describe, expect, it } from "vitest";
import { mapInvoiceLineItemsForPdf } from "@/lib/invoice-pdf-data";
import type { DbInvoiceForPdf } from "@/lib/invoice-pdf-data";

type DbLine = DbInvoiceForPdf["lineItems"][number];

let lineNumber = 0;
function line(overrides: {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  lineType?: DbLine["lineType"];
  unit?: string;
}): DbLine {
  lineNumber += 1;
  return {
    id: `line-${lineNumber}`,
    invoiceId: "inv-1",
    lineNumber,
    lineType: overrides.lineType ?? "STOCK_PRODUCT",
    quoteLineItemId: null,
    deliveryTicketLineItemId: null,
    productId: null,
    itemCode: overrides.itemCode,
    description: overrides.description,
    quantity: overrides.quantity,
    unit: overrides.unit ?? "EA",
    unitPrice: overrides.unitPrice,
    taxable: true,
    total: overrides.total,
    sortOrder: lineNumber,
    notes: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as unknown as DbLine;
}

describe("mapInvoiceLineItemsForPdf", () => {
  it("strips the editor's ring-height suffix from descriptions", () => {
    const rows = mapInvoiceLineItemsForPdf([
      line({
        itemCode: "R10-SD-5",
        description: "10'Ø x 5' Drain Ring (5' ring)",
        quantity: 4,
        unitPrice: 112,
        total: 448,
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("10'Ø x 5' Drain Ring");
  });

  it("merges same-SKU ring rows from multiple pool groups", () => {
    // One DB row per quote line for the same ring SKU — print as one row
    // with summed qty and total, exactly like the delivery ticket.
    const rows = mapInvoiceLineItemsForPdf([
      line({
        itemCode: "R10-SD-5",
        description: "10'Ø x 5' Drain Ring (5' ring)",
        quantity: 3,
        unitPrice: 560,
        total: 1680,
      }),
      line({
        itemCode: "R10-T-TSC",
        description: "10'Ø x 8\" Top Slab - Circular Opening",
        quantity: 2,
        unitPrice: 583,
        total: 1166,
      }),
      line({
        itemCode: "R10-SD-5",
        description: "10'Ø x 5' Drain Ring (5' ring)",
        quantity: 1,
        unitPrice: 560,
        total: 560,
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      item: "R10-SD-5",
      qty: "4",
      description: "10'Ø x 5' Drain Ring",
      unitPrice: "$560.00",
      total: "$2,240.00",
    });
    expect(rows[1].item).toBe("R10-T-TSC");
  });

  it("does not merge rows whose unit price differs", () => {
    const rows = mapInvoiceLineItemsForPdf([
      line({
        itemCode: "R10-SD-5",
        description: "10'Ø x 5' Drain Ring",
        quantity: 2,
        unitPrice: 560,
        total: 1120,
      }),
      line({
        itemCode: "R10-SD-5",
        description: "10'Ø x 5' Drain Ring",
        quantity: 1,
        unitPrice: 500,
        total: 500,
      }),
    ]);
    expect(rows).toHaveLength(2);
  });

  it("never merges structure lines", () => {
    const rows = mapInvoiceLineItemsForPdf([
      line({
        itemCode: "CB-1",
        description: "4' x 4' Standard CB",
        quantity: 1,
        unitPrice: 2000,
        total: 2000,
        lineType: "CUSTOM_STRUCTURE",
      }),
      line({
        itemCode: "CB-1",
        description: "4' x 4' Standard CB",
        quantity: 1,
        unitPrice: 2000,
        total: 2000,
        lineType: "CUSTOM_STRUCTURE",
      }),
    ]);
    expect(rows).toHaveLength(2);
  });
});
