import { beforeEach, describe, expect, it } from "vitest";
import { ticketScanCheck } from "@/lib/ticket-scan-code";
import { planScan, type ScanTicketFacts } from "@/lib/ticket-scan/plan";
import {
  normalizeTicketNumber,
  rotateScanBox,
  scanSourceLetter,
  type ScanBox,
  type ScanPage,
  type ScanTicketChoices,
} from "@/lib/ticket-scan/types";

/**
 * The rules that decide what each scanned page is and what File would do
 * with it. Pure: pages in, plan out.
 */

function facts(
  ticketNumber: string,
  overrides: Partial<ScanTicketFacts> = {},
): ScanTicketFacts {
  return {
    id: `cmticket0000000${ticketNumber.toLowerCase()}`,
    ticketNumber,
    status: "SCHEDULED",
    statusLabel: "Scheduled",
    customerName: "Sample Contractor",
    projectName: "Sample Project",
    signed: null,
    ...overrides,
  };
}

function ticketMap(...tickets: ScanTicketFacts[]) {
  return new Map(
    tickets.map((ticket) => [normalizeTicketNumber(ticket.ticketNumber), ticket]),
  );
}

/** The Pg number the next page() gets: pages are numbered as they are made. */
let nextSeq = 1;
beforeEach(() => {
  nextSeq = 1;
});

function page(overrides: Partial<ScanPage> = {}): ScanPage {
  const seq = overrides.seq ?? nextSeq;
  nextSeq = seq + 1;
  return {
    seq,
    sourceId: "source-a",
    sourcePage: seq,
    read: true,
    blank: false,
    code: null,
    codeBox: null,
    rotation: 0,
    readNote: null,
    typedTicketNumber: null,
    typedVia: null,
    skipped: false,
    preferred: false,
    ...overrides,
  };
}

/** A page whose code was read: ticket, sheet "n of m", copy 1 unless said. */
function coded(
  ticket: ScanTicketFacts,
  pageNumber = 1,
  pageCount = 1,
  overrides: Partial<ScanPage> & { copyNumber?: number } = {},
): ScanPage {
  const { copyNumber = 1, ...rest } = overrides;
  return page({
    code: {
      ticketNumber: ticket.ticketNumber,
      copyNumber,
      pageNumber,
      pageCount,
      check: ticketScanCheck(ticket.id),
    },
    ...rest,
  });
}

/** Plans one stack, then starts the page numbers over for the next one. */
function plan(
  pages: ScanPage[],
  tickets: ScanTicketFacts[],
  choices: ScanTicketChoices = {},
) {
  nextSeq = 1;
  return planScan({ pages, choices, tickets: ticketMap(...tickets) });
}

function rowKinds(result: ReturnType<typeof planScan>) {
  return result.rows.map((row) => `${row.seq}:${row.band}/${row.kind}`);
}

