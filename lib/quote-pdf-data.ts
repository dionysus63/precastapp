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

/**
 * Splits a project address across the template's two address lines: explicit
 * newlines win; otherwise a comma-structured address defaults to street on
 * top and city/state/zip below ("123 Main St, Suite 5, Shirley, NY 11967" →
 * "123 Main St, Suite 5" / "Shirley, NY 11967").
 */
function splitMultilineAddress(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  const explicitLines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (explicitLines.length > 1) {
    return explicitLines;
  }

  const segments = explicitLines[0]
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length < 2) {
    return explicitLines;
  }

  // A zip in its own segment ("…, NY, 11710") belongs with the state, not as
  // its own tail — merge it so the city lands on line 2 with state and zip.
  if (segments.length >= 3 && /^\d{5}(-\d{4})?$/.test(segments[segments.length - 1])) {
    const zip = segments.pop()!;
    segments[segments.length - 1] = `${segments[segments.length - 1]} ${zip}`;
  }

  // Street (plus any suite/building segments) on top; city + state/zip below.
  const tailCount = Math.min(2, segments.length - 1);
  return [
    segments.slice(0, segments.length - tailCount).join(", "),
    segments.slice(segments.length - tailCount).join(", "),
  ];
}

/**
 * The printed quote intentionally omits the internal quote number; only the
 * revision marker shows (blank for the original).
 */
function formatQuoteNumberForPdf(quote: DbQuoteForPdf): string {
  if (quote.revisionNumber > 0) {
    return `R${quote.revisionNumber}`;
  }
  return "";
}

function formatPageNumber(page: QuoteContentPage): string {
  return `${page.number} of ${Math.max(page.count, 1)}`;
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
  return lineItems.map((line) => {
    if (line.lineType === "CATEGORY") {
      return {
        item: "",
        qty: "",
        description: line.description?.trim() ?? "",
        unitPrice: "",
        total: "",
        isCategoryLine: true,
      };
    }

    if (line.lineType === "NOTE") {
      return {
        item: "",
        qty: "",
        description: line.description?.trim() ?? "",
        unitPrice: "",
        total: "",
        isNoteLine: true,
      };
    }

    if (line.lineType === "PAGE_BREAK") {
      return {
        item: "",
        qty: "",
        description: "",
        unitPrice: "",
        total: "",
        isPageBreak: true,
      };
    }

    return {
      item: line.itemCode.trim(),
      qty: formatQuantity(line.quantity),
      description: resolveLineDescription(line),
      unitPrice: formatMoneyForPdf(line.unitPrice),
      total: formatMoneyForPdf(line.total),
    };
  });
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
    M_FOB: quote.fob?.trim() || "Factory",
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
