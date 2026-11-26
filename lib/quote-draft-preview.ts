/**
 * Live quote preview for the quote form.
 *
 * The form sends what is on screen (who the quote is to, dates, terms, the
 * lines) and this module turns it into the same shape the saved-quote PDF is
 * filled from, WITHOUT saving anything: no quote number is taken and nothing
 * is written.
 *
 * Money is worked out here the way a save works it out (lib/money, the same
 * rounding createQuote / updateQuote use), never taken from the browser, so
 * the preview's totals are the ones the saved quote will print.
 *
 * The one thing the form does not carry is the revision marker ("R1"): a
 * quote being edited keeps its saved revision number, a new one has none.
 */
import { parseLocalDay } from "@/lib/date-only";
import { Decimal } from "@/lib/decimal";
import { parseDrainRingStyle } from "@/lib/drain-ring-utils";
import { computeMoneyTotals } from "@/lib/money";
import type { DbQuoteForPdf } from "@/lib/quote-pdf-data";
import {
  isNonBillableLineItem,
  resolveQuoteLineQuantityForStorage,
} from "@/lib/quotes/constants";
import { resolveLineDiscount } from "@/lib/quotes/line-discount-input";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";

/** More lines than any real quote; keeps a bad request from filling pages. */
export const QUOTE_DRAFT_PREVIEW_MAX_LINES = 1000;

export type QuoteDraftPreviewLine = {
  lineType: string;
  itemCode: string;
  description: string;
  quantity: number;
  /** The billed price; worked out again here when a list price comes along. */
  unitPrice: number;
  /** Price before the discount, and the percent off it. */
  listPrice?: number | null;
  discountPercent?: number | null;
  discountTyped?: boolean;
  taxable: boolean;
  isDrainRing: boolean;
  ringDiameterFeet: number | null;
  poolHeightFeet: number | null;
  drainRingStyle: string;
};

