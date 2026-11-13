import { PDFDocument } from "pdf-lib";
import {
  Prisma,
  type PrismaClient,
} from "@/app/generated/prisma/client";
import {
  nextSourceLetter,
  parseScanChoices,
  parseScanPages,
  parseScanSources,
} from "@/lib/ticket-scan/batch-state";
import { planScan, type ScanTicketFacts } from "@/lib/ticket-scan/plan";
import {
  countPdfPages,
  readScanPages,
  scanReaderFault,
  scanReaderProblem,
} from "@/lib/ticket-scan/reader";
import {
  deleteScanFolder,
  deleteScanSource,
  newScanSourceId,
  readScanSource,
  writeScanSource,
} from "@/lib/ticket-scan/storage";
import {
  normalizeScanRotation,
  normalizeTicketNumber,
  type ScanPage,
  type ScanSource,
  type ScanTicketChoice,
  type ScanTicketChoices,
} from "@/lib/ticket-scan/types";
import { assertUploadAllowed } from "@/lib/upload-validation";

/**
 * The scan being worked on (Invoices → Scan In): saving the uploaded PDFs,
 * reading their pages, and every change made on the grid before File.
 *
 * There is at most one OPEN TicketScanBatch. Its pages, choices and files are
 * JSON on the row, saved with a compare-and-set on `version`, so two people
 * (or two tabs) working the same scan cannot overwrite each other.
 */

/** A message meant for the person at the screen, as is. */
export class ScanInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanInError";
  }
}

/** One scanned PDF can be this big (the upload limit of the app is 100 MB). */
export const MAX_SCAN_FILE_BYTES = 90 * 1024 * 1024;
/** Pages waiting in the scan at once; File clears them out. */
export const MAX_OPEN_SCAN_PAGES = 400;
/** File holds the scan this long at most; after that the lock is abandoned. */
export const FILING_LOCK_STALE_MS = 10 * 60 * 1000;

const PDF_EXTENSIONS = [".pdf"] as const;
const SAVE_ATTEMPTS = 6;
/** pg_advisory_xact_lock key: only one "open the scan" at a time. */
const OPEN_SCAN_LOCK_KEY = 7_311_302;

export const SCAN_GONE_MESSAGE =
  "This scan is no longer open. It was filed or removed from another screen.";
const SCAN_BUSY_MESSAGE =
  "This scan is being filed right now. Give it a moment and try again.";
const SCAN_CHANGING_MESSAGE =
  "Someone else is changing this scan right now. Try again.";

export type OpenScanState = {
  id: string;
  version: number;
  nextSeq: number;
  sources: ScanSource[];
  pages: ScanPage[];
  choices: ScanTicketChoices;
  filingStartedAt: Date | null;
};

type BatchRow = {
  id: string;
  status: string;
  version: number;
  nextSeq: number;
  sourcesJson: unknown;
  pagesJson: unknown;
  choicesJson: unknown;
  filingStartedAt: Date | null;
};

const OPEN_BATCH_SELECT = {
  id: true,
  status: true,
  version: true,
  nextSeq: true,
  sourcesJson: true,
  pagesJson: true,
  choicesJson: true,
  filingStartedAt: true,
} as const;

