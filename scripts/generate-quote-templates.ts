/**
 * Rewrites the fixed drawing of assets/templates/quote-template.pdf (the
 * totals page) and assets/templates/quote-template-continuation.pdf.
 *
 * Run with: npx tsx scripts/generate-quote-templates.ts
 *
 * The two files came out of a design program; this script keeps their logo,
 * fonts and form fields and writes the page drawing again from the commands
 * below, so running it twice gives the same files. What it changes from the
 * original Rev1 drawing:
 *
 *  - The item table prints only its frame and gray header band. The column
 *    lines and column names are drawn with the line items
 *    (drawQuoteTableColumns in lib/quote-pdf-line-items.ts), because a quote
 *    that shows discounts has more columns than one that does not.
 *  - The second row of the totals box is "Tax Rate" where it was
 *    "Freight / Delivery" (no delivery fee is charged), so the box reads
 *    Subtotal, Tax Rate, Sales Tax, TOTAL like the invoice. The row's field
 *    TOT_Freight is renamed TOT_TaxRate.
 *
 * The table frame must match lib/quote-pdf-layout.ts. Field names must match
 * buildQuoteFormData in lib/quote-pdf-data.ts.
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRef,
  StandardFonts,
  type PDFFont,
  type PDFForm,
} from "pdf-lib";
import { PDF_SAVE_OPTIONS } from "../lib/pdf-save-options";
import {
  CONT_TABLE_BOTTOM_Y,
  MAIN_TABLE_BOTTOM_Y,
  TABLE_HEADER_BOTTOM_Y,
  TABLE_HEADER_TOP_Y,
  TABLE_LEFT_X,
  TABLE_RIGHT_X,
} from "../lib/quote-pdf-layout";

const TEMPLATE_DIR = path.join(process.cwd(), "assets", "templates");

/** Names the drawing below uses; they must exist in each template. */
const BOLD_FONT = "T1_0";
const REGULAR_FONT = "T1_1";
const LOGO_IMAGE = "Im0";

/** Bottom boxes of the totals page: Notes on the left, totals on the right. */
const BOTTOM_BOX = { top: 132.2, bottom: 60.2 };
const TOTALS_BOX = { left: 408, right: 564, dividerX: 495 };
/** Rows of the totals box, top to bottom, with the field each one fills. */
const TOTALS_ROWS = [
  { label: "Subtotal", field: "TOT_Subtotal" },
  { label: "Tax Rate", field: "TOT_TaxRate" },
  { label: "Sales Tax", field: "TOT_Sales" },
  { label: "TOTAL", field: "TOT_TOTAL" },
] as const;
const TOTALS_ROW_HEIGHT =
  (BOTTOM_BOX.top - BOTTOM_BOX.bottom) / TOTALS_ROWS.length;
/** Value fields: centered in their row with 3pt of the cell showing around. */
const TOTALS_FIELD = { left: 497, right: 561, height: TOTALS_ROW_HEIGHT - 6 };
/** Row labels end here, 5pt left of the divider. */
const TOTALS_LABEL_RIGHT_X = 490;

/** A number the way a PDF drawing writes it: no float noise, no exponent. */
function n(value: number): string {
  return String(Number(value.toFixed(4)));
}

function horizontalLine(x: number, y: number, length: number): string {
  return `q\n1 0 0 1 ${n(x)} ${n(y)} cm\n0 0 m\n${n(length)} 0 l\nS\nQ\n`;
}

function verticalLine(x: number, topY: number, length: number): string {
  return `q\n1 0 0 1 ${n(x)} ${n(topY)} cm\n0 0 m\n0 ${n(-length)} l\nS\nQ\n`;
}

