/**
 * Scan In (Invoices → Scan In): the shapes stored on a TicketScanBatch row and
 * the small pure helpers both the server and the screen use. No Node imports
 * here — the screen imports this file too.
 *
 * How it hangs together: there is at most one OPEN batch, the pages that are
 * not filed yet. Every click of File moves the pages it dealt with into a new
 * FILED batch (the record of what was filed together, in paper stack order).
 */

/** Clockwise quarter turns that put a scanned page upright. */
export type ScanRotation = 0 | 90 | 180 | 270;

/** A box on a page as scanned (before any turn), in fractions 0–1 of the page. */
export type ScanBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** One uploaded PDF of an OPEN batch, kept in storage/ticket-scans/<batchId>/. */
export type ScanSource = {
  /** Also the stored file's name: "<id>.pdf". */
  id: string;
  /** "A", "B" …: goes in front of the page number in the Pg column when the
   * scan holds more than one file. Kept for the life of the scan. */
  letter: string;
  fileName: string;
  pageCount: number;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string | null;
};

/** What a ticket page's scan code says (lib/ticket-scan-code.ts). */
export type ScanPageCode = {
  ticketNumber: string;
  copyNumber: number;
  pageNumber: number;
  pageCount: number;
  check: string;
};

/** One page of the scan being worked on. */
export type ScanPage = {
  /** Running number within the scan: the Pg column. Never reused. */
  seq: number;
  sourceId: string;
  /** 1-based page in the uploaded PDF. */
  sourcePage: number;
  /** False until the server has looked at the page. */
  read: boolean;
  /** Nothing printed on it (a blank back side): left out unless put back. */
  blank: boolean;
  code: ScanPageCode | null;
  codeBox: ScanBox | null;
  /** Turn that puts the page upright: from the code, or set by hand. */
  rotation: ScanRotation;
  /** Why no code was read, in plain words. */
  readNote: string | null;
  /** The ticket number someone typed for this page (it wins over the code). */
  typedTicketNumber: string | null;
  /** How that number got there: typed, or "Same Ticket As Above". */
  typedVia: "typed" | "above" | null;
  /** Left out by hand ("Skip page"). */
  skipped: boolean;
  /** "Use this copy": wins its ticket sheet over another page claiming it. */
  preferred: boolean;
};

/** What was chosen on the grid for one ticket, keyed by ticket number. */
export type ScanTicketChoice = {
  /** The ticket already has a signed copy: replace it, or leave these pages out. */
  already?: "replace" | "skip";
  /** A page of the ticket is not in the scan: wait for it (the default), or file what is here. */
  missing?: "hold" | "file";
  /** The ticket is cancelled: file the signed copy anyway, or leave these pages out. */
  cancelled?: "file" | "skip";
  /** Mark the ticket delivered when it is filed. Ticked unless set to false. */
  deliver?: boolean;
};

export type ScanTicketChoices = Record<string, ScanTicketChoice>;

/** What became of a page once its scan was filed. */
export type FiledScanPageOutcome =
  | "filed"
  | "skipped"
  | "blank"
  | "extra"
  | "leftOut";

/** One page of a FILED batch: a snapshot, the uploaded PDF is gone by then. */
export type FiledScanPage = {
  seq: number;
  pgLabel: string;
  outcome: FiledScanPageOutcome;
  ticketNumber: string | null;
  ticketId: string | null;
  copy: string;
  sheet: string;
  notes: string[];
  /** For a filed page: the signed PDF it went into and its page there. */
  signedFileId: string | null;
  filePage: number | null;
};

/** What File did with one ticket. */
export type FiledScanTicket = {
  ticketId: string;
  ticketNumber: string;
  signedFileId: string;
  /** "2026/T10189.pdf", relative to storage/signed-tickets. */
  filePath: string;
  pageCount: number;
  /** The Deliver box was ticked and the ticket was not delivered yet. */
  deliverRequested: boolean;
  /** This filing marked the ticket delivered. */
  markedDelivered: boolean;
  /** This filing made the ticket's invoice. */
  invoiceMade: boolean;
  /** An earlier signed copy was replaced (and kept as an earlier version). */
  replaced: boolean;
  /** The copy in the job folder: saved, not applicable, or failed (see warnings). */
  jobFolderCopy: "saved" | "none" | "failed";
  warnings: string[];
};

export type FiledScanResult = {
  tickets: FiledScanTicket[];
  /** Tickets that could not be filed, with the reason (their pages stay open). */
  failures: { ticketNumber: string; error: string }[];
  /** The working scan these pages were filed from (pages may still wait in it). */
  fromScanId: string | null;
};

/** Ticket numbers are compared without case or stray spaces. */
export function normalizeTicketNumber(value: string): string {
  return value.trim().toUpperCase();
}

const COPY_LABELS = ["Top", "Second", "Third"] as const;

/** 1 → "Top", 2 → "Second", 3 → "Third" (the order the three copies print in). */
export function scanCopyLabel(copyNumber: number | null | undefined): string {
  if (!copyNumber) {
    return "";
  }
  return COPY_LABELS[copyNumber - 1] ?? `Copy ${copyNumber}`;
}

export function normalizeScanRotation(value: number): ScanRotation {
  const turned = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
  return turned as ScanRotation;
}

/**
 * Where a box found on the page as scanned ends up once the page is turned
 * clockwise by `rotation`, still in fractions of the (turned) page.
 */
export function rotateScanBox(box: ScanBox, rotation: ScanRotation): ScanBox {
  switch (rotation) {
    case 90:
      return {
        left: 1 - box.top - box.height,
        top: box.left,
        width: box.height,
        height: box.width,
      };
    case 180:
      return {
        left: 1 - box.left - box.width,
        top: 1 - box.top - box.height,
        width: box.width,
        height: box.height,
      };
    case 270:
      return {
        left: box.top,
        top: 1 - box.left - box.width,
        width: box.height,
        height: box.width,
      };
    default:
      return box;
  }
}

/** A, B, C … for the uploaded PDFs of a scan, when there is more than one. */
export function scanSourceLetter(index: number): string {
  let label = "";
  let rest = index;
  do {
    label = String.fromCharCode(65 + (rest % 26)) + label;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return label;
}
