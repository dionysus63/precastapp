import { readFile } from "fs/promises";
import path from "path";
import {
  PDFDocument,
  PDFTextField,
  StandardFonts,
  TextAlignment,
  type PDFFont,
  type PDFForm,
} from "pdf-lib";
import { removeFlattenLeftovers } from "@/lib/pdf-flatten-cleanup";
import { PDF_SAVE_OPTIONS } from "@/lib/pdf-save-options";
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

// Template's project-address fields: Arial 9pt, single line. Appearance
// rendering pads the text inside the widget rect, so usable width is a bit
// under the rect width.
const ADDRESS_FIELD_NAMES = ["Project Address 1", "Project Address 2"] as const;
const ADDRESS_FONT_SIZE = 9;
const MIN_ADDRESS_FONT_SIZE = 6;
const ADDRESS_FIELD_PADDING = 4;

/**
 * A long single-line address wraps onto the template's second address line,
 * and both lines shrink together (down to a floor) when one still overflows —
 * matching what the user sees instead of silently clipping.
 */
function fitProjectAddressFields(form: PDFForm, font: PDFFont): void {
  let fields: PDFTextField[];
  try {
    fields = ADDRESS_FIELD_NAMES.map((name) => form.getTextField(name));
  } catch {
    // Continuation template has no address fields.
    return;
  }

  const usableWidth =
    Math.min(
      ...fields.map(
        (field) => field.acroField.getWidgets()[0]?.getRectangle().width ?? 0,
      ),
    ) - ADDRESS_FIELD_PADDING;
  if (usableWidth <= 0) {
    return;
  }

  const fits = (text: string, size: number) =>
    font.widthOfTextAtSize(text, size) <= usableWidth;

  const applySize = (size: number) => {
    if (size !== ADDRESS_FONT_SIZE) {
      for (const field of fields) {
        field.setFontSize(size);
      }
    }
  };

  /** Greedy word split: as many words as fit on line 1 at this size. */
  const wrapAtSize = (words: string[], size: number) => {
    let split = 1;
    for (let count = 2; count <= words.length; count += 1) {
      if (!fits(words.slice(0, count).join(" "), size)) {
        break;
      }
      split = count;
    }
    return {
      first: words.slice(0, split).join(" "),
      rest: words.slice(split).join(" "),
    };
  };

  const [line1, line2] = fields.map((field) => field.getText() ?? "");

  if (line1 && !line2 && !fits(line1, ADDRESS_FONT_SIZE)) {
    // Single overflowing line: find the largest size whose two-line wrap
    // fits, wrapping at that size (wrapping first and shrinking after can
    // still clip line 2).
    const words = line1.split(/\s+/).filter(Boolean);
    let size = ADDRESS_FONT_SIZE;
    let wrapped = wrapAtSize(words, size);
    while (
      size > MIN_ADDRESS_FONT_SIZE &&
      (!fits(wrapped.first, size) || (wrapped.rest && !fits(wrapped.rest, size)))
    ) {
      size -= 0.5;
      wrapped = wrapAtSize(words, size);
    }
    fields[0].setText(wrapped.first);
    fields[1].setText(wrapped.rest);
    applySize(size);
    return;
  }

  // Already one/two explicit lines: shrink together until the longest fits.
  let size = ADDRESS_FONT_SIZE;
  while (
    size > MIN_ADDRESS_FONT_SIZE &&
    ((line1 && !fits(line1, size)) || (line2 && !fits(line2, size)))
  ) {
    size -= 0.5;
  }

  // Degenerate case: one of the preferred lines (street / city-state-zip)
  // still clips at the floor — rebalance the whole address by width instead.
  if (
    line2 &&
    ((line1 && !fits(line1, size)) || !fits(line2, size))
  ) {
    const words = `${line1}, ${line2}`.split(/\s+/).filter(Boolean);
    const wrapped = wrapAtSize(words, size);
    fields[0].setText(wrapped.first);
    fields[1].setText(wrapped.rest);
  }

  applySize(size);
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

    // Template fields may carry a maxLength; the form is flattened, so the
    // cap only serves to crash on long values — drop it instead.
    const maxLength = field.getMaxLength();
    if (maxLength !== undefined && value.length > maxLength) {
      field.setMaxLength(undefined);
    }

    // The meta strip (Date / Valid Until / …) is centered, but the
    // continuation template shipped with M_Date left-aligned; normalize
    // here instead of re-authoring the binary template.
    if (name.startsWith("M_")) {
      field.setAlignment(TextAlignment.Center);
    }

    field.setText(value);
  }

  fitProjectAddressFields(form, font);
  form.flatten();
  removeFlattenLeftovers(doc);
}

async function buildQuotePageBytes(
  templateBytes: Uint8Array,
  formData: Record<string, string>,
  slice: QuoteLineItemPageSlice,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  fillAcroFormFields(doc, formData, font);

  const page = doc.getPage(0);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  drawQuoteLineItemsOnPage(page, font, boldFont, slice);

  return doc.save(PDF_SAVE_OPTIONS);
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

  return merged.save(PDF_SAVE_OPTIONS);
}