describe("planScan: pages with a code", () => {
  it("files a ticket whose every page is in the scan, in sheet order", () => {
    const a = facts("T10240");
    // Fed out of order: sheet 2 before sheet 1.
    const pages = [coded(a, 2, 2), coded(a, 1, 2)];
    const result = plan(pages, [a]);

    expect(rowKinds(result)).toEqual(["1:ready/ready", "2:ready/ready"]);
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0]).toMatchObject({
      state: "file",
      deliver: true,
      replaces: false,
      missingSheets: [],
      leadSeq: 1,
    });
    // The signed PDF gets sheet 1 first whatever order the stack was in.
    expect(result.tickets[0]!.pages.map((entry) => entry.seq)).toEqual([2, 1]);
    expect(result.rows[0]).toMatchObject({
      sheet: "2 of 2",
      copy: "Top",
      lead: true,
      deliver: true,
      settles: true,
    });
    expect(result.rows[1]).toMatchObject({ sheet: "1 of 2", lead: false, deliver: null });
    expect(result.counts).toMatchObject({
      pages: 2,
      codesRead: 2,
      needsYou: 0,
      leftOut: 0,
      ticketsToFile: 1,
      pagesToFile: 2,
      delivering: 1,
    });
  });

  it("notes a page that was fed upside down or sideways", () => {
    const a = facts("T10241");
    const b = facts("T10242");
    const result = plan(
      [coded(a, 1, 1, { rotation: 180 }), coded(b, 1, 1, { rotation: 90 })],
      [a, b],
    );
    expect(result.rows[0]!.notes).toEqual(["Fed upside down, turned upright"]);
    expect(result.rows[1]!.notes).toEqual(["Fed sideways, turned upright"]);
  });

  it("holds a ticket with a page missing until someone says File as is", () => {
    const a = facts("T10243");
    const waiting = plan([coded(a, 1, 2)], [a]);
    expect(waiting.rows[0]).toMatchObject({
      band: "needs",
      kind: "missing",
      detail: "Page 2 missing",
      settles: false,
    });
    expect(waiting.tickets[0]).toMatchObject({ state: "wait", missingSheets: [2] });
    expect(waiting.counts).toMatchObject({ needsYou: 1, ticketsToFile: 0 });

    const filed = plan([coded(a, 1, 2)], [a], { T10243: { missing: "file" } });
    expect(filed.rows[0]).toMatchObject({
      band: "ready",
      kind: "ready",
      decided: true,
    });
    expect(filed.rows[0]!.notes).toContain("Filed without page 2");
    expect(filed.tickets[0]!.state).toBe("file");

    // Hold is the default: choosing it changes nothing.
    const held = plan([coded(a, 1, 2)], [a], { T10243: { missing: "hold" } });
    expect(held.rows[0]).toMatchObject({ kind: "missing", decided: false });
  });

  it("asks before replacing a signed copy, and has no default", () => {
    const signed = facts("T10244", {
      status: "DELIVERED",
      statusLabel: "Delivered 11-10",
      signed: { fileId: "file-1", filedOn: "11-10" },
    });
    const asking = plan([coded(signed)], [signed]);
    expect(asking.rows[0]).toMatchObject({
      band: "needs",
      kind: "already",
      detail: "Scanned 11-10",
    });

    const replacing = plan([coded(signed)], [signed], {
      T10244: { already: "replace" },
    });
    expect(replacing.rows[0]).toMatchObject({
      band: "ready",
      decided: true,
      // Already delivered: there is no Deliver box to tick.
      deliver: null,
    });
    expect(replacing.rows[0]!.notes).toContain("Replaces the copy scanned 11-10");
    expect(replacing.tickets[0]).toMatchObject({
      state: "file",
      replaces: true,
      deliver: false,
    });

    const skipping = plan([coded(signed)], [signed], {
      T10244: { already: "skip" },
    });
    expect(skipping.rows[0]).toMatchObject({
      band: "left",
      kind: "leftOut",
      settles: true,
      detail: "Already signed (scanned 11-10), left out",
    });
    expect(skipping.tickets[0]!.state).toBe("leftOut");
    expect(skipping.counts).toMatchObject({ leftOut: 1, ticketsToFile: 0 });
  });

  it("asks about a cancelled ticket and never marks it delivered", () => {
    const cancelled = facts("T10245", {
      status: "CANCELLED",
      statusLabel: "Cancelled",
    });
    const asking = plan([coded(cancelled)], [cancelled]);
    expect(asking.rows[0]).toMatchObject({
      band: "needs",
      kind: "cancelled",
      detail: "This ticket was cancelled",
    });

    const filing = plan([coded(cancelled)], [cancelled], {
      T10245: { cancelled: "file" },
    });
    expect(filing.rows[0]).toMatchObject({ band: "ready", deliver: null });
    expect(filing.rows[0]!.notes).toContain("Ticket is cancelled, filed anyway");
    expect(filing.tickets[0]).toMatchObject({ state: "file", deliver: false });
    expect(filing.counts.delivering).toBe(0);

    const skipping = plan([coded(cancelled)], [cancelled], {
      T10245: { cancelled: "skip" },
    });
    expect(skipping.rows[0]).toMatchObject({
      band: "left",
      kind: "leftOut",
      detail: "Ticket is cancelled, left out",
    });
  });

  it("files without delivering when the Deliver box is unticked", () => {
    const a = facts("T10246");
    const result = plan([coded(a)], [a], { T10246: { deliver: false } });
    expect(result.rows[0]).toMatchObject({ band: "ready", deliver: false });
    expect(result.tickets[0]).toMatchObject({ state: "file", deliver: false });
    expect(result.counts).toMatchObject({ ticketsToFile: 1, delivering: 0 });
  });

  it("leaves a second copy of the same sheet out, and honors Use this copy", () => {
    const a = facts("T10247");
    const first = plan(
      [coded(a, 1, 1, { copyNumber: 1 }), coded(a, 1, 1, { copyNumber: 2 })],
      [a],
    );
    expect(rowKinds(first)).toEqual(["1:ready/ready", "2:left/extra"]);
    expect(first.rows[1]).toMatchObject({ copy: "Second", sheet: "1 of 1", settles: true });
    expect(first.tickets[0]).toMatchObject({ extraSeqs: [2] });
    expect(first.tickets[0]!.pages.map((entry) => entry.seq)).toEqual([1]);

    const swapped = plan(
      [
        coded(a, 1, 1, { copyNumber: 1 }),
        coded(a, 1, 1, { copyNumber: 2, preferred: true }),
      ],
      [a],
    );
    expect(rowKinds(swapped)).toEqual(["1:left/extra", "2:ready/ready"]);
    expect(swapped.tickets[0]!.pages.map((entry) => entry.seq)).toEqual([2]);
    expect(swapped.tickets[0]).toMatchObject({ leadSeq: 2, extraSeqs: [1] });
  });

  it("prefers the first copy that has every sheet", () => {
    const a = facts("T10248");
    // Top copy: only sheet 1 came back. Second copy: both sheets.
    const result = plan(
      [
        coded(a, 1, 2, { copyNumber: 1 }),
        coded(a, 1, 2, { copyNumber: 2 }),
        coded(a, 2, 2, { copyNumber: 2 }),
      ],
      [a],
    );
    expect(rowKinds(result)).toEqual([
      "1:left/extra",
      "2:ready/ready",
      "3:ready/ready",
    ]);
    expect(result.tickets[0]!.pages.map((entry) => entry.seq)).toEqual([2, 3]);
  });

  it("does not file against a ticket of the same number from another copy of the app", () => {
    const a = facts("T10249");
    const result = plan(
      [
        page({
          code: {
            ticketNumber: "T10249",
            copyNumber: 1,
            pageNumber: 1,
            pageCount: 1,
            check: "ZZZZZZ",
          },
        }),
      ],
      [a],
    );
    expect(result.rows[0]).toMatchObject({
      band: "needs",
      kind: "notHere",
      ticketNumber: "T10249",
      ticketId: null,
    });
    expect(result.tickets).toHaveLength(0);
  });

  it("says so when the code names a ticket that is not on this server", () => {
    const result = plan(
      [
        page({
          code: {
            ticketNumber: "DT10006",
            copyNumber: 1,
            pageNumber: 1,
            pageCount: 1,
            check: "ABC123",
          },
        }),
      ],
      [],
    );
    expect(result.rows[0]).toMatchObject({
      band: "needs",
      kind: "notHere",
      detail: "There is no ticket DT10006 on this server",
    });
    expect(result.counts).toMatchObject({ codesRead: 1, needsYou: 1 });
  });
});

