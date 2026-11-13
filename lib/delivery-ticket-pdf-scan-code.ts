import QRCode from "qrcode";
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { toWinAnsiText } from "@/lib/pdf-text";
import { buildTicketScanCode, ticketScanCheck } from "@/lib/ticket-scan-code";

/**
 * Where the scan code prints. 50 pt (0.7 in) square: scan tests read that
 * size through a pen stroke across the symbol, and a 36 pt one did not.
 *
 * Delivery layout: the empty corner right of the Time In / Time Out box,
 * right edge on the table border (x = 575.5). The fine print above it ends
 * at x = 508 on its last line and at y = 93 on the line before, so the
 * symbol keeps clear white on every side. The ticket number prints under it.
 *
 * Pickup layout: that corner holds the NPCA logo, so the code sits right of
 * the RECEIVED BY line (which ends at x = 447), between the rule at y = 87
 * and the table's bottom border at y = 151. The number prints beside it.
 */
export const SCAN_CODE_SIZE = 50;
const SCAN_CODE_RIGHT_X = 575.5;
const DELIVERY_CODE_BOTTOM_Y = 36;
const PICKUP_CODE_BOTTOM_Y = 94;
const LABEL_FONT_SIZE = 7;
const LABEL_GAP = 4;

/** Level Q recovers about a quarter of the symbol (pen marks, stains). */
const ERROR_CORRECTION_LEVEL = "Q" as const;

export type TicketScanCodeInput = {
  ticketId: string | null | undefined;
  ticketNumber: string | null | undefined;
  /** 1-based copy (1 = top copy). */
  copyNumber: number;
  pageNumber: number;
  pageCount: number;
  isPickup: boolean;
};

/** The text a ticket page's code holds, or null when the page gets no code. */
export function ticketPageScanCodeText(input: TicketScanCodeInput): string | null {
  const ticketNumber = input.ticketNumber?.trim();
  const ticketId = input.ticketId?.trim();
  // A draft has no number yet, and an unsaved preview has no id: neither can
  // be filed against, so neither gets a code.
  if (!ticketNumber || !ticketId) {
    return null;
  }
  return buildTicketScanCode({
    ticketNumber,
    copyNumber: input.copyNumber,
    pageNumber: input.pageNumber,
    pageCount: input.pageCount,
    check: ticketScanCheck(ticketId),
  });
}

/**
 * SVG path for the dark modules, one unit per module, y down from the top
 * row. Runs of dark modules in a row become one rectangle.
 */
export function buildQrModulePath(text: string): { path: string; size: number } {
  const { modules } = QRCode.create(text, {
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
  });
  const size = modules.size;
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!modules.get(row, col)) {
        col += 1;
        continue;
      }
      let run = 1;
      while (col + run < size && modules.get(row, col + run)) {
        run += 1;
      }
      parts.push(`M${col} ${row}h${run}v1h${-run}z`);
      col += run;
    }
  }
  return { path: parts.join(""), size };
}

/** Draws the scan code (and the ticket number beside it) on a ticket page. */
export function drawTicketScanCode(
  page: PDFPage,
  font: PDFFont,
  input: TicketScanCodeInput,
): void {
  const text = ticketPageScanCodeText(input);
  if (!text) {
    return;
  }
  const { path, size } = buildQrModulePath(text);
  const left = SCAN_CODE_RIGHT_X - SCAN_CODE_SIZE;
  const bottom = input.isPickup ? PICKUP_CODE_BOTTOM_Y : DELIVERY_CODE_BOTTOM_Y;

  // drawSvgPath starts at the path's top-left corner and runs y downward.
  page.drawSvgPath(path, {
    x: left,
    y: bottom + SCAN_CODE_SIZE,
    scale: SCAN_CODE_SIZE / size,
    color: rgb(0, 0, 0),
    borderWidth: 0,
  });

  const label = toWinAnsiText(input.ticketNumber ?? "").trim();
  if (!label) {
    return;
  }
  const labelWidth = font.widthOfTextAtSize(label, LABEL_FONT_SIZE);
  if (input.isPickup) {
    page.drawText(label, {
      x: left - LABEL_GAP - labelWidth,
      y: bottom,
      size: LABEL_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    return;
  }
  page.drawText(label, {
    x: SCAN_CODE_RIGHT_X - labelWidth,
    y: bottom - LABEL_GAP - LABEL_FONT_SIZE * 0.72,
    size: LABEL_FONT_SIZE,
    font,
    color: rgb(0, 0, 0),
  });
}
