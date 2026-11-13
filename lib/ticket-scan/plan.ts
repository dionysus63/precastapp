import { ticketScanCheck } from "@/lib/ticket-scan-code";
import {
  normalizeTicketNumber,
  scanCopyLabel,
  type ScanBox,
  type ScanPage,
  type ScanRotation,
  type ScanTicketChoice,
  type ScanTicketChoices,
} from "@/lib/ticket-scan/types";

/**
 * Works out, from the pages of a scan and what the database knows about the
 * tickets on them, what each page is and what File would do. Pure: nothing
 * here reads or writes anything, so the rules can be tested on their own.
 *
 * Nothing is filed by guesswork: a page the app cannot place waits in the
 * "Needs you" band until someone says what it is or leaves it out.
 */

/** What the plan needs to know about a ticket named on a page. */
export type ScanTicketFacts = {
  id: string;
  ticketNumber: string;
  status: string;
  /** "Scheduled", "Delivered 11-10" … as the grid shows it. */
  statusLabel: string;
  customerName: string;
  projectName: string;
  /** The ticket's current signed copy, when it already has one. */
  signed: { fileId: string; filedOn: string } | null;
};

export type ScanRowBand = "needs" | "ready" | "left" | "reading";

export type ScanRowKind =
  /** The server has not looked at the page yet. */
  | "reading"
  /** Will be filed. */
  | "ready"
  /** No code found: type the number, say "same ticket as above", or skip. */
  | "notRead"
  /** The code is for a ticket that is not on this server. */
  | "notHere"
  /** The ticket already has a signed copy: Replace or Skip. */
  | "already"
  /** A page of the ticket is not in the scan: Hold or File as is. */
  | "missing"
  /** The ticket is cancelled: File anyway or Skip. */
  | "cancelled"
  /** A second copy of a ticket page already in the scan. */
  | "extra"
  /** Blank back side. */
  | "blank"
  /** Left out by hand. */
  | "skipped"
  /** Left out by a choice on its ticket (already signed / cancelled → Skip). */
  | "leftOut";

export type ScanRow = {
  seq: number;
  band: ScanRowBand;
  kind: ScanRowKind;
  ticketNumber: string | null;
  ticketId: string | null;
  customerName: string;
  projectName: string;
  statusLabel: string;
  copy: string;
  sheet: string;
  /** Small print under the result. */
  notes: string[];
  /** e.g. "Scanned 11-10" for Already signed, "Page 2 missing". */
  detail: string | null;
  /** First row of its ticket: it carries the ticket's choice and Deliver box. */
  lead: boolean;
  /** Lead row of a ticket someone already answered a question about
   * (Replace, File as is, File anyway, Skip): "Change" takes it back. */
  decided: boolean;
  /** The Deliver tick box (lead row of a ticket that will be filed and is
   * not delivered yet); null = no box. */
  deliver: boolean | null;
  /** The number came from typing or "Same Ticket As Above". */
  typed: boolean;
  /** Ticket of the nearest page above, offered as "Same Ticket As Above". */
  aboveTicketNumber: string | null;
  rotation: ScanRotation;
  codeBox: ScanBox | null;
  /** Leaves the scan at the next File (filed, or left out for good). */
  settles: boolean;
};

export type ScanTicketPlanPage = {
  seq: number;
  sourceId: string;
  sourcePage: number;
  rotation: ScanRotation;
  copy: string;
  sheet: string;
  notes: string[];
};

export type ScanTicketPlan = {
  ticket: ScanTicketFacts;
  /** "file": File will file it. "wait": it needs an answer first.
   * "leftOut": its pages are left out by choice. */
  state: "file" | "wait" | "leftOut";
  /** Pages in the order they go into the signed PDF. */
  pages: ScanTicketPlanPage[];
  /** Pages of the ticket that are not used (extra copies). */
  extraSeqs: number[];
  leadSeq: number;
  /** Mark the ticket delivered when it is filed. */
  deliver: boolean;
  /** Filing replaces an earlier signed copy. */
  replaces: boolean;
  missingSheets: number[];
};

export type ScanPlanCounts = {
  pages: number;
  codesRead: number;
  reading: number;
  needsYou: number;
  leftOut: number;
  ticketsToFile: number;
  pagesToFile: number;
  delivering: number;
};

export type ScanPlan = {
  rows: ScanRow[];
  tickets: ScanTicketPlan[];
  counts: ScanPlanCounts;
};