describe("planScan: pages without a code", () => {
  it("waits on a page it could not read and offers the ticket above", () => {
    const a = facts("T10250");
    const result = plan(
      [coded(a), page({ readNote: "No code found on this page" })],
      [a],
    );
    expect(result.rows[1]).toMatchObject({
      band: "needs",
      kind: "notRead",
      detail: "No code found on this page",
      aboveTicketNumber: "T10250",
      settles: false,
    });
    // The ticket above still files: one unread page does not hold the rest.
    expect(result.rows[0]).toMatchObject({ band: "ready" });
    expect(result.counts).toMatchObject({ needsYou: 1, ticketsToFile: 1 });
  });

  it("files a page under the number typed for it", () => {
    const a = facts("T10251");
    const result = plan(
      [page({ typedTicketNumber: "t10251", typedVia: "typed" })],
      [a],
    );
    expect(result.rows[0]).toMatchObject({
      band: "ready",
      kind: "ready",
      ticketNumber: "T10251",
      typed: true,
      sheet: "1 of 1",
      lead: true,
    });
    expect(result.rows[0]!.notes).toEqual(["Number typed by you"]);
  });

  it("uses a typed page for the sheet that is missing, then puts extras behind", () => {
    const a = facts("T10252");
    const result = plan(
      [
        coded(a, 1, 2),
        page({ typedTicketNumber: "T10252", typedVia: "above" }),
        page({ typedTicketNumber: "T10252", typedVia: "above" }),
      ],
      [a],
    );
    expect(result.tickets[0]).toMatchObject({ state: "file", missingSheets: [] });
    expect(result.rows.map((row) => row.sheet)).toEqual([
      "1 of 2",
      "2 of 2",
      "Extra page",
    ]);
    expect(result.rows[1]!.notes).toEqual(["Same ticket as above"]);
    expect(result.rows[2]!.notes).toEqual([
      "Same ticket as above",
      "Goes behind the ticket's own pages",
    ]);
    expect(result.tickets[0]!.pages.map((entry) => entry.seq)).toEqual([1, 2, 3]);
  });

  it("lets a typed number win over the code on the page", () => {
    const a = facts("T10253");
    const b = facts("T10254");
    const result = plan(
      [coded(a, 1, 1, { typedTicketNumber: "T10254", typedVia: "typed" })],
      [a, b],
    );
    expect(result.rows[0]).toMatchObject({ ticketNumber: "T10254", typed: true });
    expect(result.tickets.map((entry) => entry.ticket.ticketNumber)).toEqual([
      "T10254",
    ]);
  });

  it("goes back to waiting when the typed ticket no longer exists", () => {
    const result = plan(
      [page({ typedTicketNumber: "T19999", typedVia: "typed" })],
      [],
    );
    expect(result.rows[0]).toMatchObject({
      band: "needs",
      kind: "notRead",
      detail: "No ticket T19999 on this server",
    });
  });

  it("leaves blank backs and skipped pages out, and shows unread pages as reading", () => {
    const a = facts("T10255");
    const result = plan(
      [
        coded(a),
        page({ blank: true }),
        page({ skipped: true, readNote: "No code found on this page" }),
        page({ read: false }),
      ],
      [a],
    );
    expect(rowKinds(result)).toEqual([
      "1:ready/ready",
      "2:left/blank",
      "3:left/skipped",
      "4:reading/reading",
    ]);
    expect(result.rows[1]!.settles).toBe(true);
    expect(result.rows[2]!.settles).toBe(true);
    expect(result.rows[3]!.settles).toBe(false);
    expect(result.counts).toMatchObject({
      pages: 4,
      reading: 1,
      needsYou: 0,
      leftOut: 2,
    });
  });

  it("does not offer a left-out ticket as the ticket above", () => {
    const skippedTicket = facts("T10256", {
      status: "CANCELLED",
      statusLabel: "Cancelled",
    });
    const result = plan(
      [coded(skippedTicket), page({ readNote: "No code found on this page" })],
      [skippedTicket],
      { T10256: { cancelled: "skip" } },
    );
    expect(result.rows[1]).toMatchObject({
      kind: "notRead",
      aboveTicketNumber: null,
    });
  });
});

