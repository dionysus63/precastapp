import type { Prisma } from "@/app/generated/prisma/client";
import {
  formatDrainRingPoolDescription,
  type DrainRingStyle,
} from "@/lib/drain-ring-utils";
import { formatQuantity, formatUsd } from "@/lib/format";
import type { QuoteLineItemRecord, QuoteRecord } from "@/lib/quote-mapper";
import type { QuoteDrawLineItem } from "@/lib/quote-pdf-line-items";

export const QUOTE_PDF_INCLUDE = {
  lineItems: {
    orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
  },
} satisfies Prisma.QuoteInclude;

export type DbQuoteForPdf = QuoteRecord & {
  lineItems: QuoteLineItemRecord[];
};

export type QuoteContentPage = {
  number: number;
  count: number;
};

function blankOr(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function formatDateForPdf(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function splitMultilineAddress(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatQuoteNumberForPdf(quote: DbQuoteForPdf): string {
  const base = quote.quoteNumber.trim();
  if (quote.revisionNumber > 0) {
    return `${base} R${quote.revisionNumber}`;
  }
  return base;
}

function formatPageNumber(page: QuoteContentPage): string {
  if (page.count <= 1) {
    return "1";
  }
  return `${page.number} of ${page.count}`;
}

function parseAmount(value: { toString(): string }): number {
  const amount = Number.parseFloat(value.toString());
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoneyForPdf(value: { toString(): string } | number): string {
  return formatUsd(value, { nullDisplay: "" });
}

function resolveLineDescription(line: QuoteLineItemRecord): string {
  if (line.isDrainRing && line.ringDiameterFeet && line.poolHeightFeet) {
    const diameter = Number(line.ringDiameterFeet);
    const poolHeight = Number(line.poolHeightFeet);
    const quantity = Number(line.quantity);
    const poolCount =
      poolHeight > 0 ? Math.round((quantity / poolHeight) * 100) / 100 : 0;
    if (Number.isFinite(diameter) && Number.isFinite(poolHeight) && poolCount > 0) {
      return formatDrainRingPoolDescription({
        poolCount,
        poolHeight,
        diameter,
        style: (line.drainRingStyle ?? "DRAIN") as DrainRingStyle,
      });
    }
  }

  return line.description?.trim() ?? "";
}

export function mapQuoteLineItemsForPdf(
  lineItems: DbQuoteForPdf["lineItems"],
): QuoteDrawLineItem[] {
  return lineItems.map((line) => ({
    item: line.itemCode.trim(),
    qty: formatQuantity(line.quantity),
    description: resolveLineDescription(line),
    unitPrice: formatMoneyForPdf(line.unitPrice),
    total: formatMoneyForPdf(line.total),
  }));
}

export function buildQuoteFormData(
  quote: DbQuoteForPdf,
  contentPage: QuoteContentPage,
  isLastPage: boolean,
): Record<string, string> {
  const projectAddressLines = splitMultilineAddress(quote.projectAddress);
  const subtotalAfterDiscount =
    parseAmount(quote.subtotal) - parseAmount(quote.discountAmount);

  const data: Record<string, string> = {
    M_Quote_No: formatQuoteNumberForPdf(quote),
    M_Date: formatDateForPdf(quote.quoteDate),
    M_Valid_Until: formatDateForPdf(quote.expirationDate),
    M_Terms: blankOr(quote.termsAndConditions),
    M_FOB: "Factory",
    M_Salesperson: blankOr(quote.estimator),
    M_Page: formatPageNumber(contentPage),
    "Quote to - Name": blankOr(quote.contactName),
    "Quote to - Company": blankOr(quote.customerName),
    "Quote to - Phone": blankOr(quote.contactPhone),
    "Quote to - Email": blankOr(quote.contactEmail),
    "Project Name": blankOr(quote.projectName),
    "Job Number": blankOr(quote.jobNumber),
    "Project Address 1": projectAddressLines[0] ?? "",
    "Project Address 2": projectAddressLines[1] ?? "",
  };

  if (isLastPage) {
    data.Notes = blankOr(quote.customerNotes);
    data.TOT_Subtotal = formatMoneyForPdf(subtotalAfterDiscount);
    data.TOT_Freight = formatMoneyForPdf(quote.deliveryAmount);
    data.TOT_Sales = formatMoneyForPdf(quote.salesTax);
    data.TOT_TOTAL = formatMoneyForPdf(quote.total);
  }

  return data;
}
