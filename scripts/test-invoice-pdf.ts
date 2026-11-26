/**
 * Renders sample invoices to look at: test-invoice.pdf (no discounts, the
 * standard table) and test-invoice-discount.pdf (List Price / Disc % / Net
 * Price). Needs the database for the company settings only.
 *
 * Run with: npx tsx --env-file=.env scripts/test-invoice-pdf.ts
 */
import { writeFileSync } from "fs";
import { generateInvoicePdfBytes } from "@/lib/invoice-pdf-fill";
import type { DbInvoiceForPdf } from "@/lib/invoice-pdf-data";

function decimal(value: number) {
  return { toString: () => String(value) };
}

function makeLine(
  lineNumber: number,
  itemCode: string,
  description: string,
  quantity: number,
  listPrice: number,
  discountPercent = 0,
) {
  // unitPrice is the billed price: the list price less the discount.
  const unitPrice = Math.round(listPrice * (100 - discountPercent)) / 100;
  return {
    id: `line-${lineNumber}`,
    lineNumber,
    sortOrder: lineNumber,
    lineType: "STOCK_PRODUCT",
    itemCode,
    description,
    quantity: decimal(quantity),
    unit: "EA",
    unitPrice: decimal(unitPrice),
    listPrice: discountPercent > 0 ? decimal(listPrice) : null,
    discountPercent: discountPercent > 0 ? decimal(discountPercent) : null,
    needsPrice: false,
    taxable: true,
    total: decimal(Math.round(quantity * unitPrice * 100) / 100),
  };
}

function makeInvoice(discounts: boolean, pickup: boolean): DbInvoiceForPdf {
  const pct = (value: number) => (discounts ? value : 0);
  const lineItems = [
    makeLine(1, "CB-4x4-BASE", "4' x 4' Catch Basin Base, 4' High", 2, 1450, pct(pickup ? 20 : 10)),
    makeLine(2, "CB-4x4-RISER", "4' x 4' Catch Basin Riser, 2' High", 2, 618, pct(pickup ? 20 : 10)),
    makeLine(3, "FR-2424-IMP", "24\" x 24\" Frame and Grate, imported", 2, 385, pct(10)),
    makeLine(4, "FR-2424-DOM", "24\" x 24\" Frame and Grate, domestic", 1, 512),
    makeLine(5, "MH-1", "4' Dia. Manhole, 6' High, per drill sheet MH-1", 1, 2380),
  ];
  const subtotal = lineItems.reduce(
    (sum, line) => sum + Number(line.total.toString()),
    0,
  );
  const taxRate = 8.625;
  const salesTax = Math.round(subtotal * taxRate) / 100;
  return {
    id: "invoice-test",
    invoiceNumber: "I10212",
    customerId: null,
    customerName: "Sample Contracting Corp.",
    projectName: "Main Street Drainage",
    jobNumber: "26-118",
    dueDate: new Date(2026, 11, 26),
    subtotal: decimal(subtotal),
    discountAmount: decimal(0),
    taxRate: decimal(taxRate),
    salesTax: decimal(salesTax),
    total: decimal(Math.round((subtotal + salesTax) * 100) / 100),
    lineItems,
    customer: {
      name: "Sample Contracting Corp.",
      address: "100 Example Road",
      town: "Brookhaven",
      state: "NY",
      zip: "11719",
    },
    deliveryTicket: {
      ticketNumber: "T10212",
      deliveryAddress: "Main Street at First Avenue, Brookhaven, NY",
      fulfillmentMethod: pickup ? "PICKUP" : "DELIVERY",
      deliveryDate: new Date(2026, 10, 26),
      job: null,
      quote: { projectAddress: null, customerPO: "PO-4471", showDiscount: true },
    },
  } as unknown as DbInvoiceForPdf;
}

async function main() {
  writeFileSync(
    "test-invoice.pdf",
    await generateInvoicePdfBytes(makeInvoice(false, false)),
  );
  writeFileSync(
    "test-invoice-discount.pdf",
    await generateInvoicePdfBytes(makeInvoice(true, true)),
  );
  console.log("Wrote test-invoice.pdf and test-invoice-discount.pdf");
  process.exit(0);
}

void main();
