import { access, readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  PDFDocument,
  PDFTextField,
  StandardFonts,
  rgb,
  degrees,
} from "pdf-lib";
import { getAppSettings } from "@/lib/app-settings";
import { dedupeSharedPdfObjects } from "@/lib/pdf-dedupe";
import { prisma } from "@/lib/prisma";
import {
  buildInvoiceFormData,
  formatCustomerAddress,
  mapInvoiceLineItemsForPdf,
  type DbInvoiceForPdf,
  type InvoiceContentPage,
} from "@/lib/invoice-pdf-data";
import {
  drawInvoiceLineItemsOnPage,
  paginateInvoiceLineItems,
  type InvoiceLineItemPageSlice,
} from "@/lib/invoice-pdf-line-items";

export function getInvoiceTemplatePath(): string {
  return path.join(process.cwd(), "assets", "templates", "invoice-template.pdf");
}

export function getInvoiceContinuationTemplatePath(): string {
  return path.join(
    process.cwd(),
    "assets",
    "templates",
    "invoice-template-continuation.pdf",
  );
}

async function templateExists(): Promise<boolean> {
  try {
    await access(getInvoiceTemplatePath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a minimal AcroForm invoice template when none is present yet.
 * Replace assets/templates/invoice-template.pdf with your branded layout
 * using the field names documented in lib/invoice-pdf-data.ts.
 */
export async function ensureInvoiceTemplateExists(): Promise<void> {
  if (await templateExists()) {
    return;
  }

  const dir = path.dirname(getInvoiceTemplatePath());
  await mkdir(dir, { recursive: true });

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const fields: Array<{ name: string; x: number; y: number; width: number }> = [
    { name: "Company Name", x: 48, y: 740, width: 250 },
    { name: "Company Address", x: 48, y: 724, width: 250 },
    { name: "Company Phone", x: 48, y: 708, width: 250 },
    { name: "Company Email", x: 48, y: 692, width: 250 },
    { name: "Invoice Number", x: 400, y: 740, width: 160 },
    { name: "Invoice Date", x: 400, y: 724, width: 160 },
    { name: "Due Date", x: 400, y: 708, width: 160 },
    { name: "Page", x: 400, y: 692, width: 160 },
    { name: "Bill To Name", x: 48, y: 650, width: 250 },
    { name: "Bill To Address 1", x: 48, y: 634, width: 250 },
    { name: "Bill To Address 2", x: 48, y: 618, width: 250 },
    { name: "Project Name", x: 320, y: 650, width: 240 },
    { name: "Job Number", x: 320, y: 634, width: 240 },
    { name: "Ticket Number", x: 320, y: 618, width: 240 },
    { name: "Delivery Address", x: 320, y: 602, width: 240 },
    { name: "Subtotal", x: 420, y: 118, width: 140 },
    { name: "Delivery", x: 420, y: 104, width: 140 },
    { name: "Tax Rate", x: 420, y: 76, width: 140 },
    { name: "Sales Tax", x: 420, y: 62, width: 140 },
    { name: "Total", x: 420, y: 48, width: 140 },
  ];

  for (const field of fields) {
    const textField = form.createTextField(field.name);
    textField.addToPage(page, {
      x: field.x,
      y: field.y,
      width: field.width,
      height: 14,
      borderWidth: 0,
      font,
    });
  }

  page.drawText("INVOICE", {
    x: 48,
    y: 760,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });

  const bytes = await doc.save();
  await writeFile(getInvoiceTemplatePath(), bytes);
}

export async function readInvoiceTemplateBytes(): Promise<Uint8Array> {
  await ensureInvoiceTemplateExists();
  const buffer = await readFile(getInvoiceTemplatePath());
  return new Uint8Array(buffer);
}

/**
 * Continuation template for non-final pages (no totals/remittance boxes, item
 * table runs to the page bottom). Falls back to the main template when the
 * continuation file is missing.
 */
export async function readInvoiceContinuationTemplateBytes(): Promise<Uint8Array> {
  try {
    const buffer = await readFile(getInvoiceContinuationTemplatePath());
    return new Uint8Array(buffer);
  } catch {
    return readInvoiceTemplateBytes();
  }
}

function fillAcroFormFields(
  doc: PDFDocument,
  data: Record<string, string>,
): void {
  const form = doc.getForm();

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) {
      continue;
    }

    const name = field.getName();
    const value = data[name];
    if (value == null || value === "") {
      continue;
    }

    field.setText(value);
  }

  form.flatten();
}

function drawDraftWatermark(page: import("pdf-lib").PDFPage, font: import("pdf-lib").PDFFont) {
  const { width, height } = page.getSize();
  page.drawText("DRAFT", {
    x: width * 0.22,
    y: height * 0.45,
    size: 72,
    font,
    color: rgb(0.75, 0.75, 0.75),
    rotate: degrees(-35),
    opacity: 0.35,
  });
}

async function buildInvoicePageBytes(
  templateBytes: Uint8Array,
  formData: Record<string, string>,
  slice: InvoiceLineItemPageSlice,
  showDraftWatermark: boolean,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  fillAcroFormFields(doc, formData);

  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  drawInvoiceLineItemsOnPage(page, font, boldFont, slice);

  if (showDraftWatermark) {
    drawDraftWatermark(page, boldFont);
  }

  return doc.save();
}

export async function generateInvoicePdfBytes(
  invoice: DbInvoiceForPdf,
): Promise<Uint8Array> {
  const settings = await getAppSettings();
  const [templateBytes, contTemplateBytes] = await Promise.all([
    readInvoiceTemplateBytes(),
    readInvoiceContinuationTemplateBytes(),
  ]);
  // Some tickets carry only the customer NAME (no customerId link); the
  // invoice then has no customer relation even though the customer record —
  // with the billing address — exists. Fall back to an exact name match so
  // Bill To still fills in completely.
  let billToCustomer: {
    id: string;
    address: string | null;
    town: string | null;
    state: string | null;
    zip: string | null;
  } | null = invoice.customer
    ? { id: invoice.customerId!, ...invoice.customer }
    : null;
  if (!billToCustomer && invoice.customerName?.trim()) {
    billToCustomer = await prisma.customer.findFirst({
      where: { name: { equals: invoice.customerName.trim(), mode: "insensitive" } },
      select: { id: true, address: true, town: true, state: true, zip: true },
    });
  }
  const lineItems = mapInvoiceLineItemsForPdf(invoice.lineItems);

  const measureDoc = await PDFDocument.load(templateBytes);
  const measureFont = await measureDoc.embedFont(StandardFonts.Helvetica);
  const slices = paginateInvoiceLineItems(lineItems, measureFont);
  const showDraftWatermark = invoice.status === "DRAFT";

  const merged = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < slices.length; pageIndex += 1) {
    const slice = slices[pageIndex]!;
    const contentPage: InvoiceContentPage = {
      number: pageIndex + 1,
      count: slices.length,
    };
    const formData = buildInvoiceFormData(
      invoice,
      {
        companyName: settings.companyName,
        companyAddress: settings.companyAddress,
        companyPhone: settings.companyPhone,
        companyEmail: settings.companyEmail,
      },
      contentPage,
      pageIndex === slices.length - 1,
      { customerAddressLines: formatCustomerAddress(billToCustomer) },
    );

    const pageBytes = await buildInvoicePageBytes(
      slice.isLastPage ? templateBytes : contTemplateBytes,
      formData,
      slice,
      showDraftWatermark,
    );
    const pageDoc = await PDFDocument.load(pageBytes);
    const [copied] = await merged.copyPages(pageDoc, [0]);
    merged.addPage(copied);
  }

  return merged.save();
}

export async function generateDraftInvoicesBatchPdfBytes(
  invoices: DbInvoiceForPdf[],
  coverPdfBytes?: Uint8Array,
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  if (coverPdfBytes) {
    const coverDoc = await PDFDocument.load(coverPdfBytes);
    const coverPages = await merged.copyPages(
      coverDoc,
      coverDoc.getPageIndices(),
    );
    for (const page of coverPages) {
      merged.addPage(page);
    }
  }

  for (const invoice of invoices) {
    const bytes = await generateInvoicePdfBytes(invoice);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }

  // Every invoice page carries a copy of the template's header artwork and
  // fonts; collapse the shared resources like the drill-sheet packet does.
  dedupeSharedPdfObjects(merged);
  return merged.save();
}
