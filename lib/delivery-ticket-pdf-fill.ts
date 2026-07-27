import { readFile } from "fs/promises";
import path from "path";
import {
  PDFDocument,
  PDFTextField,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFForm,
  type PDFPage,
} from "pdf-lib";
import { PDF_SAVE_OPTIONS } from "@/lib/pdf-save-options";
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
  applyPickupTicketArtwork,
  movePickupFieldWidgets,
  PICKUP_TABLE_LAYOUT,
  toPickupCopyTitles,
} from "@/lib/delivery-ticket-pdf-pickup";
import { DEFAULT_TABLE_LAYOUT } from "@/lib/delivery-ticket-pdf-layout";

const DEFAULT_COPY_COUNT = 3;
const TERMS_FONT_SIZE = 9;
const MIN_TERMS_FONT_SIZE = 4.5;
const TERMS_FIELD_PADDING = 4;
const DRIVER_LABEL_X = 165.79;
const DRIVER_LABEL_Y = 561.9;
const DRIVER_LABEL_FONT_SIZE = 8;
const DRIVER_LABEL_COVER_X = 153.5;
const DRIVER_LABEL_COVER_Y = 559.75;
const DRIVER_LABEL_COVER_WIDTH = 49;
const DRIVER_LABEL_COVER_HEIGHT = 9.75;
// Header-band fill sampled from the template ("0.851 0.851 0.851 rg")
const HEADER_BAND_GREY = rgb(0.851, 0.851, 0.851);

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

function fitTermsField(form: PDFForm, font: PDFFont): void {
  let field: PDFTextField;
  try {
    field = form.getTextField("Terms");
  } catch {
    return;
  }

  const value = field.getText()?.trim();
  const width = field.acroField.getWidgets()[0]?.getRectangle().width ?? 0;
  const usableWidth = width - TERMS_FIELD_PADDING;
  if (!value || usableWidth <= 0) {
    return;
  }

  let size = TERMS_FONT_SIZE;
  while (
    size > MIN_TERMS_FONT_SIZE &&
    font.widthOfTextAtSize(value, size) > usableWidth
  ) {
    size -= 0.5;
  }
  if (size !== TERMS_FONT_SIZE) {
    field.setFontSize(size);
  }
}

function fillAcroFormFields(
  doc: PDFDocument,
  data: Record<string, string>,
  font: PDFFont,
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

  fitTermsField(form, font);
  form.flatten();
}

/**
 * The source template has a static "Driver/Truck" caption that is not part of
 * the form field. Cover that artwork after flattening and draw the ticket-only
 * "Driver" caption centered in the same header cell. The cover must match the
 * grey header band and the caption must match the template's Helvetica-Bold
 * 8pt captions, or the patch is visible.
 */
function redrawDriverLabel(page: PDFPage, boldFont: PDFFont): void {
  page.drawRectangle({
    x: DRIVER_LABEL_COVER_X,
    y: DRIVER_LABEL_COVER_Y,
    width: DRIVER_LABEL_COVER_WIDTH,
    height: DRIVER_LABEL_COVER_HEIGHT,
    color: HEADER_BAND_GREY,
  });
  page.drawText("Driver", {
    x: DRIVER_LABEL_X,
    y: DRIVER_LABEL_Y,
    size: DRIVER_LABEL_FONT_SIZE,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
}

async function buildContentPageBytes(
  templateBytes: Uint8Array,
  formData: Record<string, string>,
  slice: LineItemPageSlice,
  totalPieces: string,
  isPickup: boolean,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.getPage(0);

  if (isPickup) {
    // Artwork first, then fill: flatten paints values after (above) the
    // pickup wipes, so relocated field values stay visible.
    movePickupFieldWidgets(doc.getForm());
    applyPickupTicketArtwork(page, boldFont, font);
    fillAcroFormFields(doc, formData, font);
    drawLineItemsOnPage(page, font, slice, totalPieces, PICKUP_TABLE_LAYOUT);
    return doc.save(PDF_SAVE_OPTIONS);
  }

  fillAcroFormFields(doc, formData, font);
  redrawDriverLabel(page, boldFont);
  drawLineItemsOnPage(page, font, slice, totalPieces);

  return doc.save(PDF_SAVE_OPTIONS);
}

function isPickupTicket(ticket: DbDeliveryTicketForPdf): boolean {
  return ticket.fulfillmentMethod === "PICKUP";
}

async function buildCopyPdfBytes(
  ticket: DbDeliveryTicketForPdf,
  copyIndex: number,
  options: DeliveryTicketPdfFillOptions,
  templateBytes: Uint8Array,
): Promise<Uint8Array> {
  const isPickup = isPickupTicket(ticket);
  const fillOptions: DeliveryTicketPdfFillOptions = isPickup
    ? { ...options, copyTitles: toPickupCopyTitles(options.copyTitles) }
    : options;
  const layout = isPickup ? PICKUP_TABLE_LAYOUT : DEFAULT_TABLE_LAYOUT;

  const lineItems = mapLineItemsForPdf(ticket.lineItems);
  const totalPieces = computeTotalPieces(ticket);

  const measureDoc = await PDFDocument.load(templateBytes);
  const measureFont = await measureDoc.embedFont(StandardFonts.Helvetica);
  const slices = paginateLineItems(lineItems, measureFont, layout);
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
      fillOptions,
      contentPage,
    );
    const pageBytes = await buildContentPageBytes(
      templateBytes,
      formData,
      slices[pageIndex]!,
      totalPieces,
      isPickup,
    );
    const pageDoc = await PDFDocument.load(pageBytes);
    const [copiedPage] = await merged.copyPages(pageDoc, [0]);
    merged.addPage(copiedPage);
  }

  return merged.save(PDF_SAVE_OPTIONS);
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

  return merged.save(PDF_SAVE_OPTIONS);
}
