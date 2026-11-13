import type { ScanPlanCounts, ScanRowKind } from "@/lib/ticket-scan/plan";
import type { ScanBox } from "@/lib/ticket-scan/types";

/**
 * Everything the Scan In screen draws, as plain data. The server builds it
 * (lib/ticket-scan/view.ts) and every Scan In action returns a fresh one, so
 * the screen never has to re-fetch. No Node imports: the screen uses these
 * types too.
 */

export type ScanInRowBand = "needs" | "reading" | "ready" | "filed" | "left";

/** One page in the "Pages in this scan" grid. */
export type ScanInRow = {
  /** Unique on the screen: pages of the open scan and of a filed one mix. */
  key: string;
  /** "open": still being worked on. "filed": from a scan that was filed. */
  from: "open" | "filed";
  seq: number;
  /** The Pg column: page number in its file, with the file's letter when the
   * scan holds more than one file ("B3"). */
  pgLabel: string;
  band: ScanInRowBand;
  kind: ScanRowKind | "filed";
  ticketNumber: string | null;
  ticketId: string | null;
  customerName: string;
  projectName: string;
  statusLabel: string;
  copy: string;
  sheet: string;
  notes: string[];
  detail: string | null;
  /** First row of its ticket: carries the ticket's question and Deliver box. */
  lead: boolean;
  decided: boolean;
  deliver: boolean | null;
  typed: boolean;
  aboveTicketNumber: string | null;
  /** Picture of the page for the preview, upright; null when it was not kept. */
  imageUrl: string | null;
  /** Where the code was found, on the picture as shown. */
  codeBox: ScanBox | null;
  /** The ticket's invoice, for the Signed Ticket / Invoice switch. */
  invoice: { id: string; invoiceNumber: string } | null;
  /** Download link of the signed PDF this page went into (filed rows). */
  signedFileUrl: string | null;
  /** The signed copy the ticket already has on file, to compare against. */
  onFileUrl: string | null;
};

export type ScanInSource = {
  id: string;
  fileName: string;
  pageCount: number;
  /** "A", "B" … shown in the Pg column when there is more than one file. */
  letter: string;
};

export type ScanInOpenScan = {
  id: string;
  /** Sent back with every change, so a stale screen cannot file. */
  version: number;
  sources: ScanInSource[];
  counts: ScanPlanCounts;
  /** Left-out pages that File (or Clear) would take off the scan. */
  leftOutToClear: number;
  /** File is running right now (someone clicked it a moment ago). */
  filing: boolean;
};

/** A ticket filed by the scan being looked at, in paper stack order. */
export type ScanInFiledTicket = {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  projectName: string;
  signedFileUrl: string;
  /** "T10189 - Signed.pdf" */
  signedFileName: string;
  pageCount: number;
  markedDelivered: boolean;
  replaced: boolean;
  jobFolderCopy: "saved" | "none" | "failed";
  warnings: string[];
  invoice: {
    id: string;
    invoiceNumber: string;
    statusLabel: string;
    price: number;
    salesTax: number;
    total: number;
    /** Lines waiting for a price. */
    priceNeededItems: string[];
    canEdit: boolean;
    note: string | null;
  } | null;
  /** Why there is no invoice, when there is none. */
  noInvoiceNote: string | null;
};

export type ScanInFiledScan = {
  id: string;
  /** "11-12-2026, 4:42 PM" */
  filedLabel: string;
  filedBy: string | null;
  fileNames: string[];
  tickets: ScanInFiledTicket[];
  failures: { ticketNumber: string; error: string }[];
  counts: {
    tickets: number;
    pages: number;
    markedDelivered: number;
    invoices: number;
    invoicesMade: number;
    jobFolderCopies: number;
    leftOut: number;
  };
  /** Summary page + every invoice in stack order; null when there are none. */
  printInvoicesUrl: string | null;
};

export type ScanInStillOutRow = {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  projectName: string;
  /** "11-10" */
  dateLabel: string;
  /** "yyyy-mm-dd", for the Move Date box. */
  dateInput: string;
  /** Whole days since that date; 0 = today. */
  daysOut: number;
  statusLabel: string;
  delivered: boolean;
  /** A signed copy is filed, but the ticket was never marked delivered. */
  signedNotDelivered: boolean;
  note: string | null;
};

export type ScanInEarlierScan = {
  id: string;
  filedLabel: string;
  filedBy: string | null;
  tickets: number;
  pages: number;
};

export type ScanInSuggestion = {
  ticketNumber: string;
  /** "Reilly Sitework · Main St drainage" */
  label: string;
};

export type ScanInView = {
  /** Can change things here (needs both invoice and delivery permission). */
  canFile: boolean;
  open: ScanInOpenScan | null;
  /** The working scan's pages are in `rows` (false while an unrelated earlier
   * scan is being looked at). */
  showingOpen: boolean;
  /** The filed scan being looked at: just filed, or picked from Earlier Scans. */
  filed: ScanInFiledScan | null;
  rows: ScanInRow[];
  stillOut: ScanInStillOutRow[];
  /** More tickets are still out than the list shows. */
  stillOutMore: number;
  earlier: ScanInEarlierScan[];
  suggestions: ScanInSuggestion[];
  /** "05 Delivery Tickets": where the job folder copy goes. */
  jobFolderName: string;
  /** Every invoice on the server, for the count on the Invoices tab. */
  invoiceCount: number;
  /** When the server built this (ms), so a screen restored from the browser's
   * history can tell it is old and ask again. */
  loadedAt: number;
};

/** What an action on a Still Out row hands back so the row can offer Undo. */
export type StillOutUndo =
  | {
      kind: "closed";
      ticketId: string;
      wasMarkedDelivered: boolean;
      /** The invoice this click made, if it made one. */
      invoiceNumber: string | null;
      invoiceId: string | null;
    }
  | { kind: "moved"; ticketId: string; previousDate: string };

/** What every Scan In action hands back: the fresh screen, or what went wrong. */
export type ScanInActionResult =
  | {
      view: ScanInView;
      notice?: string | null;
      warning?: string | null;
      /** Set by an action on a Still Out row that can be taken back. */
      undo?: StillOutUndo | null;
    }
  | {
      error: string;
      /** The screen as it is now, when it could still be loaded. */
      view?: ScanInView;
      /** Undoing this would delete an unpaid invoice: ask, then call again. */
      needsInvoiceRemoval?: { invoiceNumber: string };
    };