/** Only what prints on the quote. */
export type QuoteDraftPreviewInput = {
  /** The quote being edited; null while creating a new one. */
  quoteId: string | null;
  customerName: string;
  projectName: string;
  jobNumber: string | null;
  projectAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  estimator: string | null;
  /** yyyy-mm-dd, as the date inputs hold them. */
  quoteDate: string | null;
  expirationDate: string | null;
  taxRate: number;
  customerNotes: string | null;
  termsAndConditions: string | null;
  fob: string | null;
  /** False prints the quote without the discount columns; shown when absent. */
  showDiscount?: boolean;
  lines: QuoteDraftPreviewLine[];
};

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function textOrNull(value: unknown, maxLength: number): string | null {
  const trimmed = text(value, maxLength).trim();
  return trimmed ? trimmed : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Re-reads what the browser sent: a server action can be called with anything,
 * so nothing here is trusted to have the declared shape.
 */
export function parseQuoteDraftPreviewInput(
  raw: unknown,
): QuoteDraftPreviewInput {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  const lines: QuoteDraftPreviewLine[] = [];
  for (const entry of rawLines.slice(0, QUOTE_DRAFT_PREVIEW_MAX_LINES)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const line = entry as Record<string, unknown>;
    lines.push({
      lineType: text(line.lineType, 40),
      itemCode: text(line.itemCode, 200),
      description: text(line.description, 20_000),
      // A half-typed row (no quantity or price yet) still shows, as zero.
      quantity: Math.max(finiteNumber(line.quantity) ?? 0, 0),
      unitPrice: finiteNumber(line.unitPrice) ?? 0,
      listPrice: finiteNumber(line.listPrice),
      discountPercent: finiteNumber(line.discountPercent),
      discountTyped: line.discountTyped === true,
      taxable: line.taxable === true,
      isDrainRing: line.isDrainRing === true,
      ringDiameterFeet: finiteNumber(line.ringDiameterFeet),
      poolHeightFeet: finiteNumber(line.poolHeightFeet),
      drainRingStyle: text(line.drainRingStyle, 20) || "DRAIN",
    });
  }

  return {
    quoteId: textOrNull(input.quoteId, 64),
    customerName: text(input.customerName, 500).trim(),
    projectName: text(input.projectName, 500).trim(),
    jobNumber: textOrNull(input.jobNumber, 100),
    projectAddress: textOrNull(input.projectAddress, 1000),
    contactName: textOrNull(input.contactName, 500),
    contactEmail: textOrNull(input.contactEmail, 500),
    contactPhone: textOrNull(input.contactPhone, 100),
    estimator: textOrNull(input.estimator, 200),
    quoteDate: textOrNull(input.quoteDate, 10),
    expirationDate: textOrNull(input.expirationDate, 10),
    taxRate: Math.max(finiteNumber(input.taxRate) ?? 0, 0),
    customerNotes: textOrNull(input.customerNotes, 20_000),
    termsAndConditions: textOrNull(input.termsAndConditions, 2000),
    fob: textOrNull(input.fob, 200),
    showDiscount: input.showDiscount !== false,
    lines,
  };
}

/** What the draft takes from the saved quote, when one is being edited. */
export type QuoteDraftSavedFields = {
  revisionNumber: number;
};

/** The quote as it would be saved right now, in the PDF fill's shape. */
export function buildDraftQuoteForPdf(
  rawInput: QuoteDraftPreviewInput,
  saved: QuoteDraftSavedFields | null,
): DbQuoteForPdf {
  // Each line's billed price from its list price and discount, as a save
  // works it out.
  const input = {
    ...rawInput,
    lines: rawInput.lines.map((line) => ({
      ...line,
      ...resolveLineDiscount(line),
    })),
  };
  const billableLines = input.lines.filter(
    (line) => !isNonBillableLineItem(line.lineType),
  );
  const computed = computeMoneyTotals(
    billableLines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
    input.taxRate,
  );

  const zero = new Decimal(0);
  let billableIndex = 0;
  const lineTotals = input.lines.map((line) => {
    if (isNonBillableLineItem(line.lineType)) {
      return zero;
    }
    const total = computed.lineTotals[billableIndex]!;
    billableIndex += 1;
    return total;
  });
  const deliveryAmount = computeDeliveryAmount(input.lines, lineTotals);

  const now = new Date();
  return {
    id: input.quoteId ?? "draft",
    // Never printed (the PDF shows the revision marker only).
    quoteNumber: "",
    revisionNumber: saved?.revisionNumber ?? 0,
    originalQuoteId: null,
    jobId: null,
    customerId: null,
    jobNumber: input.jobNumber,
    customerName: input.customerName,
    projectName: input.projectName,
    projectAddress: input.projectAddress,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    contactId: null,
    contactTitle: null,
    status: "DRAFT",
    quoteType: "MIXED",
    estimator: input.estimator,
    quoteDate: input.quoteDate ? parseLocalDay(input.quoteDate) : null,
    bidDueDate: null,
    expirationDate: input.expirationDate
      ? parseLocalDay(input.expirationDate)
      : null,
    customerPO: null,
    subtotal: computed.subtotal,
    // A save always writes a zero discount.
    discountAmount: zero,
    deliveryAmount,
    taxableAmount: computed.taxableAmount,
    taxRate: new Decimal(input.taxRate),
    salesTax: computed.salesTax,
    total: computed.total,
    totalWeight: zero,
    totalYards: zero,
    internalNotes: null,
    customerNotes: input.customerNotes,
    termsAndConditions: input.termsAndConditions,
    fob: input.fob,
    leadTime: null,
    deliveryNotes: null,
    showDiscount: input.showDiscount !== false,
    priceListId: null,
    sentAt: null,
    jobBidderId: null,
    createdAt: now,
    updatedAt: now,
    lineItems: input.lines.map((line, index) => ({
      id: `draft-line-${index + 1}`,
      lineNumber: index + 1,
      lineType: line.lineType,
      productId: null,
      itemCode: line.itemCode,
      description: line.description,
      quantity: new Decimal(
        resolveQuoteLineQuantityForStorage(line.lineType, line.quantity),
      ),
      unit: "EA",
      // Stored (and so printed) rounded to cents.
      unitPrice: new Decimal(line.unitPrice).toDecimalPlaces(2),
      listPrice:
        line.listPrice != null
          ? new Decimal(line.listPrice).toDecimalPlaces(2)
          : null,
      discountPercent:
        line.discountPercent != null ? new Decimal(line.discountPercent) : null,
      discountTyped: line.discountTyped,
      weight: null,
      yards: null,
      taxable: line.taxable,
      total: lineTotals[index]!,
      statusNote: null,
      notes: null,
      isDrainRing: line.isDrainRing,
      ringDiameterFeet:
        line.ringDiameterFeet != null && line.ringDiameterFeet > 0
          ? new Decimal(line.ringDiameterFeet)
          : null,
      poolHeightFeet:
        line.poolHeightFeet != null && line.poolHeightFeet > 0
          ? new Decimal(line.poolHeightFeet)
          : null,
      drainRingStyle: line.isDrainRing
        ? parseDrainRingStyle(line.drainRingStyle)
        : "DRAIN",
    })),
  };
}
