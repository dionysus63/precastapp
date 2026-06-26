import { Prisma, type QuoteLineType } from "@/app/generated/prisma/client";
import { parseDrainRingStyle } from "@/lib/drain-ring-utils";
import { computeMoneyTotals } from "@/lib/money";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";

export function toQuoteDecimal(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value.toString());
}

export function toOptionalQuoteDecimal(
  value: Prisma.Decimal | number | string | null,
) {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value.toString());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return new Prisma.Decimal(parsed);
}

type LineItemSource = {
  lineNumber: number;
  lineType: QuoteLineType;
  productId: string | null;
  itemCode: string;
  description: string | null;
  quantity: Prisma.Decimal;
  unit: string;
  unitPrice: Prisma.Decimal;
  weight: Prisma.Decimal | null;
  yards: Prisma.Decimal | null;
  taxable: boolean;
  statusNote: string | null;
  sortOrder: number;
  notes: string | null;
  isDrainRing: boolean;
  ringDiameterFeet: Prisma.Decimal | null;
  poolHeightFeet: Prisma.Decimal | null;
  drainRingStyle: string;
};

export function computeQuoteTotalsFromLines(
  lineItems: LineItemSource[],
  taxRate: Prisma.Decimal,
) {
  const computed = computeMoneyTotals(
    lineItems.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
    taxRate,
  );

  const totalWeight = lineItems.reduce(
    (sum, line) =>
      line.weight != null
        ? sum.add(toQuoteDecimal(line.weight).mul(toQuoteDecimal(line.quantity)))
        : sum,
    new Prisma.Decimal(0),
  );

  const totalYards = lineItems.reduce(
    (sum, line) =>
      line.yards != null
        ? sum.add(toQuoteDecimal(line.yards).mul(toQuoteDecimal(line.quantity)))
        : sum,
    new Prisma.Decimal(0),
  );

  const deliveryAmount = computeDeliveryAmount(
    lineItems.map((line) => ({
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: line.description,
    })),
    computed.lineTotals,
  );

  return { computed, totalWeight, totalYards, deliveryAmount };
}

export function mapLineItemForCreate(
  line: LineItemSource,
  lineTotal: Prisma.Decimal,
  options?: {
    previousLineItemId?: string;
    jobStructureId?: string | null;
  },
) {
  return {
    lineNumber: line.lineNumber,
    lineType: line.lineType,
    productId: line.productId,
    jobStructureId: options?.jobStructureId ?? null,
    ...(options?.previousLineItemId
      ? { previousLineItem: { connect: { id: options.previousLineItemId } } }
      : {}),
    itemCode: line.itemCode,
    description: line.description,
    quantity: toQuoteDecimal(line.quantity),
    unit: line.unit,
    unitPrice: toQuoteDecimal(line.unitPrice),
    weight: toOptionalQuoteDecimal(line.weight),
    yards: toOptionalQuoteDecimal(line.yards),
    taxable: line.taxable,
    total: lineTotal,
    statusNote: line.statusNote,
    sortOrder: line.sortOrder,
    notes: line.notes,
    isDrainRing: line.isDrainRing,
    ringDiameterFeet: toOptionalQuoteDecimal(line.ringDiameterFeet),
    poolHeightFeet: toOptionalQuoteDecimal(line.poolHeightFeet),
    drainRingStyle: line.isDrainRing
      ? parseDrainRingStyle(line.drainRingStyle)
      : "DRAIN",
  };
}
