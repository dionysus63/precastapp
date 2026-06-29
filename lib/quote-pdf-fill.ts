import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFTextField, StandardFonts } from "pdf-lib";
import {
  buildQuoteFormData,
  mapQuoteLineItemsForPdf,
  type DbQuoteForPdf,
  type QuoteContentPage,
} from "@/lib/quote-pdf-data";
import {
  drawQuoteLineItemsOnPage,
  paginateQuoteLineItems,
  type QuoteLineItemPageSlice,
} from "@/lib/quote-pdf-line-items";

export function getQuoteTemplatePath(): string {
  return path.join(process.cwd(), "assets", "templates", "quote-template.pdf");
}

export function getQuoteContinuationTemplatePath(): string {
  return path.join(
    process.cwd(),
    "assets",
    "templates",
    "quote-template-continuation.pdf",
  );
}

export async function readQuoteTemplateBytes(): Promise<Uint8Array> {
  const buffer = await readFile(getQuoteTemplatePath());
  return new Uint8Array(buffer);
}

export async function readQuoteContinuationTemplateBytes(): Promise<Uint8Array> {
  const buffer = await readFile(getQuoteContinuationTemplatePath());
  return new Uint8Array(buffer);
}

export async function listQuoteFormFields(): Promise<{
  main: string[];
  continuation: string[];
}> {
  const [mainBytes, contBytes] = await Promise.all([
    readQuoteTemplateBytes(),
    readQuoteContinuationTemplateBytes(),
  ]);
  const mainDoc = await PDFDocument.load(mainBytes);
  const contDoc = await PDFDocument.load(contBytes);
  return {
    main: mainDoc.getForm().getFields().map((field) => field.getName()),
    continuation: contDoc.getForm().getFields().map((field) => field.getName()),
  };
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

async function buildQuotePageBytes(
  templateBytes: Uint8Array,
  formData: Record<string, string>,
  slice: QuoteLineItemPageSlice,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  fillAcroFormFields(doc, formData);

  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  drawQuoteLineItemsOnPage(page, font, boldFont, slice);

  return doc.save();
}

export async function generateQuotePdfBytes(
  quote: DbQuoteForPdf,
): Promise<Uint8Array> {
  const [mainTemplateBytes, contTemplateBytes] = await Promise.all([
    readQuoteTemplateBytes(),
    readQuoteContinuationTemplateBytes(),
  ]);

  const lineItems = mapQuoteLineItemsForPdf(quote.lineItems);

  const measureDoc = await PDFDocument.load(mainTemplateBytes);
  const measureFont = await measureDoc.embedFont(StandardFonts.Helvetica);
  const slices = paginateQuoteLineItems(lineItems, measureFont);
  const pageCount = slices.length;

  const merged = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < slices.length; pageIndex += 1) {
    const slice = slices[pageIndex]!;
    const contentPage: QuoteContentPage = {
      number: pageIndex + 1,
      count: pageCount,
    };
    const formData = buildQuoteFormData(quote, contentPage, slice.isLastPage);
    const templateBytes = slice.isLastPage
      ? mainTemplateBytes
      : contTemplateBytes;

    const pageBytes = await buildQuotePageBytes(templateBytes, formData, slice);
    const pageDoc = await PDFDocument.load(pageBytes);
    const [copiedPage] = await merged.copyPages(pageDoc, [0]);
    merged.addPage(copiedPage);
  }

  return merged.save();
}
