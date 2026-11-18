import { readFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@/app/generated/prisma/client";
import { getCompanyProfile, type CompanyProfile } from "@/lib/app-settings";
import { toDecimal, type DecimalLike } from "@/lib/decimal";
import { formatUsd } from "@/lib/format";
import {
  renderPurchaseOrderPdf,
  type PurchaseOrderPdfData,
  type PurchaseOrderPdfParty,
} from "@/lib/purchase-order-pdf";

export type PurchaseOrderVendorForPdf = {
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
};

/**
 * A purchase order as the PDF needs it: a saved one read from the database,
 * or one built from what is on the editor screen (lib/purchase-order-draft-preview).
 */
export type PurchaseOrderForPdf = {
  poNumber: string;
  /** @db.Date values (UTC midnight). */
  orderDate: Date | null;
  expectedDate: Date | null;
  enteredBy: string | null;
  notes: string | null;
  /** Whether the purchase is taxable; the page says which. */
  taxable: boolean;
  /**
   * A "quote only" order: placed against the vendor's quote, which the page
   * names in place of lines. `total` is then the quote's total.
   */
  quoteOnly: boolean;
  quoteNumber: string | null;
  quoteDate: Date | null;
  vendor: PurchaseOrderVendorForPdf;
  lines: Array<{
    itemCode: string;
    description: string | null;
    quantityOrdered: DecimalLike;
    unit: string;
    unitPrice: DecimalLike;
    total: DecimalLike;
  }>;
  total: DecimalLike;
};

/** Prisma `select` that reads a saved purchase order as PurchaseOrderForPdf. */
export const purchaseOrderForPdfSelect = {
  poNumber: true,
  orderDate: true,
  expectedDate: true,
  enteredBy: true,
  notes: true,
  taxable: true,
  quoteOnly: true,
  quoteNumber: true,
  quoteDate: true,
  total: true,
  vendor: {
    select: {
      name: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      phone: true,
      email: true,
      contactName: true,
    },
  },
  lines: {
    orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
    select: {
      itemCode: true,
      description: true,
      quantityOrdered: true,
      unit: true,
      unitPrice: true,
      total: true,
    },
  },
} satisfies Prisma.PurchaseOrderSelect;

/** "11/17/2026" for a @db.Date value (its UTC date, as on invoices). */
function formatDateForPdf(value: Date | null): string {
  if (!value) {
    return "";
  }
  return `${value.getUTCMonth() + 1}/${value.getUTCDate()}/${value.getUTCFullYear()}`;
}

/** "4", "2.5", "1,200": a quantity without the stored trailing zeros. */
function formatQuantityForPdf(value: DecimalLike): string {
  return toDecimal(value)
    .toNumber()
    .toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** Most lines the vendor block holds under the name. */
const PARTY_DETAIL_LINES = 4;

export function vendorPartyForPdf(
  vendor: PurchaseOrderVendorForPdf,
): PurchaseOrderPdfParty {
  const cityState = [clean(vendor.city), clean(vendor.state)]
    .filter(Boolean)
    .join(", ");
  const cityLine = [cityState, clean(vendor.zip)].filter(Boolean).join(" ");
  const contact = clean(vendor.contactName);
  const lines = [
    clean(vendor.address),
    cityLine,
    contact ? `Attn: ${contact}` : "",
    clean(vendor.phone),
    clean(vendor.email),
  ].filter(Boolean);
  // Everything filled in is one line too many: phone and email share a line.
  if (lines.length > PARTY_DETAIL_LINES) {
    const email = lines.pop()!;
    const phone = lines.pop()!;
    lines.push(`${phone}   ${email}`);
  }
  return { name: clean(vendor.name), lines };
}

/**
 * Deliveries come to the plant: the company's own name and address. The
 * address setting is one line ("20 Stiriz Road, Brookhaven, NY 11719"); it
 * prints as street, then the rest.
 */
export function shipToPartyForPdf(company: CompanyProfile): PurchaseOrderPdfParty {
  const address = clean(company.address);
  const comma = address.indexOf(",");
  const addressLines =
    comma > 0
      ? [address.slice(0, comma).trim(), address.slice(comma + 1).trim()]
      : [address];
  return {
    name: clean(company.name),
    lines: [...addressLines, clean(company.phone)].filter(Boolean),
  };
}

export function buildPurchaseOrderPdfData(
  purchaseOrder: PurchaseOrderForPdf,
  company: CompanyProfile,
): PurchaseOrderPdfData {
  return {
    poNumber: purchaseOrder.poNumber,
    orderDate: formatDateForPdf(purchaseOrder.orderDate),
    expectedDate: formatDateForPdf(purchaseOrder.expectedDate),
    orderedBy: clean(purchaseOrder.enteredBy),
    tax: purchaseOrder.taxable ? "Taxable" : "Non-taxable",
    vendor: vendorPartyForPdf(purchaseOrder.vendor),
    shipTo: shipToPartyForPdf(company),
    quote: purchaseOrder.quoteOnly
      ? {
          number: clean(purchaseOrder.quoteNumber),
          date: formatDateForPdf(purchaseOrder.quoteDate),
        }
      : null,
    lines: purchaseOrder.lines.map((line) => ({
      itemCode: clean(line.itemCode),
      description: clean(line.description),
      quantity: formatQuantityForPdf(line.quantityOrdered),
      unit: clean(line.unit),
      // Unit prices keep up to four decimals (pipe by the foot).
      unitPrice: formatUsd(line.unitPrice, { maximumFractionDigits: 4 }),
      amount: formatUsd(line.total),
    })),
    total: formatUsd(purchaseOrder.total),
    notes: clean(purchaseOrder.notes),
    companyLine: [clean(company.name), clean(company.address), clean(company.phone)]
      .filter(Boolean)
      .join("   |   "),
  };
}

let headerImage: Promise<Uint8Array | null> | null = null;

/** The header artwork the quote, invoice and ticket templates carry. */
function loadHeaderImage(): Promise<Uint8Array | null> {
  headerImage ??= readFile(
    path.join(process.cwd(), "assets", "templates", "lip-header.png"),
  ).then(
    (bytes) => new Uint8Array(bytes),
    () => null,
  );
  return headerImage;
}

export async function generatePurchaseOrderPdfBytes(
  purchaseOrder: PurchaseOrderForPdf,
): Promise<Uint8Array> {
  const [company, headerImagePng] = await Promise.all([
    getCompanyProfile(),
    loadHeaderImage(),
  ]);
  return renderPurchaseOrderPdf(buildPurchaseOrderPdfData(purchaseOrder, company), {
    headerImagePng,
  });
}
