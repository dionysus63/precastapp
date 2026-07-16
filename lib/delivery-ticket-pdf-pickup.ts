/**
 * Pickup-ticket rework of the Rev8 delivery ticket template.
 *
 * Pickups reuse the same template PDF; this module redraws the static artwork
 * (title, info box, header band, items grid, signature block, footer) into the
 * pickup layout approved 2026-07-16 and relocates the AcroForm field widgets
 * so real values land in the moved cells. Field values are painted by
 * form.flatten() AFTER this artwork, so the white wipes never cover data —
 * call applyPickupTicketArtwork/movePickupFieldWidgets BEFORE filling.
 *
 * Layout deltas vs the delivery ticket:
 * - Info box hugs the letterhead: Site Contact + Phone dropped, address moves
 *   under the customer name; header band / notes / items header move up 35.5.
 * - Band cells 2 and 3 (Driver, Trailer) are blank for now.
 * - Items table bottom sits at y=151 (net +~46pt of rows); RECEIVED BY block
 *   moves down for signature room; Time In/Out removed; NPCA logo flush
 *   right with the return policy re-wrapped beside it.
 */
import {
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFForm,
  type PDFPage,
} from "pdf-lib";
import { wrapText } from "@/lib/delivery-ticket-pdf-line-items";
import {
  COL_QTY_X,
  FONT_SIZE,
  LINE_HEIGHT,
  ROW_PADDING,
  type DeliveryTicketTableLayout,
} from "@/lib/delivery-ticket-pdf-layout";

const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const HEADER_BAND_GREY = rgb(0.851, 0.851, 0.851);

const LEFT = 35.5;
const RIGHT = 575.5;
const WIDTH = 540;

/** Header band / value row column boundaries (template verticals). */
const BAND_COLS = [LEFT, 134.1, 220.5, 316.8, 409.1, 495.5, RIGHT];
const BAND_CAPTIONS = ["Pickup Date", "", "", "Terms", "Purchase Order #", "Page"];

const DESC_COL_X = 137.5;

const INFO_BOX_TOP = 657.4;
const INFO_BOX_BOTTOM = 606;
/** Everything from the band down to the items header moves up by this much. */
export const PICKUP_SECTION_RISE = 35.5;

const BAND_BOX_TOP = INFO_BOX_BOTTOM;
const BAND_BOX_HEIGHT = 38.1;
const BAND_FILL_HEIGHT = 12.1;

const NOTES_BOX_BOTTOM = 544.7;
const NOTES_BOX_HEIGHT = 15.3;

const TABLE_TOP = 537.5;
const TABLE_HEADER_HEIGHT = 18;
const TABLE_BOTTOM = 151;

const NPCA_SCALE_X = 66;
const NPCA_SCALE_Y = 45.5424347;
const NPCA_Y = 30.4575653;
/** XObject name of the NPCA logo in the template's page resources. */
const NPCA_XOBJECT_NAME = "Im1";

const FINE_PRINT =
  "All RETURNED GOODS are subject to INSPECTION by Long Island Precast and " +
  "must be UNDAMAGED by the customer for credit to be granted. Long Island " +
  "Precast accepts the return of STOCK ITEMS ONLY. CUSTOM made product may " +
  "NOT be returned. Returned goods are subject to applicable RESTOCKING " +
  "FEES. Credit will not be issued for damage or shortage unless noted on " +
  "this pickup ticket by the customer.";

export const PICKUP_TABLE_LAYOUT: DeliveryTicketTableLayout = {
  tableTopY: TABLE_TOP - TABLE_HEADER_HEIGHT - 4,
  tableBottomY: TABLE_BOTTOM,
  rowPadding: ROW_PADDING,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
};

/** Replace the third (driver) copy title for pickups. */
export function toPickupCopyTitles(
  copyTitles: [string, string, string],
): [string, string, string] {
  return copyTitles.map((title) =>
    /driver/i.test(title) ? "Yard Copy" : title,
  ) as [string, string, string];
}

function centered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x0: number,
  x1: number,
  y: number,
  size: number,
) {
  if (!text) return;
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x0 + (x1 - x0 - w) / 2, y, size, font, color: BLACK });
}

