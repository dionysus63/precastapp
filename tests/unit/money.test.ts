import { describe, expect, it } from "vitest";
import { computeMoneyTotals } from "@/lib/money";

const asNumbers = (result: ReturnType<typeof computeMoneyTotals>) => ({
  lineTotals: result.lineTotals.map((line) => line.toNumber()),
  subtotal: result.subtotal.toNumber(),
  taxableAmount: result.taxableAmount.toNumber(),
  salesTax: result.salesTax.toNumber(),
  total: result.total.toNumber(),
});

describe("computeMoneyTotals", () => {
  it("computes a simple taxable quote to the penny", () => {
    const result = asNumbers(
      computeMoneyTotals(
        [
          { quantity: 2, unitPrice: 3850, taxable: true },
          { quantity: 4, unitPrice: 1240, taxable: true },
        ],
        8.625,
      ),
    );

    expect(result.lineTotals).toEqual([7700, 4960]);
    expect(result.subtotal).toBe(12660);
    expect(result.taxableAmount).toBe(12660);
    // 12660 * 8.625% = 1091.925 → rounds to 1091.93 (single rounding on the sum)
    expect(result.salesTax).toBe(1091.93);
    expect(result.total).toBe(13751.93);
  });

  it("only taxes taxable lines", () => {
    const result = asNumbers(
      computeMoneyTotals(
        [
          { quantity: 1, unitPrice: 1000, taxable: true },
          { quantity: 1, unitPrice: 500, taxable: false },
        ],
        10,
      ),
    );

    expect(result.subtotal).toBe(1500);
    expect(result.taxableAmount).toBe(1000);
    expect(result.salesTax).toBe(100);
    expect(result.total).toBe(1600);
  });

  it("avoids float drift on classic hazard values", () => {
    // 3 × $19.99 = $59.97 exactly; naive float math gives 59.97000000000001
    const result = asNumbers(
      computeMoneyTotals([{ quantity: 3, unitPrice: 19.99, taxable: true }], 0),
    );
    expect(result.subtotal).toBe(59.97);
    expect(result.total).toBe(59.97);

    // 0.1 + 0.2 style accumulation across lines
    const drift = asNumbers(
      computeMoneyTotals(
        [
          { quantity: 1, unitPrice: 0.1, taxable: true },
          { quantity: 1, unitPrice: 0.2, taxable: true },
        ],
        0,
      ),
    );
    expect(drift.subtotal).toBe(0.3);
  });

  it("rounds each extended line total to cents before summing", () => {
    // 3 × $0.333 = $0.999 → line rounds to $1.00; subtotal is the sum of
    // rounded lines, matching what the PDF itemizes.
    const result = asNumbers(
      computeMoneyTotals(
        [
          { quantity: 3, unitPrice: 0.333, taxable: true },
          { quantity: 3, unitPrice: 0.333, taxable: true },
        ],
        0,
      ),
    );
    expect(result.lineTotals).toEqual([1, 1]);
    expect(result.subtotal).toBe(2);
  });

  it("computes tax once on the summed taxable amount, not per line", () => {
    // Two lines of $0.05 at 10%: per-line tax would round 0.005 twice
    // (→ 0.01 + 0.01); summed-then-rounded gives 0.10 * 10% = 0.01.
    const result = asNumbers(
      computeMoneyTotals(
        [
          { quantity: 1, unitPrice: 0.05, taxable: true },
          { quantity: 1, unitPrice: 0.05, taxable: true },
        ],
        10,
      ),
    );
    expect(result.salesTax).toBe(0.01);
  });

  it("subtracts discount from the total but not the taxable amount", () => {
    const result = asNumbers(
      computeMoneyTotals(
        [{ quantity: 1, unitPrice: 1000, taxable: true }],
        10,
        100,
      ),
    );

    expect(result.taxableAmount).toBe(1000);
    expect(result.salesTax).toBe(100);
    expect(result.total).toBe(1000);
  });

  it("handles decimal string inputs (Prisma Decimal-like)", () => {
    const result = asNumbers(
      computeMoneyTotals(
        [{ quantity: "2.5", unitPrice: "840.00", taxable: true }],
        "8.625",
      ),
    );
    expect(result.subtotal).toBe(2100);
    expect(result.salesTax).toBe(181.13);
    expect(result.total).toBe(2281.13);
  });

  it("returns zeros for an empty quote", () => {
    const result = asNumbers(computeMoneyTotals([], 8.625));
    expect(result.subtotal).toBe(0);
    expect(result.salesTax).toBe(0);
    expect(result.total).toBe(0);
  });
});
