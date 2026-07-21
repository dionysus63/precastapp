import type { Prisma } from "@/app/generated/prisma/client";
import {
  formatPostalAddressLines,
  removeAdsJointTypeSuffix,
  removeTrailingRingHeightSuffix,
  splitMultilineAddress,
} from "@/lib/delivery-ticket-pdf-data";
import { formatQuantity, formatUsd } from "@/lib/format";
import type { InvoiceDrawLineItem } from "@/lib/invoice-pdf-line-items";

export type InvoiceContentPage = {
  number: number;
  count: number;
};

export const INVOICE_PDF_INCLUDE = {
  lineItems: { orderBy: { lineNumber: "asc" as const } },
  customer: {
    select: {
      name: true,
      address: true,
      town: true,
      state: true,
      zip: true,
    },
  },
  deliveryTicket: {
    select: {
      ticketNumber: true,
      deliveryAddress: true,
      fulfillmentMethod: true,
      deliveryDate: true,
      job: {
        select: { projectAddress: true, city: true, state: true, zip: true },
      },
      quote: { select: { projectAddress: true } },
    },
  },
} as const satisfies Prisma.InvoiceInclude;

export type DbInvoiceForPdf = Prisma.InvoiceGetPayload<{
  include: typeof INVOICE_PDF_INCLUDE;
}>;