/** Logo, title, the Quote To / Project box and the six-cell strip. */
function drawSharedTop(): string {
  return [
    `q\n348 0 0 85.8351 48.7 666.1649 cm\n/${LOGO_IMAGE} Do\nQ\n`,
    `BT\n0 0 0 rg\n/${BOLD_FONT} 20 Tf\n439 696 Td\n(Price Quote)Tj\nET\n`,
    // Black 0.8pt strokes for every box and rule on the page.
    "0 0 0 RG\n0.8 w \n",
    "48.7 583.1 516 78.6 re\nS\n",
    verticalLine(312.7, 661.7, 78.6),
    `BT\n/${BOLD_FONT} 9 Tf\n56.7 648 Td\n(Quote To:)Tj\n0 -19 TD\n(Company:)Tj\nT*\n(Phone:)Tj\nT*\n(Email:)Tj\n`,
    "264 55 Td\n(Project Name:)Tj\nT*\n(Job Number:)Tj\nT*\n(Project Address:)Tj\nET\n",
    "0.851 0.851 0.851 rg\n48.7 555.1 516 18 re\nf*\n48.7 535.1 516 38 re\nS\n",
    horizontalLine(48.7, 555.1, 516),
    ...[134.7, 220.7, 306.7, 392.7, 478.7].map((x) =>
      verticalLine(x, 573.1, 38),
    ),
    `BT\n0 0 0 rg\n/${BOLD_FONT} 8 Tf\n83.032 559.1 Td\n(Date)Tj\n75.108 0 Td\n(Valid Until)Tj\n93.556 0 Td\n(Terms)Tj\n`,
    "86.224 0 Td\n(F.O.B.)Tj\n73.992 0 Td\n(Salesperson)Tj\n100.228 0 Td\n(Page)Tj\nET\n",
  ].join("");
}

/** The item table's gray header band and frame, down to `bottomY`. */
function drawTableFrame(bottomY: number): string {
  const width = TABLE_RIGHT_X - TABLE_LEFT_X;
  const bandHeight = TABLE_HEADER_TOP_Y - TABLE_HEADER_BOTTOM_Y;
  return [
    `0.851 0.851 0.851 rg\n${n(TABLE_LEFT_X)} ${n(TABLE_HEADER_BOTTOM_Y)} ${n(width)} ${n(bandHeight)} re\nf*\n`,
    `${n(TABLE_LEFT_X)} ${n(bottomY)} ${n(width)} ${n(TABLE_HEADER_TOP_Y - bottomY)} re\nS\n`,
    horizontalLine(TABLE_LEFT_X, TABLE_HEADER_BOTTOM_Y, width),
  ].join("");
}

/** Bottom of totals row `index` (0 = Subtotal, the top row). */
function totalsRowBottom(index: number): number {
  return BOTTOM_BOX.top - (index + 1) * TOTALS_ROW_HEIGHT;
}

/**
 * Width of text as the page drawing shows it: letter by letter, with none of
 * the pair kerning pdf-lib adds when it measures a whole string.
 */
function plainTextWidth(font: PDFFont, text: string, size: number): number {
  return [...text].reduce(
    (width, letter) => width + font.widthOfTextAtSize(letter, size),
    0,
  );
}

/** Notes box, totals box, the signature line and its fine print. */
function drawTotalsPageBottom(boldFont: PDFFont): string {
  const boxHeight = BOTTOM_BOX.top - BOTTOM_BOX.bottom;
  const totalsWidth = TOTALS_BOX.right - TOTALS_BOX.left;
  const valueWidth = TOTALS_BOX.right - TOTALS_BOX.dividerX;
  const lastRow = TOTALS_ROWS.length - 1;
  // Labels sit a little under the middle of their row, right-aligned.
  const label = (index: number, size: number, lift: number) => {
    const text = TOTALS_ROWS[index].label;
    const x = TOTALS_LABEL_RIGHT_X - plainTextWidth(boldFont, text, size);
    return `${n(x)} ${n(totalsRowBottom(index) + lift)} Td\n(${text})Tj\n`;
  };
  return [
    `48 ${n(BOTTOM_BOX.bottom)} 352 ${n(boxHeight)} re\nS\n`,
    `BT\n0 0 0 rg\n/${BOLD_FONT} 8.5 Tf\n53 118 Td\n(Notes:)Tj\nET\n`,
    `${n(TOTALS_BOX.left)} ${n(BOTTOM_BOX.bottom)} ${n(totalsWidth)} ${n(boxHeight)} re\nS\n`,
    verticalLine(TOTALS_BOX.dividerX, BOTTOM_BOX.top, boxHeight),
    // Every row but TOTAL: its label, then the rule under it.
    ...TOTALS_ROWS.slice(0, lastRow).map(
      (_row, index) =>
        `BT\n${label(index, 8.5, 6.11)}ET\n` +
        horizontalLine(TOTALS_BOX.left, totalsRowBottom(index), totalsWidth),
    ),
    `0.851 0.851 0.851 rg\n${n(TOTALS_BOX.dividerX)} ${n(BOTTOM_BOX.bottom)} ${n(valueWidth)} ${n(TOTALS_ROW_HEIGHT)} re\nf*\n`,
    `${n(TOTALS_BOX.dividerX)} ${n(BOTTOM_BOX.bottom)} ${n(valueWidth)} ${n(TOTALS_ROW_HEIGHT)} re\nS\n`,
    `BT\n0 0 0 rg\n/${BOLD_FONT} 9 Tf\n${label(lastRow, 9, 5.94)}ET\n`,
    "BT\n48 32.4 Td\n(Accepted By:)Tj\nET\n",
    horizontalLine(114, 32.7, 186),
    "BT\n312 32.4 Td\n(Title:)Tj\nET\n",
    horizontalLine(338, 32.7, 92),
    "BT\n442 32.4 Td\n(Date:)Tj\nET\n",
    horizontalLine(470, 32.7, 94),
    `BT\n0.251 0.251 0.251 rg\n/${REGULAR_FONT} 7 Tf\n48 22 Td\n`,
    "(Signature constitutes a purchase order authorizing Long Island Precast to produce the items quoted above.)Tj\nET\n",
  ].join("");
}

