import { describe, expect, it } from "vitest";
import {
  computeQuotePreviewTotals,
  isDeliveryServiceLine,
} from "@/lib/quotes/money-rules";

describe("isDeliveryServiceLine", () => {
  it("matches SERVICE lines mentioning delivery in code or description", () => {
    expect(isDeliveryServiceLine("SERVICE", "DELIVERY", null)).toBe(true);
    expect(isDeliveryServiceLine("SERVICE", "SVC-01", "Delivery — 3 loads")).toBe(true);
    expect(isDeliveryServiceLine("SERVICE", "SVC-01", "Crane time")).toBe(false);
    expect(isDeliveryServiceLine("STOCK_PRODUCT", "DELIVERY", "Delivery")).toBe(false);
  });
});

describe("computeQuotePreviewTotals", () => {
  it("excludes CATEGORY lines from money, weight, and yards", () => {
    const result = computeQuotePreviewTotals(
      [
        {
          lineType: "CATEGORY",
          quantity: 0,
          unitPrice: 0,
          taxable: false,
          description: "Storm structures",
        },
        {
          lineType: "STOCK_PRODUCT",
          quantity: 2,
          unitPrice: 100,
          taxable: true,
          weight: 500,
          yards: 1.5,
        },
      ],
      10,
    );

    expect(result.subtotal).toBe(200);
    expect(result.salesTax).toBe(20);
    expect(result.total).toBe(220);
    expect(result.totalWeight).toBe(1000);
    expect(result.totalYards).toBe(3);
    // lineTotals stays aligned with the input rows, category = 0
    expect(result.lineTotals).toEqual([0, 200]);
  });

  it("sums delivery SERVICE lines into the delivery figure", () => {
    const result = computeQuotePreviewTotals(
      [
        {
          lineType: "STOCK_PRODUCT",
          quantity: 1,
          unitPrice: 1000,
          taxable: true,
        },
        {
          lineType: "SERVICE",
          itemCode: "DELIVERY",
          description: "Delivery — 2 loads",
          quantity: 2,
          unitPrice: 350,
          taxable: false,
        },
      ],
      0,
    );

    expect(result.delivery).toBe(700);
    expect(result.subtotal).toBe(1700);
    expect(result.total).toBe(1700);
  });

  it("accumulates weight and yards as quantity × per-unit values", () => {
    const result = computeQuotePreviewTotals(
      [
        {
          lineType: "STOCK_PRODUCT",
          quantity: 3,
          unitPrice: 0,
          taxable: false,
          weight: "7645",
          yards: "2.25",
        },
        {
          lineType: "STOCK_PRODUCT",
          quantity: 1,
          unitPrice: 0,
          taxable: false,
          weight: null,
          yards: "",
        },
      ],
      0,
    );

    expect(result.totalWeight).toBe(22935);
    expect(result.totalYards).toBe(6.75);
  });
});