function blankOr(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function formatDateForPdf(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoneyForPdf(value: { toString(): string } | number): string {
  return formatUsd(value, { nullDisplay: "" });
}

function formatPageNumber(page: InvoiceContentPage): string {
  if (page.count <= 1) return "1";
  return `${page.number} of ${page.count}`;
}

export function formatCustomerAddress(customer: {
  address: string | null;
  town: string | null;
  state: string | null;
  zip: string | null;
} | null): string[] {
  if (!customer) return [];
  const lines: string[] = [];
  if (customer.address?.trim()) lines.push(customer.address.trim());
  const cityLine = [customer.town, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

/** Structure lines are distinct pieces and never merge on the printout. */
const STRUCTURE_INVOICE_LINE_TYPES = new Set([
  "CONFIGURABLE_STRUCTURE",
  "CUSTOM_STRUCTURE",
]);

export function mapInvoiceLineItemsForPdf(
  lineItems: DbInvoiceForPdf["lineItems"],
): InvoiceDrawLineItem[] {
  // Same printed treatment as the delivery ticket (mapLineItemsForPdf in
  // delivery-ticket-pdf-data): ring lines drop their "(5' ring)" editor
  // suffix, and rings picked from multiple pool groups — one DB row per
  // quote line for the same SKU — print as a single combined row. Lines only
  // merge when the price agrees, so the qty x unit price = total arithmetic
  // stays visibly correct.
  const result: InvoiceDrawLineItem[] = [];
  const mergedIndexByKey = new Map<string, number>();
  const mergedSums = new Map<number, { qty: number; total: number }>();

  for (const line of lineItems) {
    const description = removeAdsJointTypeSuffix(
      removeTrailingRingHeightSuffix(line.description?.trim() ?? ""),
    );
    const item: InvoiceDrawLineItem = {
      item: line.itemCode.trim(),
      qty: formatQuantity(line.quantity),
      description,
      unitPrice: formatMoneyForPdf(line.unitPrice),
      total: formatMoneyForPdf(line.total),
    };

    const qtyNumber = Number.parseFloat(line.quantity.toString());
    const totalNumber = Number.parseFloat(line.total.toString());
    const mergeKey =
      !STRUCTURE_INVOICE_LINE_TYPES.has(line.lineType) &&
      Number.isFinite(qtyNumber) &&
      Number.isFinite(totalNumber)
        ? `${item.item}::${line.unit}::${description}::${item.unitPrice}`
        : null;

    if (mergeKey != null) {
      const existingIndex = mergedIndexByKey.get(mergeKey);
      if (existingIndex != null) {
        const sums = mergedSums.get(existingIndex)!;
        sums.qty += qtyNumber;
        sums.total += totalNumber;
        result[existingIndex] = {
          ...result[existingIndex]!,
          qty: formatQuantity(sums.qty),
          total: formatMoneyForPdf(sums.total),
        };
        continue;
      }
      mergedIndexByKey.set(mergeKey, result.length);
      mergedSums.set(result.length, { qty: qtyNumber, total: totalNumber });
    }

    result.push(item);
  }

  return result;
}

/**
 * Full delivery address, mirroring the delivery ticket's resolution: the
 * ticket's own (possibly multi-line) address first, then the job's postal
 * address, then the quote's project address.
 */
function resolveInvoiceDeliveryAddressLines(invoice: DbInvoiceForPdf): string[] {
  const ticket = invoice.deliveryTicket;
  const ticketAddress = splitMultilineAddress(ticket.deliveryAddress);
  if (ticketAddress.length > 0) {
    return ticketAddress;
  }
  if (ticket.job) {
    const jobAddress = formatPostalAddressLines(
      ticket.job.projectAddress,
      ticket.job.city,
      ticket.job.state,
      ticket.job.zip,
    );
    if (jobAddress.length > 0) {
      return jobAddress;
    }
  }
  return splitMultilineAddress(ticket.quote?.projectAddress);
}

export function buildInvoiceFormData(
  invoice: DbInvoiceForPdf,
  company: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
  },
  contentPage: InvoiceContentPage,
  isLastPage: boolean,
  extras: {
    /** Overrides the invoice's customer relation (name-matched fallback). */
    customerAddressLines?: string[];
  } = {},
): Record<string, string> {
  const customerAddress =
    extras.customerAddressLines ?? formatCustomerAddress(invoice.customer);
  // Any stored discount nets into the printed subtotal — the totals box has
  // no Discount row (rare discounts are entered as line items instead).
  const subtotalAfterDiscount =
    Number(invoice.subtotal) - Number(invoice.discountAmount);

  const data: Record<string, string> = {
    "Invoice Number": blankOr(invoice.invoiceNumber),
    "Due Date": formatDateForPdf(invoice.dueDate),
    "Bill To Name": blankOr(invoice.customerName),
    "Bill To Address 1": customerAddress[0] ?? "",
    "Bill To Address 2": customerAddress[1] ?? "",
    "Project Name": blankOr(invoice.projectName),
    "Job Number": blankOr(invoice.jobNumber),
    "Ticket Number": blankOr(invoice.deliveryTicket.ticketNumber),
    "Delivery Date": formatDateForPdf(invoice.deliveryTicket.deliveryDate),
    "Delivery Address": resolveInvoiceDeliveryAddressLines(invoice).join("\n"),
    "Company Name": blankOr(company.companyName),
    "Company Address": blankOr(company.companyAddress),
    "Company Phone": blankOr(company.companyPhone),
    "Company Email": blankOr(company.companyEmail),
    Page: formatPageNumber(contentPage),
  };

  if (isLastPage) {
    data.Subtotal = formatMoneyForPdf(subtotalAfterDiscount);
    data.Delivery = formatMoneyForPdf(invoice.deliveryAmount);
    data["Tax Rate"] = `${Number(invoice.taxRate).toFixed(3)}%`;
    data["Sales Tax"] = formatMoneyForPdf(invoice.salesTax);
    data.Total = formatMoneyForPdf(invoice.total);
  }

  return data;
}

/**
 * AcroForm field names expected on assets/templates/invoice-template.pdf.
 * Replace the starter template with your own PDF using the same names.
 */
export const INVOICE_TEMPLATE_FIELD_NAMES = [
  "Invoice Number",
  "Due Date",
  "Bill To Name",
  "Bill To Address 1",
  "Bill To Address 2",
  "Project Name",
  "Job Number",
  "Ticket Number",
  "Delivery Date",
  "Delivery Address",
  "Company Name",
  "Company Address",
  "Company Phone",
  "Company Email",
  "Page",
  "Subtotal",
  "Delivery",
  "Tax Rate",
  "Sales Tax",
  "Total",
] as const;
