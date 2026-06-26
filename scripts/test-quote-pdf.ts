import { writeFileSync } from "fs";
import { generateQuotePdfBytes } from "@/lib/quote-pdf-fill";
import type { DbQuoteForPdf } from "@/lib/quote-pdf-data";

function makeLineItem(
  lineNumber: number,
  itemCode: string,
  description: string,
  quantity: number,
  unitPrice: number,
) {
  const total = quantity * unitPrice;
  return {
    id: `line-${lineNumber}`,
    lineNumber,
    sortOrder: lineNumber,
    lineType: "STOCK_PRODUCT",
    productId: null,
    jobStructureId: null,
    itemCode,
    description,
    quantity: { toString: () => String(quantity) },
    unit: "EA",
    unitPrice: { toString: () => String(unitPrice) },
    total: { toString: () => String(total) },
    weight: null,
    yards: null,
    taxable: true,
    statusNote: null,
    notes: null,
    isDrainRing: false,
    ringDiameterFeet: null,
    poolHeightFeet: null,
    drainRingStyle: null,
  };
}

const mockQuote: DbQuoteForPdf = {
  id: "test-quote-id",
  quoteNumber: "Q99999",
  revisionNumber: 1,
  originalQuoteId: null,
  jobId: null,
  customerId: null,
  jobNumber: "26-999",
  customerName: "Sample Contractor LLC",
  projectName: "Sample Municipal Project",
  projectAddress: "123 Main Street\nPatchogue, NY 11772",
  contactName: "John Smith",
  contactEmail: "john@example.com",
  contactPhone: "631-555-0100",
  contactId: null,
  contactTitle: "Project Manager",
  status: "DRAFT",
  quoteType: "STANDARD",
  estimator: "Nick",
  quoteDate: new Date("2026-06-01"),
  bidDueDate: new Date("2026-06-15"),
  expirationDate: new Date("2026-07-01"),
  customerPO: "PO-12345",
  subtotal: { toString: () => "12500" },
  discountAmount: { toString: () => "500" },
  deliveryAmount: { toString: () => "750" },
  taxableAmount: { toString: () => "12750" },
  taxRate: { toString: () => "8.625" },
  salesTax: { toString: () => "1099.69" },
  total: { toString: () => "13849.69" },
  totalWeight: { toString: () => "45000" },
  totalYards: { toString: () => "12.5" },
  internalNotes: null,
  customerNotes: "Please coordinate delivery with site superintendent.",
  termsAndConditions: "Net 30",
  leadTime: "4-6 weeks",
  deliveryNotes: null,
  priceListId: null,
  sentAt: null,
  jobBidderId: null,
  createdAt: new Date("2026-06-01"),
  updatedAt: new Date("2026-06-01"),
  lineItems: [
    makeLineItem(1, "MH-48", "48in Manhole with standard frame and cover", 2, 850),
    makeLineItem(
      2,
      "R10-SS-5",
      "5 foot sanitary ring section with extended description that should wrap across multiple lines in the description column when rendered on the quote PDF form",
      3,
      425,
    ),
    makeLineItem(3, "VALVE-12", "12 inch valve assembly", 1, 1200),
    makeLineItem(4, "CB-24", "24in catch basin with grating", 4, 675),
    makeLineItem(5, "PB-36", "36in precast box culvert section", 2, 2100),
    makeLineItem(6, "GR-8", "8 inch gate ring", 6, 185),
    makeLineItem(7, "ST-12", "12 inch storm structure base", 1, 3200),
    makeLineItem(8, "RC-6", "6 foot riser section", 8, 310),
    makeLineItem(9, "CV-18", "18 inch cone valve", 2, 890),
    makeLineItem(10, "DP-24", "24 inch drain pan", 3, 445),
    makeLineItem(11, "MH-60", "60in manhole base section", 1, 4500),
    makeLineItem(12, "RG-10", "10 foot ring section", 5, 520),
    makeLineItem(13, "AB-8", "8 inch adapter block", 4, 275),
    makeLineItem(14, "TB-12", "12 inch transition box", 2, 980),
    makeLineItem(
      15,
      "LB-24",
      "24 inch leaching basin with extended description for pagination testing on the quote continuation template page",
      3,
      650,
    ),
    makeLineItem(16, "EC-18", "18 inch end cap", 6, 220),
    makeLineItem(17, "FS-36", "36 inch flared end section", 2, 1850),
    makeLineItem(18, "WP-10", "10 inch wall panel", 8, 340),
    makeLineItem(19, "SP-14", "14 inch slab panel", 4, 720),
    makeLineItem(20, "HD-6", "6 inch headwall", 3, 890),
  ],
};

async function main() {
  const bytes = await generateQuotePdfBytes(mockQuote);
  writeFileSync("test-quote.pdf", bytes);
  console.log("Wrote test-quote.pdf");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