describe("planScan: several tickets", () => {
  it("lists tickets in paper stack order and keeps each one's answer apart", () => {
    const a = facts("T10257");
    const b = facts("T10258", {
      status: "DELIVERED",
      statusLabel: "Delivered 11-12",
      signed: { fileId: "file-2", filedOn: "11-12" },
    });
    const c = facts("T10259");
    const result = plan([coded(c), coded(b), coded(a, 1, 2)], [a, b, c], {
      T10259: { deliver: false },
    });
    expect(result.tickets.map((entry) => entry.ticket.ticketNumber)).toEqual([
      "T10259",
      "T10258",
      "T10257",
    ]);
    expect(result.tickets.map((entry) => entry.state)).toEqual([
      "file",
      "wait",
      "wait",
    ]);
    expect(rowKinds(result)).toEqual([
      "1:ready/ready",
      "2:needs/already",
      "3:needs/missing",
    ]);
    expect(result.counts).toMatchObject({
      needsYou: 2,
      ticketsToFile: 1,
      pagesToFile: 1,
      delivering: 0,
    });
  });
});

describe("rotateScanBox", () => {
  const box: ScanBox = { left: 0.8, top: 0.9, width: 0.1, height: 0.05 };
  const close = (actual: ScanBox, expected: ScanBox) => {
    expect(actual.left).toBeCloseTo(expected.left, 10);
    expect(actual.top).toBeCloseTo(expected.top, 10);
    expect(actual.width).toBeCloseTo(expected.width, 10);
    expect(actual.height).toBeCloseTo(expected.height, 10);
  };

  it("leaves the box alone on an upright page", () => {
    expect(rotateScanBox(box, 0)).toEqual(box);
  });

  it("moves a bottom-right box to the bottom-left on a quarter turn clockwise", () => {
    // Turning the page clockwise swings its bottom edge round to the left.
    close(rotateScanBox(box, 90), { left: 0.05, top: 0.8, width: 0.05, height: 0.1 });
  });

  it("moves a bottom-right box to the top-left on a half turn", () => {
    close(rotateScanBox(box, 180), { left: 0.1, top: 0.05, width: 0.1, height: 0.05 });
  });

  it("moves a bottom-right box to the top-right on a three-quarter turn", () => {
    close(rotateScanBox(box, 270), { left: 0.9, top: 0.1, width: 0.05, height: 0.1 });
  });

  it("comes back to where it started after four quarter turns", () => {
    let turned = box;
    for (let turn = 0; turn < 4; turn += 1) {
      turned = rotateScanBox(turned, 90);
    }
    close(turned, box);
  });

  it("a half turn is two quarter turns", () => {
    close(rotateScanBox(rotateScanBox(box, 90), 90), rotateScanBox(box, 180));
  });
});

describe("scanSourceLetter", () => {
  it("letters the uploaded files A, B … Z, AA", () => {
    expect([0, 1, 25, 26, 27].map(scanSourceLetter)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
    ]);
  });
});
