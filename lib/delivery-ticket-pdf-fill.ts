import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFTextField, rgb, StandardFonts } from "pdf-lib";
import {
  buildDeliveryTicketFormData,
  computeTotalPieces,
  getDeliveryTicketCopyTitles,
  mapLineItemsForPdf,
  type DbDeliveryTicketForPdf,
  type DeliveryTicketContentPage,
  type DeliveryTicketPdfFillOptions,
} from "@/lib/delivery-ticket-pdf-data";
import {
  drawLineItemsOnPage,
  paginateLineItems,
  type LineItemPageSlice,
} from "@/lib/delivery-ticket-pdf-line-items";
import {
  REVISION_LABEL_FONT_SIZE,
  REVISION_LABEL_X,
  REVISION_LABEL_Y,
  TEXT_COLOR,
} from "@/lib/delivery-ticket-pdf-layout";

const DEFAULT_COPY_COUNT = 3;

export function getDeliveryTicketTemplatePath(): string {
  return path.join(process.cwd(), "assets", "templates", "delivery-ticket-template.pdf");
}

export async function readDeliveryTicketTemplateBytes(): Promise<Uint8Array> {
  const templatePath = getDeliveryTicketTemplatePath();
  const buffer = await readFile(templatePath);
  return new Uint8Array(buffer);
}

export async function getDeliveryTicketPdfFillOptions(): Promise<DeliveryTicketPdfFillOptions> {
  const { getAppSettings } = await import("@/lib/app-settings");
  const settings = await getAppSettings();
  const titles = getDeliveryTicketCopyTitles(settings);
  return {
    copyTitles: [titles.copy1Title, titles.copy2Title, titles.copy3Title],
  };
}

export async function listDeliveryTicketFormFields(): Promise<string[]> {
  const bytes = await readDeliveryTicketTemplateBytes();
  const doc = await PDFDocument.load(bytes);
  return doc.getForm().getFields().map((field) => field.getName());
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

async function buildContentPageBytes(
  templateBytes: Uint8Array,
  formData: Record<string, string>,
  slice: LineItemPageSlice,
  totalPieces: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  fillAcroFormFields(doc, formData);

  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const revisionLabel = formData["Quote Number"]?.trim();
  if (revisionLabel) {
    page.drawText(revisionLabel, {
      x: REVISION_LABEL_X,
      y: REVISION_LABEL_Y,
      size: REVISION_LABEL_FONT_SIZE,
      font,
      color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
    });
  }

  drawLineItemsOnPage(page, font, slice, totalPieces);

  return doc.save();
}

async function buildCopyPdfBytes(
  ticket: DbDeliveryTicketForPdf,
  copyIndex: number,
  options: DeliveryTicketPdfFillOptions,
  templateBytes: Uint8Array,
): Promise<Uint8Array> {
  const lineItems = mapLineItemsForPdf(ticket.lineItems);
  const totalPieces = computeTotalPieces(ticket);

  const measureDoc = await PDFDocument.load(templateBytes);
  const measureFont = await measureDoc.embedFont(StandardFonts.Helvetica);
  const slices = paginateLineItems(lineItems, measureFont);
  const contentPageCount = slices.length;

  const merged = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < slices.length; pageIndex += 1) {
    const contentPage: DeliveryTicketContentPage = {
      number: pageIndex + 1,
      count: contentPageCount,
    };
    const formData = buildDeliveryTicketFormData(
      ticket,
      copyIndex,
      options,
      contentPage,
    );
    const pageBytes = await buildContentPageBytes(
      templateBytes,
      formData,
      slices[pageIndex]!,
      totalPieces,
    );
    const pageDoc = await PDFDocument.load(pageBytes);
    const [copiedPage] = await merged.copyPages(pageDoc, [0]);
    merged.addPage(copiedPage);
  }

  return merged.save();
}

export async function generateDeliveryTicketCopyPdfBytes(
  ticket: DbDeliveryTicketForPdf,
  copyNumber: number,
  options?: DeliveryTicketPdfFillOptions,
): Promise<Uint8Array> {
  const fillOptions = options ?? (await getDeliveryTicketPdfFillOptions());
  const templateBytes = await readDeliveryTicketTemplateBytes();
  return buildCopyPdfBytes(ticket, copyNumber, fillOptions, templateBytes);
}

export async function generateDeliveryTicketPdfBytes(
  ticket: DbDeliveryTicketForPdf,
  options?: DeliveryTicketPdfFillOptions,
  copyCount: number = DEFAULT_COPY_COUNT,
): Promise<Uint8Array> {
  const fillOptions = options ?? (await getDeliveryTicketPdfFillOptions());
  const templateBytes = await readDeliveryTicketTemplateBytes();
  const merged = await PDFDocument.create();

  for (let copyNumber = 1; copyNumber <= copyCount; copyNumber += 1) {
    const copyBytes = await buildCopyPdfBytes(
      ticket,
      copyNumber,
      fillOptions,
      templateBytes,
    );
    const copyDoc = await PDFDocument.load(copyBytes);
    const pageIndices = copyDoc.getPageIndices();
    const copiedPages = await merged.copyPages(copyDoc, pageIndices);
    for (const copiedPage of copiedPages) {
      merged.addPage(copiedPage);
    }
  }

  return merged.save();
}
