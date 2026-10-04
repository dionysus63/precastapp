import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PDFDocument } from "pdf-lib";
import { DELIVERY_TICKET_PDF_INCLUDE } from "@/lib/delivery-ticket-pdf-data";
import {
  generateDeliveryTicketPdfBytes,
  getDeliveryTicketPdfFillOptions,
} from "@/lib/delivery-ticket-pdf-fill";
import { INVOICE_PDF_INCLUDE } from "@/lib/invoice-pdf-data";
import { generateInvoicePdfBytes } from "@/lib/invoice-pdf-fill";
import { prisma } from "@/lib/prisma";
import { QUOTE_PDF_INCLUDE } from "@/lib/quote-pdf-data";
import { generateQuotePdfBytes } from "@/lib/quote-pdf-fill";

const tag = `PDFCHARS-${Date.now()}`;
// Office/Excel characters outside WinAnsi, plus a name longer than every
// template field (the ticket template caps fields at MaxLen=100).
const PROJECT = `${tag} St. Mary’s Church — Parking Lot Expansion, Phase 2 – North Lot (48″ MH ≤ 5′-6″, ⅝ rebar) ✓ ${"x".repeat(80)}`;
const DESCRIPTION = `48″ MH − rim ≥ 101.5′ · ⅞ steps · ✓ approved 🚧 ${"long text ".repeat(30)}`;
const NOTE = Array.from({ length: 90 }, (_, i) => `Exclusion ${i + 1}: no ⅝″ dowels.`).join("<br>");

let quoteId: string;
let ticketId: string;
let invoiceId: string;

beforeAll(async () => {
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q`,
      customerName: `${tag} Contractor ″Best″ Co`,
      projectName: PROJECT,
      projectAddress: "1234 Long Industrial Parkway – Building ″B″, Suite 500, Springfield",
      customerNotes: NOTE,
      lineItems: {
        create: [
          {
            lineNumber: 1,
            sortOrder: 1,
            lineType: "CUSTOM_STRUCTURE",
            itemCode: "MH-1″",
            description: DESCRIPTION,
            quantity: 1,
            unit: "EA",
            unitPrice: 1000,
            total: 1000,
          },
          {
            lineNumber: 2,
            sortOrder: 2,
            lineType: "NOTE",
            itemCode: "",
            description: NOTE,
            quantity: 1,
            unit: "EA",
            unitPrice: 0,
            total: 0,
          },
        ],
      },
    },
  });
  quoteId = quote.id;

  const ticket = await prisma.deliveryTicket.create({
    data: {
      ticketNumber: `${tag}-T1X`,
      customerName: `${tag} Contractor ″Best″ Co`,
      projectName: PROJECT,
      status: "DELIVERED",
      lineItems: {
        create: [
          {
            lineNumber: 1,
            lineType: "CUSTOM_STRUCTURE",
            itemCode: "MH-1″",
            description: DESCRIPTION,
            quantity: 1,
            unit: "EA",
          },
          {
            lineNumber: 2,
            lineType: "STOCK_PRODUCT",
            itemCode: "NOTE",
            description: NOTE,
            quantity: 1,
            unit: "EA",
          },
        ],
      },
    },
  });
  ticketId = ticket.id;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `${tag}-I1`,
      year: 2099,
      yearTwoDigit: 99,
      sequenceNumber: Number(String(Date.now()).slice(-7)),
      deliveryTicketId: ticket.id,
      customerName: `${tag} Contractor ″Best″ Co`,
      projectName: PROJECT,
      subtotal: 1000,
      total: 1000,
      lineItems: {
        create: [
          {
            lineNumber: 1,
            lineType: "CUSTOM_STRUCTURE",
            itemCode: "MH-1″",
            description: DESCRIPTION,
            quantity: 1,
            unit: "EA",
            unitPrice: 1000,
            total: 1000,
          },
          {
            lineNumber: 2,
            lineType: "MISC",
            itemCode: "NOTE",
            description: NOTE,
            quantity: 1,
            unit: "EA",
            unitPrice: 0,
            total: 0,
          },
        ],
      },
    },
  });
  invoiceId = invoice.id;
});

afterAll(async () => {
  await prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: tag } } });
  await prisma.deliveryTicket.deleteMany({ where: { ticketNumber: { startsWith: tag } } });
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.$disconnect();
});

async function pageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("PDFs with special characters and over-long text", () => {
  it("builds the quote", async () => {
    const quote = await prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: QUOTE_PDF_INCLUDE,
    });
    const bytes = await generateQuotePdfBytes(quote);
    expect(await pageCount(bytes)).toBeGreaterThan(1);
  });

  it("builds the delivery ticket (fields over the template's 100-character cap)", async () => {
    const ticket = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: DELIVERY_TICKET_PDF_INCLUDE,
    });
    const bytes = await generateDeliveryTicketPdfBytes(
      ticket,
      await getDeliveryTicketPdfFillOptions(),
    );
    expect(await pageCount(bytes)).toBeGreaterThan(3);
  });

  it("builds the invoice", async () => {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: INVOICE_PDF_INCLUDE,
    });
    const bytes = await generateInvoicePdfBytes(invoice);
    expect(await pageCount(bytes)).toBeGreaterThan(1);
  });
});