function hline(page: PDFPage, x0: number, x1: number, y: number, thickness = 1) {
  page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness, color: BLACK });
}

function vline(page: PDFPage, x: number, y0: number, y1: number, thickness = 1) {
  page.drawLine({ start: { x, y: y0 }, end: { x, y: y1 }, thickness, color: BLACK });
}

function moveWidget(
  form: PDFForm,
  fieldName: string,
  next: { x?: number; y?: number; dy?: number },
): void {
  let widgets;
  try {
    widgets = form.getTextField(fieldName).acroField.getWidgets();
  } catch {
    return;
  }
  for (const widget of widgets) {
    const rect = widget.getRectangle();
    widget.setRectangle({
      x: next.x ?? rect.x,
      y: next.y ?? rect.y + (next.dy ?? 0),
      width: rect.width,
      height: rect.height,
    });
  }
}

/**
 * Relocate form field widgets into the pickup layout. Must run before the
 * form is filled/flattened.
 */
export function movePickupFieldWidgets(form: PDFForm): void {
  // Pickups don't use these fields, and flatten() would still stamp each
  // widget's white background over the reworked artwork — drop them entirely.
  for (const name of ["Site Contact", "Site Contact Phone", "Driver/Truck", "Trailer"]) {
    try {
      form.removeField(form.getTextField(name));
    } catch {
      // Field missing from the template — nothing to remove.
    }
  }

  // Band value row + notes ride up with the artwork.
  for (const name of ["Ship Date", "Terms", "Purchase Order Number", "Page Number", "Notes"]) {
    moveWidget(form, name, { dy: PICKUP_SECTION_RISE });
  }

  // Address lines move from the right column to under the customer name.
  let nameRect: { x: number; y: number } | null = null;
  try {
    nameRect = form
      .getTextField("Contractor Name")
      .acroField.getWidgets()[0]!
      .getRectangle();
  } catch {
    return;
  }
  moveWidget(form, "Delivery Address 1", { x: nameRect.x, y: nameRect.y - 13 });
  moveWidget(form, "Delivery Address 2", { x: nameRect.x, y: nameRect.y - 25.5 });
}

/**
 * Redraw the template's static artwork into the pickup layout. Must run
 * before the form is filled/flattened so field values paint on top.
 */