type Claim = {
  page: ScanPage;
  typed: boolean;
  copy: number | null;
  sheet: number | null;
  of: number | null;
};

type Slot = { claim: Claim; sheet: number | null };

const LIVE_STATUSES_DELIVERABLE = new Set([
  "DRAFT",
  "SCHEDULED",
  "LOADING",
  "IN_TRANSIT",
]);

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  let best = values[0] ?? 0;
  let bestCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    // First to reach the highest count wins, so ties go to the earlier page.
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Which pages make up a ticket's signed PDF, and in what order.
 *
 * Coded pages say their sheet ("1 of 2") and copy. When two pages claim the
 * same sheet, the one marked "Use this copy" wins; otherwise the first copy
 * in the stack that has every sheet; otherwise the first page in the stack.
 * Typed pages (no code) fill the sheets still missing, in stack order, and
 * any left over go behind the ticket as extra pages.
 */
function assignSheets(claims: Claim[]): {
  slots: Slot[];
  extras: Claim[];
  missing: number[];
  sheetCount: number;
} {
  const bySeq = (a: Claim, b: Claim) => a.page.seq - b.page.seq;
  const coded = claims.filter((claim) => !claim.typed).sort(bySeq);
  const typed = claims.filter((claim) => claim.typed).sort(bySeq);

  if (coded.length === 0) {
    return {
      slots: typed.map((claim, index) => ({ claim, sheet: index + 1 })),
      extras: [],
      missing: [],
      sheetCount: typed.length,
    };
  }

  const sheetCount = mostCommon(coded.map((claim) => claim.of ?? 1));
  const matching = coded.filter(
    (claim) =>
      claim.of === sheetCount &&
      claim.sheet != null &&
      claim.sheet >= 1 &&
      claim.sheet <= sheetCount,
  );
  const extras = coded.filter((claim) => !matching.includes(claim));

  // The first copy in the stack that has every sheet.
  let completeCopy: number | null = null;
  const copiesInOrder = [...new Set(matching.map((claim) => claim.copy))];
  for (const copy of copiesInOrder) {
    const sheets = new Set(
      matching.filter((claim) => claim.copy === copy).map((claim) => claim.sheet),
    );
    if (sheets.size === sheetCount) {
      completeCopy = copy;
      break;
    }
  }

  const winners = new Map<number, Claim>();
  for (let sheet = 1; sheet <= sheetCount; sheet += 1) {
    const candidates = matching.filter((claim) => claim.sheet === sheet);
    if (candidates.length === 0) {
      continue;
    }
    const winner =
      candidates.find((claim) => claim.page.preferred) ??
      (completeCopy != null
        ? candidates.find((claim) => claim.copy === completeCopy)
        : undefined) ??
      candidates[0]!;
    winners.set(sheet, winner);
    for (const candidate of candidates) {
      if (candidate !== winner) {
        extras.push(candidate);
      }
    }
  }

  const typedLeft = [...typed];
  const slots: Slot[] = [];
  const missing: number[] = [];
  for (let sheet = 1; sheet <= sheetCount; sheet += 1) {
    const winner = winners.get(sheet) ?? typedLeft.shift();
    if (winner) {
      slots.push({ claim: winner, sheet });
    } else {
      missing.push(sheet);
    }
  }
  for (const claim of typedLeft) {
    slots.push({ claim, sheet: null });
  }

  return { slots, extras: extras.sort(bySeq), missing, sheetCount };
}

function missingDetail(missing: number[]): string {
  if (missing.length === 1) {
    return `Page ${missing[0]} missing`;
  }
  const last = missing[missing.length - 1];
  return `Pages ${missing.slice(0, -1).join(", ")} and ${last} missing`;
}

function turnNote(page: ScanPage): string | null {
  if (!page.code) {
    return null;
  }
  if (page.rotation === 180) {
    return "Fed upside down, turned upright";
  }
  if (page.rotation === 90 || page.rotation === 270) {
    return "Fed sideways, turned upright";
  }
  return null;
}

function blankRow(page: ScanPage): ScanRow {
  return {
    seq: page.seq,
    band: "needs",
    kind: "notRead",
    ticketNumber: null,
    ticketId: null,
    customerName: "",
    projectName: "",
    statusLabel: "",
    copy: "",
    sheet: "",
    notes: [],
    detail: null,
    lead: false,
    decided: false,
    deliver: null,
    typed: false,
    aboveTicketNumber: null,
    rotation: page.rotation,
    codeBox: page.codeBox,
    settles: false,
  };
}

