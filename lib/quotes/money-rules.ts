import { Decimal, toDecimal, type DecimalInstance, type DecimalLike } from "@/lib/decimal";
import {
  computeMoneyTotals,
  type MoneyLineInput,
} from "@/lib/money";

/** True when a SERVICE line represents a delivery charge (item code or description). */
export function isDeliveryServiceLine(
  lineType: string,
  itemCode: string | null | undefined,
  description: string | null | undefined,
): boolean {
  if (lineType !== "SERVICE") {
    return false;
  }
  const item = (itemCode ?? "").toLowerCase();
  const desc = (description ?? "").toLowerCase();
  return item.includes("delivery") || desc.includes("delivery");
}

/** Sum extended totals for delivery SERVICE lines (server-side Decimal math). */
export function computeDeliveryAmount(
  lines: Array<{
    lineType: string;
    itemCode?: string | null;
    description?: string | null;
  }>,
  lineTotals: DecimalInstance[],
): DecimalInstance {
  return lines.reduce((sum, line, index) => {
    if (
      isDeliveryServiceLine(line.lineType, line.itemCode, line.description)
    ) {
      return sum.add(lineTotals[index]);
    }
    return sum;
  }, new Decimal(0));
}

export type QuotePreviewTotals = {
  subtotal: number;
  discount: number;
  delivery: number;
  taxableAmount: number;
  salesTax: number;
  total: number;
  totalWeight: number;
  totalYards: number;
  lineTotals: number[];
};

export type QuotePreviewLineInput = MoneyLineInput & {
  lineType: string;
  itemCode?: string | null;
  description?: string | null;
  weight?: DecimalLike | null;
  yards?: DecimalLike | null;
};

function toNumber(value: DecimalInstance): number {
  return value.toNumber();
}

/**
 * Client-safe quote totals preview using the same Decimal rounding policy as
 * server persistence (`lib/money.ts`).
 */
export function computeQuotePreviewTotals(
  lines: QuotePreviewLineInput[],
  taxRatePercent: DecimalLike,
): QuotePreviewTotals {
  const billableLines = lines.filter((line) => line.lineType !== "CATEGORY");
  const computed = computeMoneyTotals(
    billableLines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
    taxRatePercent,
  );

  const totalWeight = billableLines.reduce((sum, line) => {
    const qty = toDecimal(line.quantity);
    const weight =
      line.weight != null && line.weight !== ""
        ? toDecimal(line.weight)
        : null;
    return weight != null ? sum + qty.mul(weight).toNumber() : sum;
  }, 0);

  const totalYards = billableLines.reduce((sum, line) => {
    const qty = toDecimal(line.quantity);
    const yards =
      line.yards != null && line.yards !== ""
        ? toDecimal(line.yards)
        : null;
    return yards != null ? sum + qty.mul(yards).toNumber() : sum;
  }, 0);

  let billableIndex = 0;
  const lineTotals = lines.map((line) => {
    if (line.lineType === "CATEGORY") {
      return 0;
    }
    const total = toNumber(computed.lineTotals[billableIndex]!);
    billableIndex += 1;
    return total;
  });

  const delivery = lines.reduce((sum, line, index) => {
    if (line.lineType === "CATEGORY") {
      return sum;
    }
    if (
      isDeliveryServiceLine(line.lineType, line.itemCode, line.description)
    ) {
      return sum + lineTotals[index]!;
    }
    return sum;
  }, 0);

  return {
    subtotal: toNumber(computed.subtotal),
    discount: 0,
    delivery,
    taxableAmount: toNumber(computed.taxableAmount),
    salesTax: toNumber(computed.salesTax),
    total: toNumber(computed.total),
    totalWeight,
    totalYards,
    lineTotals,
  };
}

/** Per-line extended total rounded to cents (matches persisted line totals). */
export function computeLineItemTotal(
  quantity: DecimalLike,
  unitPrice: DecimalLike,
): number {
  return toDecimal(quantity)
    .mul(toDecimal(unitPrice))
    .toDecimalPlaces(2)
    .toNumber();
}
