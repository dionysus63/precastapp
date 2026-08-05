import { Prisma, type QuoteLineType } from "@/app/generated/prisma/client";
import { parseDrainRingStyle } from "@/lib/drain-ring-utils";
import { computeMoneyTotals } from "@/lib/money";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";
import { isNonBillableLineItem } from "@/lib/quotes/constants";

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
  galleyFamilyCode?: string | null;
  structureConfigJson?: Prisma.JsonValue | null;
};

export function computeQuoteTotalsFromLines(
  lineItems: LineItemSource[],
  taxRate: Prisma.Decimal,
  discountAmount: Prisma.Decimal = new Prisma.Decimal(0),
) {
  const billableLines = lineItems.filter(
    (line) => !isNonBillableLineItem(line.lineType),
  );
  const computed = computeMoneyTotals(
    billableLines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
    taxRate,
    discountAmount,
  );

  let billableIndex = 0;
  const lineTotals = lineItems.map((line) => {
    if (isNonBillableLineItem(line.lineType)) {
      return new Prisma.Decimal(0);
    }
    const total = computed.lineTotals[billableIndex]!;
    billableIndex += 1;
    return total;
  });

  const totalWeight = lineItems.reduce(
    (sum, line) => {
      if (isNonBillableLineItem(line.lineType)) {
        return sum;
      }
      return line.weight != null
        ? sum.add(toQuoteDecimal(line.weight).mul(toQuoteDecimal(line.quantity)))
        : sum;
    },
    new Prisma.Decimal(0),
  );

  const totalYards = lineItems.reduce(
    (sum, line) => {
      if (isNonBillableLineItem(line.lineType)) {
        return sum;
      }
      return line.yards != null
        ? sum.add(toQuoteDecimal(line.yards).mul(toQuoteDecimal(line.quantity)))
        : sum;
    },
    new Prisma.Decimal(0),
  );

  const deliveryAmount = computeDeliveryAmount(
    lineItems.map((line) => ({
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: line.description,
    })),
    lineTotals,
  );

  return { computed, lineTotals, totalWeight, totalYards, deliveryAmount };
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
    // All relations by FK scalar: mixing relation syntax (connect) with
    // scalars here flips Prisma's nested create into checked mode, which
    // rejects productId/jobStructureId outright.
    productId: line.productId,
    jobStructureId: options?.jobStructureId ?? null,
    previousLineItemId: options?.previousLineItemId ?? null,
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
    galleyFamilyCode: line.galleyFamilyCode ?? null,
    // Structure workbook configs must survive copies/revisions — losing them
    // would strand the drill-sheet workflow on the new quote's lines.
    ...(line.structureConfigJson != null
      ? { structureConfigJson: line.structureConfigJson as Prisma.InputJsonValue }
      : {}),
  };
}
