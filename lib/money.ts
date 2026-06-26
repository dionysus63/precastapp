import { Decimal, toDecimal, type DecimalInstance, type DecimalLike } from "@/lib/decimal";

/** Money values are persisted as Decimal(12,2); compute and round to cents. */
const MONEY_DP = 2;

export type { DecimalLike } from "@/lib/decimal";

export type MoneyLineInput = {
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  taxable: boolean;
};

export type ComputedMoneyTotals = {
  /** Per-line extended totals (quantity × unitPrice), in line order. */
  lineTotals: DecimalInstance[];
  subtotal: DecimalInstance;
  taxableAmount: DecimalInstance;
  salesTax: DecimalInstance;
  total: DecimalInstance;
};

/**
 * Authoritative money math for quotes and invoices. All arithmetic uses
 * `Decimal` (never JS floats) and every persisted figure is rounded to
 * cents with a single, shared rounding policy so a quote and the invoice it
 * becomes agree to the penny.
 *
 * Tax is computed on the summed taxable extended amount (not per line) and
 * rounded once, matching the existing invoice behavior.
 */
export function computeMoneyTotals(
  lines: MoneyLineInput[],
  taxRatePercent: DecimalLike,
): ComputedMoneyTotals {
  const taxRate = toDecimal(taxRatePercent);

  let subtotal = new Decimal(0);
  let taxableAmount = new Decimal(0);
  const lineTotals: DecimalInstance[] = [];

  for (const line of lines) {
    const lineTotal = toDecimal(line.quantity)
      .mul(toDecimal(line.unitPrice))
      .toDecimalPlaces(MONEY_DP);
    lineTotals.push(lineTotal);
    subtotal = subtotal.add(lineTotal);
    if (line.taxable) {
      taxableAmount = taxableAmount.add(lineTotal);
    }
  }

  subtotal = subtotal.toDecimalPlaces(MONEY_DP);
  taxableAmount = taxableAmount.toDecimalPlaces(MONEY_DP);
  const salesTax = taxableAmount
    .mul(taxRate)
    .div(100)
    .toDecimalPlaces(MONEY_DP);
  const total = subtotal.add(salesTax).toDecimalPlaces(MONEY_DP);

  return { lineTotals, subtotal, taxableAmount, salesTax, total };
}