function toState(row: BatchRow): OpenScanState {
  return {
    id: row.id,
    version: row.version,
    nextSeq: row.nextSeq,
    sources: parseScanSources(row.sourcesJson),
    pages: parseScanPages(row.pagesJson),
    choices: parseScanChoices(row.choicesJson),
    filingStartedAt: row.filingStartedAt,
  };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** True while File is running on the scan (and has not been abandoned). */
export function isFilingNow(filingStartedAt: Date | null): boolean {
  return (
    filingStartedAt != null &&
    Date.now() - filingStartedAt.getTime() < FILING_LOCK_STALE_MS
  );
}

/** The scan being worked on, or null when nothing is waiting. */
export async function loadOpenScan(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<OpenScanState | null> {
  const row = await client.ticketScanBatch.findFirst({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    select: OPEN_BATCH_SELECT,
  });
  return row ? toState(row) : null;
}

/**
 * Loads the open scan, hands it to `change` to edit in place, and saves it
 * if nobody else saved in between; otherwise loads again and retries.
 * Refuses while File is running on the scan.
 */
export async function changeOpenScan<T>(
  client: PrismaClient,
  batchId: string,
  change: (state: OpenScanState) => T | Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const row = await client.ticketScanBatch.findUnique({
      where: { id: batchId },
      select: OPEN_BATCH_SELECT,
    });
    if (!row || row.status !== "OPEN") {
      throw new ScanInError(SCAN_GONE_MESSAGE);
    }
    if (isFilingNow(row.filingStartedAt)) {
      throw new ScanInError(SCAN_BUSY_MESSAGE);
    }
    const state = toState(row);
    const result = await change(state);
    const saved = await client.ticketScanBatch.updateMany({
      where: { id: batchId, status: "OPEN", version: row.version },
      data: {
        sourcesJson: asJson(state.sources),
        pagesJson: asJson(state.pages),
        choicesJson: asJson(state.choices),
        nextSeq: state.nextSeq,
        version: { increment: 1 },
      },
    });
    if (saved.count === 1) {
      return result;
    }
  }
  throw new ScanInError(SCAN_CHANGING_MESSAGE);
}

async function openOrCreateScan(
  client: PrismaClient,
  uploadedBy: string | null,
): Promise<string> {
  return client.$transaction(async (tx) => {
    // Two uploads at the same moment must land in the same scan.
    // (Cast to text: Prisma cannot read the function's "void" result.)
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${OPEN_SCAN_LOCK_KEY})::text AS locked`;
    const existing = await tx.ticketScanBatch.findFirst({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
    const created = await tx.ticketScanBatch.create({
      data: {
        status: "OPEN",
        sourcesJson: [],
        pagesJson: [],
        choicesJson: {},
        uploadedBy,
      },
      select: { id: true },
    });
    return created.id;
  });
}

function looksLikePdf(bytes: Uint8Array): boolean {
  // "%PDF-" within the first kilobyte (some scanners put a few bytes before it).
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

export type AddScanFilesResult = {
  batchId: string;
  added: { fileName: string; pageCount: number }[];
  /** Files left out, with the reason, in plain words. */
  skipped: string[];
};

/**
 * Adds uploaded PDFs to the scan being worked on (starting one if there is
 * none). Nothing is read yet: the screen asks for that in small bites with
 * `readNextScanPages`, so it can show progress.
 */
export async function addScanFiles(
  client: PrismaClient,
  files: File[],
  uploadedBy: string | null,
): Promise<AddScanFilesResult> {
  if (files.length === 0) {
    throw new ScanInError("Choose the scanned PDF to add.");
  }

  type Checked = { file: File; bytes: Buffer; pageCount: number };
  const checked: Checked[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    try {
      assertUploadAllowed(file, {
        maxBytes: MAX_SCAN_FILE_BYTES,
        allowedExtensions: PDF_EXTENSIONS,
      });
    } catch (error) {
      skipped.push(
        `${file.name}: ${error instanceof Error ? error.message : "not allowed"}`,
      );
      continue;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!looksLikePdf(bytes)) {
      skipped.push(`${file.name}: this is not a PDF. Scan to PDF and drop that file.`);
      continue;
    }
    let pageCount = 0;
    try {
      pageCount = await countPdfPages(bytes);
      // File splits the pages with pdf-lib: make sure it can open this too.
      await PDFDocument.load(bytes, { updateMetadata: false });
    } catch {
      // Is it this PDF, or the reader on the server? A reader that cannot
      // open its own test page is the fault, and no scan will do better.
      const readerFault = await scanReaderFault();
      if (readerFault) {
        console.error("[ticket scan] the scan reader is not working", readerFault.error);
        skipped.push(`${file.name}: ${scanReaderProblem(readerFault.error)}`);
      } else {
        skipped.push(
          `${file.name}: this PDF could not be opened (it may be damaged or password protected).`,
        );
      }
      continue;
    }
    if (pageCount < 1) {
      skipped.push(`${file.name}: this PDF has no pages.`);
      continue;
    }
    checked.push({ file, bytes, pageCount });
  }

  if (checked.length === 0) {
    throw new ScanInError(skipped.join(" "));
  }

  const batchId = await openOrCreateScan(client, uploadedBy);
  const added: AddScanFilesResult["added"] = [];
  for (const { file, bytes, pageCount } of checked) {
    const sourceId = newScanSourceId();
    await writeScanSource(batchId, sourceId, bytes);
    let reason: string | null;
    try {
      reason = await changeOpenScan(client, batchId, (state): string | null => {
        if (
          state.sources.some(
            (source) =>
              source.fileName === file.name && source.fileSize === file.size,
          )
        ) {
          return `${file.name} is already in this scan.`;
        }
        if (state.pages.length + pageCount > MAX_OPEN_SCAN_PAGES) {
          return `${file.name}: a scan can hold ${MAX_OPEN_SCAN_PAGES} pages at a time. File what is here first, then drop this one.`;
        }
        state.sources.push({
          id: sourceId,
          letter: nextSourceLetter(state.sources),
          fileName: file.name,
          pageCount,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy,
        });
        for (let page = 1; page <= pageCount; page += 1) {
          state.pages.push({
            seq: state.nextSeq,
            sourceId,
            sourcePage: page,
            read: false,
            blank: false,
            code: null,
            codeBox: null,
            rotation: 0,
            readNote: null,
            typedTicketNumber: null,
            typedVia: null,
            skipped: false,
            preferred: false,
          });
          state.nextSeq += 1;
        }
        return null;
      });
    } catch (error) {
      await deleteScanSource(batchId, sourceId).catch(() => undefined);
      throw error;
    }
    if (reason) {
      await deleteScanSource(batchId, sourceId).catch(() => undefined);
      skipped.push(reason);
    } else {
      added.push({ fileName: file.name, pageCount });
    }
  }

  await removeScanIfEmpty(client, batchId);
  return { batchId, added, skipped };
}

/** Drops the open scan's row and folder once it holds no pages. */
export async function removeScanIfEmpty(
  client: PrismaClient,
  batchId: string,
): Promise<boolean> {
  const row = await client.ticketScanBatch.findUnique({
    where: { id: batchId },
    select: { status: true, pagesJson: true, version: true },
  });
  if (!row || row.status !== "OPEN" || parseScanPages(row.pagesJson).length > 0) {
    return false;
  }
  const removed = await client.ticketScanBatch.deleteMany({
    where: { id: batchId, status: "OPEN", version: row.version },
  });
  if (removed.count === 0) {
    return false;
  }
  await deleteScanFolder(batchId).catch(() => undefined);
  return true;
}

/**
 * Reads the next few pages nobody has looked at yet. Returns how many are
 * still waiting, so the screen keeps calling until it is 0.
 */
export async function readNextScanPages(
  client: PrismaClient,
  batchId: string,
  limit = 4,
): Promise<{ read: number; remaining: number }> {
  const row = await client.ticketScanBatch.findUnique({
    where: { id: batchId },
    select: OPEN_BATCH_SELECT,
  });
  if (!row || row.status !== "OPEN") {
    throw new ScanInError(SCAN_GONE_MESSAGE);
  }
  const state = toState(row);
  const unread = state.pages.filter((page) => !page.read);
  if (unread.length === 0 || isFilingNow(row.filingStartedAt)) {
    return { read: 0, remaining: unread.length };
  }

  // One file per call: the PDF is opened once for its pages.
  const sourceId = unread[0]!.sourceId;
  const batch = unread
    .filter((page) => page.sourceId === sourceId)
    .slice(0, Math.max(1, limit));

  let reads: Awaited<ReturnType<typeof readScanPages>>;
  try {
    const bytes = await readScanSource(batchId, sourceId);
    reads = await readScanPages(
      bytes,
      batch.map((page) => page.sourcePage),
    );
  } catch (error) {
    // The file is gone or unreadable: mark its pages so the screen moves on.
    const note =
      error instanceof Error ? error.message : "This page could not be opened";
    reads = new Map(
      batch.map((page) => [
        page.sourcePage,
        { blank: false, code: null, codeBox: null, rotation: 0 as const, readNote: note },
      ]),
    );
  }

  let applied = 0;
  const remaining = await changeOpenScan(client, batchId, (fresh) => {
    applied = 0;
    for (const target of batch) {
      const page = fresh.pages.find((entry) => entry.seq === target.seq);
      const read = reads.get(target.sourcePage);
      if (!page || page.read || !read) {
        continue;
      }
      page.read = true;
      page.blank = read.blank;
      page.code = read.code;
      page.codeBox = read.codeBox;
      page.readNote = read.readNote;
      // A turn made by hand while the page was being read stays.
      if (read.code) {
        page.rotation = read.rotation;
      }
      applied += 1;
    }
    return fresh.pages.filter((entry) => !entry.read).length;
  });
  return { read: applied, remaining };
}

function findPage(state: OpenScanState, seq: number): ScanPage {
  const page = state.pages.find((entry) => entry.seq === seq);
  if (!page) {
    throw new ScanInError(
      "That page is no longer in this scan. It was filed or removed from another screen.",
    );
  }
  return page;
}

/**
 * Finds the ticket someone typed: the number as typed, or just its digits
 * ("10189" finds T10189). Throws a plain-words error when there is no such
 * ticket, or when the digits fit more than one.
 */
export async function resolveTypedTicketNumber(
  client: PrismaClient,
  raw: string,
): Promise<string> {
  const typed = normalizeTicketNumber(raw).replace(/\s+/g, "");
  if (!typed) {
    throw new ScanInError("Type the ticket number.");
  }
  if (typed.length > 40) {
    throw new ScanInError("That is too long to be a ticket number.");
  }
  const exact = await client.deliveryTicket.findUnique({
    where: { ticketNumber: typed },
    select: { ticketNumber: true },
  });
  if (exact?.ticketNumber) {
    return exact.ticketNumber;
  }
  if (/^\d+$/.test(typed)) {
    // Digits only: any prefix, and leading zeros do not matter.
    const candidates = await client.deliveryTicket.findMany({
      where: { ticketNumber: { endsWith: typed } },
      select: { ticketNumber: true },
      take: 25,
    });
    const digits = String(Number(typed));
    const matches = candidates
      .map((candidate) => candidate.ticketNumber!)
      .filter((number) => {
        const match = /^[A-Z]{1,5}-?0*(\d+)$/.exec(number);
        return match?.[1] === digits;
      });
    if (matches.length === 1) {
      return matches[0]!;
    }
    if (matches.length > 1) {
      throw new ScanInError(
        `More than one ticket ends in ${typed}: ${matches.sort().join(", ")}. Type the whole number.`,
      );
    }
  }
  throw new ScanInError(`There is no ticket ${typed}.`);
}

/** Says which ticket a page belongs to (typed, or "Same Ticket As Above"). */
export async function setScanPageTicket(
  client: PrismaClient,
  batchId: string,
  seq: number,
  rawNumber: string,
  via: "typed" | "above",
): Promise<string> {
  const ticketNumber = await resolveTypedTicketNumber(client, rawNumber);
  await changeOpenScan(client, batchId, (state) => {
    const page = findPage(state, seq);
    page.typedTicketNumber = ticketNumber;
    page.typedVia = via;
    page.skipped = false;
  });
  return ticketNumber;
}

/** Takes a typed number back off a page. */
export async function clearScanPageTicket(
  client: PrismaClient,
  batchId: string,
  seq: number,
): Promise<void> {
  await changeOpenScan(client, batchId, (state) => {
    const page = findPage(state, seq);
    page.typedTicketNumber = null;
    page.typedVia = null;
  });
}

/** "Skip page" / "Put back". */
export async function setScanPageSkipped(
  client: PrismaClient,
  batchId: string,
  seq: number,
  skipped: boolean,
): Promise<void> {
  await changeOpenScan(client, batchId, (state) => {
    const page = findPage(state, seq);
    page.skipped = skipped;
    if (!skipped && page.blank && !page.code) {
      // Putting a page back that was dropped as blank: it is not blank to them.
      page.blank = false;
      page.readNote ??= "No code found on this page";
    }
  });
}

/** A page dropped as blank that is not: it joins the rows that need a number. */
export async function markScanPageNotBlank(
  client: PrismaClient,
  batchId: string,
  seq: number,
): Promise<void> {
  await changeOpenScan(client, batchId, (state) => {
    const page = findPage(state, seq);
    page.blank = false;
    page.readNote ??= "No code found on this page";
  });
}

/** Turns a page a quarter turn clockwise. */
export async function turnScanPage(
  client: PrismaClient,
  batchId: string,
  seq: number,
): Promise<void> {
  await changeOpenScan(client, batchId, (state) => {
    const page = findPage(state, seq);
    page.rotation = normalizeScanRotation(page.rotation + 90);
  });
}

/**
 * "Use this copy": of the pages that are the same sheet of the same ticket,
 * this one goes into the signed PDF.
 */
export async function preferScanPage(
  client: PrismaClient,
  batchId: string,
  seq: number,
): Promise<void> {
  await changeOpenScan(client, batchId, (state) => {
    const page = findPage(state, seq);
    if (!page.code) {
      throw new ScanInError("Only a page with a code can be picked this way.");
    }
    const ticket = normalizeTicketNumber(page.code.ticketNumber);
    for (const other of state.pages) {
      if (
        other.code &&
        normalizeTicketNumber(other.code.ticketNumber) === ticket &&
        other.code.pageNumber === page.code.pageNumber
      ) {
        other.preferred = false;
      }
    }
    page.preferred = true;
    page.skipped = false;
  });
}

/**
 * Saves what was chosen for a ticket on the grid (Replace, Hold, File as is,
 * Skip, the Deliver box). Passing null for a field takes that answer back.
 */
export async function setScanTicketChoice(
  client: PrismaClient,
  batchId: string,
  ticketNumber: string,
  patch: {
    already?: ScanTicketChoice["already"] | null;
    missing?: ScanTicketChoice["missing"] | null;
    cancelled?: ScanTicketChoice["cancelled"] | null;
    deliver?: boolean | null;
  },
): Promise<void> {
  const key = normalizeTicketNumber(ticketNumber);
  if (!key) {
    throw new ScanInError("Which ticket?");
  }
  await changeOpenScan(client, batchId, (state) => {
    const choice: ScanTicketChoice = { ...(state.choices[key] ?? {}) };
    if (patch.already !== undefined) {
      if (patch.already === null) delete choice.already;
      else choice.already = patch.already;
    }
    if (patch.missing !== undefined) {
      if (patch.missing === null) delete choice.missing;
      else choice.missing = patch.missing;
    }
    if (patch.cancelled !== undefined) {
      if (patch.cancelled === null) delete choice.cancelled;
      else choice.cancelled = patch.cancelled;
    }
    if (patch.deliver !== undefined) {
      if (patch.deliver === null) delete choice.deliver;
      else choice.deliver = patch.deliver;
    }
    if (Object.keys(choice).length === 0) {
      delete state.choices[key];
    } else {
      state.choices[key] = choice;
    }
  });
}

/** Takes one uploaded file, and its pages, back out of the scan. */
export async function removeScanSource(
  client: PrismaClient,
  batchId: string,
  sourceId: string,
): Promise<void> {
  await changeOpenScan(client, batchId, (state) => {
    if (!state.sources.some((source) => source.id === sourceId)) {
      throw new ScanInError("That file is no longer in this scan.");
    }
    state.sources = state.sources.filter((source) => source.id !== sourceId);
    state.pages = state.pages.filter((page) => page.sourceId !== sourceId);
    pruneChoices(state);
  });
  await deleteScanSource(batchId, sourceId).catch(() => undefined);
  await removeScanIfEmpty(client, batchId);
}

/** Throws the whole scan away: nothing in it is filed. */
export async function discardOpenScan(
  client: PrismaClient,
  batchId: string,
): Promise<void> {
  const row = await client.ticketScanBatch.findUnique({
    where: { id: batchId },
    select: { status: true, filingStartedAt: true },
  });
  if (!row || row.status !== "OPEN") {
    return;
  }
  if (isFilingNow(row.filingStartedAt)) {
    throw new ScanInError(SCAN_BUSY_MESSAGE);
  }
  await client.ticketScanBatch.deleteMany({
    where: { id: batchId, status: "OPEN" },
  });
  await deleteScanFolder(batchId).catch(() => undefined);
}

/** Forgets the answers given for tickets that have no page left in the scan. */
export function pruneChoices(state: OpenScanState): void {
  const present = new Set<string>();
  for (const page of state.pages) {
    if (page.typedTicketNumber) {
      present.add(normalizeTicketNumber(page.typedTicketNumber));
    }
    if (page.code) {
      present.add(normalizeTicketNumber(page.code.ticketNumber));
    }
  }
  for (const key of Object.keys(state.choices)) {
    if (!present.has(key)) {
      delete state.choices[key];
    }
  }
}

// ---------------------------------------------------------------------------
// What the database knows about the tickets named on the pages
// ---------------------------------------------------------------------------

export type ScanTicketRecord = ScanTicketFacts & {
  year: number | null;
  deliveryDate: Date | null;
  deliveredAt: Date | null;
  jobId: string | null;
  invoice: { id: string; invoiceNumber: string } | null;
  /** The current signed copy's file, relative to storage/signed-tickets. */
  signedFilePath: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  LOADING: "Loading",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "11-10": a day as the Scan In grid shows it. */
export function formatMonthDay(date: Date): string {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "11-12-2026, 4:42 PM": when a scan was filed. */
export function formatFiledMoment(date: Date): string {
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}, ${hour12}:${pad(date.getMinutes())} ${hours < 12 ? "AM" : "PM"}`;
}

export function ticketStatusLabel(status: string, deliveredAt: Date | null): string {
  const label = STATUS_LABELS[status] ?? status;
  return status === "DELIVERED" && deliveredAt
    ? `${label} ${formatMonthDay(deliveredAt)}`
    : label;
}

/** Every ticket number that appears on a page, typed or read. */
export function ticketNumbersOnPages(pages: ScanPage[]): string[] {
  const numbers = new Set<string>();
  for (const page of pages) {
    if (page.typedTicketNumber) {
      numbers.add(normalizeTicketNumber(page.typedTicketNumber));
    }
    if (page.code) {
      numbers.add(normalizeTicketNumber(page.code.ticketNumber));
    }
  }
  return [...numbers];
}

/** Tickets by normalized number, for `planScan` and for filing. */
export async function loadScanTickets(
  client: PrismaClient | Prisma.TransactionClient,
  ticketNumbers: string[],
): Promise<Map<string, ScanTicketRecord>> {
  const records = new Map<string, ScanTicketRecord>();
  if (ticketNumbers.length === 0) {
    return records;
  }
  const tickets = await client.deliveryTicket.findMany({
    where: { ticketNumber: { in: ticketNumbers } },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      customerName: true,
      projectName: true,
      year: true,
      deliveryDate: true,
      deliveredAt: true,
      jobId: true,
      invoice: { select: { id: true, invoiceNumber: true } },
      signedFiles: {
        where: { isCurrent: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, filePath: true, createdAt: true },
      },
    },
  });
  for (const ticket of tickets) {
    if (!ticket.ticketNumber) {
      continue;
    }
    const signed = ticket.signedFiles[0] ?? null;
    records.set(normalizeTicketNumber(ticket.ticketNumber), {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      statusLabel: ticketStatusLabel(ticket.status, ticket.deliveredAt),
      customerName: ticket.customerName,
      projectName: ticket.projectName,
      signed: signed
        ? { fileId: signed.id, filedOn: formatMonthDay(signed.createdAt) }
        : null,
      year: ticket.year,
      deliveryDate: ticket.deliveryDate,
      deliveredAt: ticket.deliveredAt,
      jobId: ticket.jobId,
      invoice: ticket.invoice,
      signedFilePath: signed?.filePath ?? null,
    });
  }
  return records;
}

/** The open scan with its plan: what each page is and what File would do. */
export async function loadOpenScanPlan(client: PrismaClient): Promise<{
  state: OpenScanState;
  tickets: Map<string, ScanTicketRecord>;
  plan: ReturnType<typeof planScan>;
} | null> {
  const state = await loadOpenScan(client);
  if (!state) {
    return null;
  }
  const tickets = await loadScanTickets(client, ticketNumbersOnPages(state.pages));
  const plan = planScan({ pages: state.pages, choices: state.choices, tickets });
  return { state, tickets, plan };
}