export function applyPickupTicketArtwork(
  page: PDFPage,
  boldFont: PDFFont,
  regularFont: PDFFont,
): void {
  // ---- Title -------------------------------------------------------------
  const oldTitleWidth = boldFont.widthOfTextAtSize("Delivery Ticket", 20);
  const newTitleWidth = boldFont.widthOfTextAtSize("Pickup Ticket", 20);
  page.drawRectangle({ x: 384, y: 716, width: oldTitleWidth + 6, height: 22, color: WHITE });
  page.drawText("Pickup Ticket", {
    x: 386.41 + oldTitleWidth - newTitleWidth,
    y: 723,
    size: 20,
    font: boldFont,
    color: BLACK,
  });

  // ---- Wipe the old artwork ------------------------------------------------
  page.drawRectangle({ x: 33, y: 82, width: 546, height: 578, color: WHITE });
  page.drawRectangle({ x: 153, y: 28.5, width: 70, height: 49, color: WHITE }); // NPCA logo
  page.drawRectangle({ x: 254, y: 32, width: 178, height: 41, color: WHITE }); // Time In/Out

  // ---- Info box ------------------------------------------------------------
  page.drawRectangle({
    x: LEFT,
    y: INFO_BOX_BOTTOM,
    width: WIDTH,
    height: INFO_BOX_TOP - INFO_BOX_BOTTOM,
    borderColor: BLACK,
    borderWidth: 1,
  });
  // Labels at the template's original positions; the matching field values
  // ("Contractor Name", "Job Number", "Job Name", relocated address lines)
  // are painted by the form fill.
  page.drawText("Sold to:", { x: 39.5, y: 642, size: 9, font: boldFont, color: BLACK });
  page.drawText("Job Number:", { x: 324, y: 642, size: 9, font: boldFont, color: BLACK });
  page.drawText("Job Name:", { x: 324, y: 624, size: 9, font: boldFont, color: BLACK });

  // ---- Header band + value row ----------------------------------------------
  const bandBoxBottom = BAND_BOX_TOP - BAND_BOX_HEIGHT;
  const bandFillBottom = BAND_BOX_TOP - BAND_FILL_HEIGHT;
  page.drawRectangle({
    x: LEFT,
    y: bandFillBottom,
    width: WIDTH,
    height: BAND_FILL_HEIGHT,
    color: HEADER_BAND_GREY,
  });
  page.drawRectangle({
    x: LEFT,
    y: bandBoxBottom,
    width: WIDTH,
    height: BAND_BOX_HEIGHT,
    borderColor: BLACK,
    borderWidth: 1,
  });
  hline(page, LEFT, RIGHT, bandFillBottom);
  for (let i = 1; i < BAND_COLS.length - 1; i += 1) {
    vline(page, BAND_COLS[i]!, bandBoxBottom, BAND_BOX_TOP);
  }
  const captionY = bandFillBottom + 3.5;
  for (let i = 0; i < BAND_CAPTIONS.length; i += 1) {
    centered(page, boldFont, BAND_CAPTIONS[i]!, BAND_COLS[i]!, BAND_COLS[i + 1]!, captionY, 8);
  }

  // ---- Notes box -------------------------------------------------------------
  page.drawRectangle({
    x: LEFT,
    y: NOTES_BOX_BOTTOM,
    width: WIDTH,
    height: NOTES_BOX_HEIGHT,
    borderColor: BLACK,
    borderWidth: 1,
  });
  page.drawText("Notes:", {
    x: 39.5,
    y: NOTES_BOX_BOTTOM + 4,
    size: 9,
    font: boldFont,
    color: BLACK,
  });

  // ---- Items table grid -------------------------------------------------------
  const headerBottom = TABLE_TOP - TABLE_HEADER_HEIGHT;
  page.drawRectangle({
    x: LEFT,
    y: headerBottom,
    width: WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: HEADER_BAND_GREY,
  });
  page.drawRectangle({
    x: LEFT,
    y: TABLE_BOTTOM,
    width: WIDTH,
    height: TABLE_TOP - TABLE_BOTTOM,
    borderColor: BLACK,
    borderWidth: 1,
  });
  hline(page, LEFT, RIGHT, headerBottom);
  vline(page, COL_QTY_X, TABLE_BOTTOM, TABLE_TOP);
  vline(page, DESC_COL_X, TABLE_BOTTOM, TABLE_TOP);

  const headCapY = headerBottom + 4.5;
  page.drawText("Item #", { x: 53, y: headCapY, size: 9, font: boldFont, color: BLACK });
  centered(page, boldFont, "Qty", COL_QTY_X, DESC_COL_X, headCapY, 9);
  centered(page, boldFont, "Description", DESC_COL_X, RIGHT, headCapY, 9);

  // ---- RECEIVED BY block --------------------------------------------------------
  page.drawText("RECEIVED BY:", { x: 35.8, y: 102, size: 9, font: regularFont, color: BLACK });
  hline(page, 112, 447, 99, 0.8);
  hline(page, LEFT, 572.8, 87, 0.8);

  // ---- NPCA logo flush right, return policy beside it ----------------------------
  const logoX = RIGHT - NPCA_SCALE_X;
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(NPCA_SCALE_X, 0, 0, NPCA_SCALE_Y, logoX, NPCA_Y),
    drawObject(NPCA_XOBJECT_NAME),
    popGraphicsState(),
  );

  const lines = wrapText(FINE_PRINT, regularFont, 8, logoX - LEFT - 10);
  const leading = 9.6;
  const logoCenterY = NPCA_Y + NPCA_SCALE_Y / 2;
  let lineY = logoCenterY + ((lines.length - 1) * leading) / 2 - 3;
  for (const line of lines) {
    page.drawText(line, { x: LEFT, y: lineY, size: 8, font: regularFont, color: BLACK });
    lineY -= leading;
  }
}
