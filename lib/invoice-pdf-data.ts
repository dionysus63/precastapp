import type { Prisma } from "@/app/generated/prisma/client";
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

function formatCustomerAddress(invoice: DbInvoiceForPdf): string[] {
  const customer = invoice.customer;
  if (!customer) return [];
  const lines: string[] = [];
  if (customer.address?.trim()) lines.push(customer.address.trim());
  const cityLine = [customer.town, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

export function mapInvoiceLineItemsForPdf(
  lineItems: DbInvoiceForPdf["lineItems"],
): InvoiceDrawLineItem[] {
  return lineItems.map((line) => ({
    item: line.itemCode.trim(),
    qty: formatQuantity(line.quantity),
    description: line.description?.trim() ?? "",
    unitPrice: formatMoneyForPdf(line.unitPrice),
    total: formatMoneyForPdf(line.total),
  }));
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
): Record<string, string> {
  const customerAddress = formatCustomerAddress(invoice);
  const subtotalAfterDiscount =
    Number(invoice.subtotal) - Number(invoice.discountAmount);

  const data: Record<string, string> = {
    "Invoice Number": blankOr(invoice.invoiceNumber),
    "Invoice Date": formatDateForPdf(invoice.invoiceDate),
    "Due Date": formatDateForPdf(invoice.dueDate),
    "Bill To Name": blankOr(invoice.customerName),
    "Bill To Address 1": customerAddress[0] ?? "",
    "Bill To Address 2": customerAddress[1] ?? "",
    "Project Name": blankOr(invoice.projectName),
    "Job Number": blankOr(invoice.jobNumber),
    "Ticket Number": blankOr(invoice.deliveryTicket.ticketNumber),
    "Delivery Address": blankOr(invoice.deliveryTicket.deliveryAddress),
    "Company Name": blankOr(company.companyName),
    "Company Address": blankOr(company.companyAddress),
    "Company Phone": blankOr(company.companyPhone),
    "Company Email": blankOr(company.companyEmail),
    Page: formatPageNumber(contentPage),
  };

  if (isLastPage) {
    data.Subtotal = formatMoneyForPdf(subtotalAfterDiscount);
    data.Discount = formatMoneyForPdf(invoice.discountAmount);
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
  "Invoice Date",
  "Due Date",
  "Bill To Name",
  "Bill To Address 1",
  "Bill To Address 2",
  "Project Name",
  "Job Number",
  "Ticket Number",
  "Delivery Address",
  "Company Name",
  "Company Address",
  "Company Phone",
  "Company Email",
  "Page",
  "Subtotal",
  "Discount",
  "Delivery",
  "Tax Rate",
  "Sales Tax",
  "Total",
] as const;
