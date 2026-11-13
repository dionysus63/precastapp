/**
 * The scan code printed on every delivery ticket page, so a scanned stack of
 * signed tickets can be split and filed by ticket number.
 *
 * Text form: `LIP/<ticket number>/<copy>/<page>/<pages>/<check>`, e.g.
 * `LIP/T10189/1/1/2/K3F9Q2`. Kept to digits, capitals and "/" so the QR
 * symbol stays small (alphanumeric mode). The check value comes from the
 * ticket's database id: dev and production number their tickets separately,
 * so a ticket printed from one must not file against the same number on the
 * other.
 */

export const TICKET_SCAN_CODE_MARKER = "LIP";

const CHECK_LENGTH = 6;

export type TicketScanCode = {
  ticketNumber: string;
  /** 1 = first (top) copy, 2 = second, 3 = third. */
  copyNumber: number;
  pageNumber: number;
  pageCount: number;
  check: string;
};

/** Short check value for a ticket id: its last six letters/digits, capitalised. */
export function ticketScanCheck(ticketId: string): string {
  const cleaned = ticketId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.slice(-CHECK_LENGTH);
}

export function buildTicketScanCode(code: TicketScanCode): string {
  return [
    TICKET_SCAN_CODE_MARKER,
    code.ticketNumber.trim(),
    code.copyNumber,
    code.pageNumber,
    code.pageCount,
    code.check,
  ].join("/");
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d{1,4}$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return parsed >= 1 ? parsed : null;
}

/**
 * Reads a scanned code back. Returns null for anything that is not one of
 * ours (another barcode on the page, a damaged read). The ticket number is
 * whatever sits between the marker and the last four parts, so a number
 * prefix containing "/" still round-trips.
 */
export function parseTicketScanCode(text: string): TicketScanCode | null {
  const parts = text.trim().split("/");
  if (parts.length < 6 || parts[0] !== TICKET_SCAN_CODE_MARKER) {
    return null;
  }
  const check = parts[parts.length - 1]!;
  const pageCount = parsePositiveInt(parts[parts.length - 2]!);
  const pageNumber = parsePositiveInt(parts[parts.length - 3]!);
  const copyNumber = parsePositiveInt(parts[parts.length - 4]!);
  const ticketNumber = parts.slice(1, parts.length - 4).join("/").trim();
  if (
    !ticketNumber ||
    !check ||
    copyNumber == null ||
    pageNumber == null ||
    pageCount == null ||
    pageNumber > pageCount
  ) {
    return null;
  }
  return { ticketNumber, copyNumber, pageNumber, pageCount, check };
}

/** True when a scanned code's check value belongs to this ticket id. */
export function ticketScanCheckMatches(code: TicketScanCode, ticketId: string): boolean {
  return code.check.toUpperCase() === ticketScanCheck(ticketId);
}