function requireResources(
  doc: PDFDocument,
  file: string,
  fonts: string[],
): void {
  const resources = doc.getPage(0).node.Resources();
  const fontDict = resources?.lookupMaybe(PDFName.of("Font"), PDFDict);
  const xObjects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  for (const font of fonts) {
    if (!fontDict?.has(PDFName.of(font))) {
      throw new Error(`${file}: font /${font} is missing from the page.`);
    }
  }
  if (!xObjects?.has(PDFName.of(LOGO_IMAGE))) {
    throw new Error(`${file}: the logo /${LOGO_IMAGE} is missing from the page.`);
  }
}

/** Swaps the page's drawing for `drawing`, dropping the old one. */
function replacePageDrawing(doc: PDFDocument, drawing: string): void {
  const page = doc.getPage(0);
  const contentsKey = PDFName.of("Contents");
  const previous = page.node.get(contentsKey);
  const previousRefs =
    previous instanceof PDFRef
      ? [previous]
      : previous instanceof PDFArray
        ? previous.asArray().filter((entry) => entry instanceof PDFRef)
        : [];
  for (const ref of previousRefs) {
    doc.context.delete(ref as PDFRef);
  }
  page.node.set(
    contentsKey,
    doc.context.register(doc.context.flateStream(drawing)),
  );
}

function placeTotalsField(form: PDFForm, name: string, rowIndex: number): void {
  const widget = form.getTextField(name).acroField.getWidgets()[0];
  if (!widget) {
    throw new Error(`Field ${name} has no place on the page.`);
  }
  widget.setRectangle({
    x: TOTALS_FIELD.left,
    y:
      totalsRowBottom(rowIndex) +
      (TOTALS_ROW_HEIGHT - TOTALS_FIELD.height) / 2,
    width: TOTALS_FIELD.right - TOTALS_FIELD.left,
    height: TOTALS_FIELD.height,
  });
}

async function writeTemplate(
  file: string,
  build: (doc: PDFDocument) => void,
): Promise<void> {
  const filePath = path.join(TEMPLATE_DIR, file);
  const doc = await PDFDocument.load(await readFile(filePath));
  if (doc.getPageCount() !== 1) {
    throw new Error(`${file}: expected one page, found ${doc.getPageCount()}.`);
  }
  build(doc);
  await writeFile(filePath, await doc.save(PDF_SAVE_OPTIONS));
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

async function main() {
  // Only to measure the labels: the templates' own bold font is Helvetica
  // Bold under another name, and nothing is embedded in them here.
  const measuring = await PDFDocument.create();
  const boldFont = await measuring.embedFont(StandardFonts.HelveticaBold);

  await writeTemplate("quote-template.pdf", (doc) => {
    requireResources(doc, "quote-template.pdf", [BOLD_FONT, REGULAR_FONT]);
    replacePageDrawing(
      doc,
      drawSharedTop() +
        drawTableFrame(MAIN_TABLE_BOTTOM_Y) +
        drawTotalsPageBottom(boldFont),
    );
    const form = doc.getForm();
    // The original template's second row was Freight / Delivery.
    const freight = form.getFieldMaybe("TOT_Freight");
    if (freight) {
      freight.acroField.setPartialName("TOT_TaxRate");
    }
    TOTALS_ROWS.forEach((row, index) => {
      placeTotalsField(form, row.field, index);
    });
  });

  await writeTemplate("quote-template-continuation.pdf", (doc) => {
    requireResources(doc, "quote-template-continuation.pdf", [BOLD_FONT]);
    replacePageDrawing(
      doc,
      drawSharedTop() + drawTableFrame(CONT_TABLE_BOTTOM_Y),
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