export function planScan(input: {
  pages: ScanPage[];
  choices: ScanTicketChoices;
  /** Tickets by normalized ticket number (normalizeTicketNumber). */
  tickets: ReadonlyMap<string, ScanTicketFacts>;
}): ScanPlan {
  const pages = [...input.pages].sort((a, b) => a.seq - b.seq);
  const rows = new Map<number, ScanRow>();
  const claimsByTicket = new Map<string, Claim[]>();

  for (const page of pages) {
    const row = blankRow(page);
    rows.set(page.seq, row);

    if (!page.read) {
      row.band = "reading";
      row.kind = "reading";
      continue;
    }
    if (page.skipped) {
      row.band = "left";
      row.kind = "skipped";
      row.settles = true;
      continue;
    }

    const typedNumber = page.typedTicketNumber
      ? normalizeTicketNumber(page.typedTicketNumber)
      : null;
    if (typedNumber) {
      const ticket = input.tickets.get(typedNumber);
      if (!ticket) {
        // The ticket was there when the number was typed and is gone now.
        row.detail = `No ticket ${page.typedTicketNumber} on this server`;
        continue;
      }
      const claims = claimsByTicket.get(typedNumber) ?? [];
      claims.push({ page, typed: true, copy: null, sheet: null, of: null });
      claimsByTicket.set(typedNumber, claims);
      continue;
    }

    if (!page.code) {
      if (page.blank) {
        row.band = "left";
        row.kind = "blank";
        row.settles = true;
      } else {
        row.detail = page.readNote;
      }
      continue;
    }

    const codeNumber = normalizeTicketNumber(page.code.ticketNumber);
    const ticket = input.tickets.get(codeNumber);
    row.copy = scanCopyLabel(page.code.copyNumber);
    row.sheet = `${page.code.pageNumber} of ${page.code.pageCount}`;
    if (!ticket) {
      row.kind = "notHere";
      row.ticketNumber = page.code.ticketNumber;
      row.detail = `There is no ticket ${page.code.ticketNumber} on this server`;
      continue;
    }
    if (page.code.check.toUpperCase() !== ticketScanCheck(ticket.id)) {
      row.kind = "notHere";
      row.ticketNumber = page.code.ticketNumber;
      row.detail =
        "Printed from another copy of the app (the dev copy, for example)";
      continue;
    }
    const claims = claimsByTicket.get(codeNumber) ?? [];
    claims.push({
      page,
      typed: false,
      copy: page.code.copyNumber,
      sheet: page.code.pageNumber,
      of: page.code.pageCount,
    });
    claimsByTicket.set(codeNumber, claims);
  }

  const tickets: ScanTicketPlan[] = [];
  for (const [number, claims] of claimsByTicket) {
    const ticket = input.tickets.get(number)!;
    const choice: ScanTicketChoice = input.choices[number] ?? {};
    const { slots, extras, missing, sheetCount } = assignSheets(claims);

    const isCancelled = ticket.status === "CANCELLED";
    const isSigned = ticket.signed != null;
    const isMissing = missing.length > 0;

    let state: ScanTicketPlan["state"] = "file";
    let waitingOn: "cancelled" | "already" | "missing" | null = null;
    if (
      (isCancelled && choice.cancelled === "skip") ||
      (isSigned && choice.already === "skip")
    ) {
      state = "leftOut";
    } else if (isCancelled && choice.cancelled !== "file") {
      state = "wait";
      waitingOn = "cancelled";
    } else if (isSigned && choice.already !== "replace") {
      state = "wait";
      waitingOn = "already";
    } else if (isMissing && choice.missing !== "file") {
      state = "wait";
      waitingOn = "missing";
    }

    const decided =
      choice.already != null || choice.cancelled != null || choice.missing === "file";
    const canDeliver = LIVE_STATUSES_DELIVERABLE.has(ticket.status);
    const deliver = state === "file" && canDeliver && choice.deliver !== false;
    const leadSeq = Math.min(...slots.map((slot) => slot.claim.page.seq));

    const planPages: ScanTicketPlanPage[] = [];
    for (const slot of slots) {
      const page = slot.claim.page;
      const row = rows.get(page.seq)!;
      const isLead = page.seq === leadSeq;
      row.ticketNumber = ticket.ticketNumber;
      row.ticketId = ticket.id;
      row.customerName = ticket.customerName;
      row.projectName = ticket.projectName;
      row.statusLabel = ticket.statusLabel;
      row.typed = slot.claim.typed;
      row.copy = scanCopyLabel(slot.claim.copy);
      row.sheet =
        slot.sheet == null ? "Extra page" : `${slot.sheet} of ${sheetCount}`;
      row.lead = isLead;
      row.decided = isLead && decided;

      const notes: string[] = [];
      const turned = turnNote(page);
      if (turned) {
        notes.push(turned);
      }
      if (slot.claim.typed) {
        notes.push(
          page.typedVia === "above"
            ? "Same ticket as above"
            : "Number typed by you",
        );
      }
      if (slot.sheet == null) {
        notes.push("Goes behind the ticket's own pages");
      }

      if (state === "file") {
        row.band = "ready";
        row.kind = "ready";
        row.settles = true;
        if (isLead) {
          if (isSigned) {
            notes.push(`Replaces the copy scanned ${ticket.signed!.filedOn}`);
          }
          if (isCancelled) {
            notes.push("Ticket is cancelled, filed anyway");
          }
          if (isMissing) {
            notes.push(`Filed without ${missingDetail(missing).replace(" missing", "").toLowerCase()}`);
          }
          row.deliver = canDeliver ? deliver : null;
        }
      } else if (state === "leftOut") {
        row.band = "left";
        row.kind = "leftOut";
        row.settles = true;
        row.detail =
          isCancelled && choice.cancelled === "skip"
            ? "Ticket is cancelled, left out"
            : `Already signed (scanned ${ticket.signed?.filedOn ?? "earlier"}), left out`;
      } else {
        row.band = "needs";
        row.kind = waitingOn!;
        if (waitingOn === "already") {
          row.detail = `Scanned ${ticket.signed!.filedOn}`;
        } else if (waitingOn === "missing") {
          row.detail = missingDetail(missing);
        } else {
          row.detail = "This ticket was cancelled";
        }
      }
      row.notes = notes;
      planPages.push({
        seq: page.seq,
        sourceId: page.sourceId,
        sourcePage: page.sourcePage,
        rotation: page.rotation,
        copy: row.copy,
        sheet: row.sheet,
        notes,
      });
    }

    for (const extra of extras) {
      const row = rows.get(extra.page.seq)!;
      row.band = "left";
      row.kind = "extra";
      row.ticketNumber = ticket.ticketNumber;
      row.ticketId = ticket.id;
      row.customerName = ticket.customerName;
      row.projectName = ticket.projectName;
      row.statusLabel = ticket.statusLabel;
      row.copy = scanCopyLabel(extra.copy);
      row.sheet =
        extra.sheet != null && extra.of != null
          ? `${extra.sheet} of ${extra.of}`
          : "";
      // An extra copy goes when its ticket goes; until then it can be swapped in.
      row.settles = state !== "wait";
    }

    tickets.push({
      ticket,
      state,
      pages: planPages,
      extraSeqs: extras.map((extra) => extra.page.seq),
      leadSeq,
      deliver,
      replaces: state === "file" && isSigned,
      missingSheets: missing,
    });
  }
  tickets.sort((a, b) => a.leadSeq - b.leadSeq);

  // "Same Ticket As Above": the ticket of the nearest page before this one.
  let above: string | null = null;
  const ordered = pages.map((page) => rows.get(page.seq)!);
  for (const row of ordered) {
    if (row.kind === "notRead" || row.kind === "notHere") {
      row.aboveTicketNumber = above;
    }
    if (
      row.ticketId &&
      row.kind !== "extra" &&
      row.kind !== "leftOut" &&
      row.kind !== "notHere"
    ) {
      above = row.ticketNumber;
    }
  }

  const filing = tickets.filter((ticket) => ticket.state === "file");
  return {
    rows: ordered,
    tickets,
    counts: {
      pages: ordered.length,
      codesRead: pages.filter((page) => page.code != null).length,
      reading: ordered.filter((row) => row.band === "reading").length,
      needsYou: ordered.filter((row) => row.band === "needs").length,
      leftOut: ordered.filter((row) => row.band === "left").length,
      ticketsToFile: filing.length,
      pagesToFile: filing.reduce((sum, ticket) => sum + ticket.pages.length, 0),
      delivering: filing.filter((ticket) => ticket.deliver).length,
    },
  };
}
