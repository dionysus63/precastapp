import {
  normalizeScanRotation,
  scanSourceLetter,
  type FiledScanPage,
  type FiledScanPageOutcome,
  type FiledScanResult,
  type FiledScanTicket,
  type ScanBox,
  type ScanPage,
  type ScanPageCode,
  type ScanSource,
  type ScanTicketChoice,
  type ScanTicketChoices,
} from "@/lib/ticket-scan/types";

/**
 * Reads the JSON columns of a TicketScanBatch row back into their shapes.
 * Anything that does not look right is dropped rather than trusted: these
 * values come out of the database as `unknown`.
 */

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function parseBox(value: unknown): ScanBox | null {
  if (!isObject(value)) {
    return null;
  }
  const { left, top, width, height } = value;
  if (
    typeof left !== "number" ||
    typeof top !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }
  return { left, top, width, height };
}

function parseCode(value: unknown): ScanPageCode | null {
  if (!isObject(value)) {
    return null;
  }
  const ticketNumber = asString(value.ticketNumber);
  const copyNumber = asInt(value.copyNumber);
  const pageNumber = asInt(value.pageNumber);
  const pageCount = asInt(value.pageCount);
  const check = asString(value.check);
  if (
    !ticketNumber ||
    copyNumber == null ||
    pageNumber == null ||
    pageCount == null ||
    check == null
  ) {
    return null;
  }
  return { ticketNumber, copyNumber, pageNumber, pageCount, check };
}

export function parseScanSources(json: unknown): ScanSource[] {
  if (!Array.isArray(json)) {
    return [];
  }
  const sources: ScanSource[] = [];
  for (const entry of json) {
    if (!isObject(entry)) {
      continue;
    }
    const id = asString(entry.id);
    const fileName = asString(entry.fileName);
    if (!id || !fileName) {
      continue;
    }
    sources.push({
      id,
      letter: asString(entry.letter) || scanSourceLetter(sources.length),
      fileName,
      pageCount: asInt(entry.pageCount) ?? 0,
      fileSize: asInt(entry.fileSize) ?? 0,
      uploadedAt: asString(entry.uploadedAt) ?? "",
      uploadedBy: asString(entry.uploadedBy),
    });
  }
  return sources;
}

export function parseScanPages(json: unknown): ScanPage[] {
  if (!Array.isArray(json)) {
    return [];
  }
  const pages: ScanPage[] = [];
  for (const entry of json) {
    if (!isObject(entry)) {
      continue;
    }
    const seq = asInt(entry.seq);
    const sourceId = asString(entry.sourceId);
    const sourcePage = asInt(entry.sourcePage);
    if (seq == null || !sourceId || sourcePage == null) {
      continue;
    }
    const typedVia = entry.typedVia === "above" ? "above" : "typed";
    const typedTicketNumber = asString(entry.typedTicketNumber);
    pages.push({
      seq,
      sourceId,
      sourcePage,
      read: entry.read === true,
      blank: entry.blank === true,
      code: parseCode(entry.code),
      codeBox: parseBox(entry.codeBox),
      rotation: normalizeScanRotation(asInt(entry.rotation) ?? 0),
      readNote: asString(entry.readNote),
      typedTicketNumber: typedTicketNumber || null,
      typedVia: typedTicketNumber ? typedVia : null,
      skipped: entry.skipped === true,
      preferred: entry.preferred === true,
    });
  }
  return pages.sort((a, b) => a.seq - b.seq);
}

export function parseScanChoices(json: unknown): ScanTicketChoices {
  if (!isObject(json)) {
    return {};
  }
  const choices: ScanTicketChoices = {};
  for (const [ticketNumber, value] of Object.entries(json)) {
    if (!isObject(value)) {
      continue;
    }
    const choice: ScanTicketChoice = {};
    if (value.already === "replace" || value.already === "skip") {
      choice.already = value.already;
    }
    if (value.missing === "hold" || value.missing === "file") {
      choice.missing = value.missing;
    }
    if (value.cancelled === "file" || value.cancelled === "skip") {
      choice.cancelled = value.cancelled;
    }
    if (typeof value.deliver === "boolean") {
      choice.deliver = value.deliver;
    }
    if (Object.keys(choice).length > 0) {
      choices[ticketNumber] = choice;
    }
  }
  return choices;
}

const FILED_OUTCOMES: readonly FiledScanPageOutcome[] = [
  "filed",
  "skipped",
  "blank",
  "extra",
  "leftOut",
];

export function parseFiledScanPages(json: unknown): FiledScanPage[] {
  if (!Array.isArray(json)) {
    return [];
  }
  const pages: FiledScanPage[] = [];
  for (const entry of json) {
    if (!isObject(entry)) {
      continue;
    }
    const seq = asInt(entry.seq);
    const outcome = FILED_OUTCOMES.find((value) => value === entry.outcome);
    if (seq == null || !outcome) {
      continue;
    }
    pages.push({
      seq,
      pgLabel: asString(entry.pgLabel) ?? String(seq),
      outcome,
      ticketNumber: asString(entry.ticketNumber),
      ticketId: asString(entry.ticketId),
      copy: asString(entry.copy) ?? "",
      sheet: asString(entry.sheet) ?? "",
      notes: asStrings(entry.notes),
      signedFileId: asString(entry.signedFileId),
      filePage: asInt(entry.filePage),
    });
  }
  return pages.sort((a, b) => a.seq - b.seq);
}

function parseFiledTicket(value: unknown): FiledScanTicket | null {
  if (!isObject(value)) {
    return null;
  }
  const ticketId = asString(value.ticketId);
  const ticketNumber = asString(value.ticketNumber);
  const signedFileId = asString(value.signedFileId);
  if (!ticketId || !ticketNumber || !signedFileId) {
    return null;
  }
  const jobFolderCopy =
    value.jobFolderCopy === "saved" || value.jobFolderCopy === "failed"
      ? value.jobFolderCopy
      : "none";
  return {
    ticketId,
    ticketNumber,
    signedFileId,
    filePath: asString(value.filePath) ?? "",
    pageCount: asInt(value.pageCount) ?? 0,
    deliverRequested: value.deliverRequested === true,
    markedDelivered: value.markedDelivered === true,
    invoiceMade: value.invoiceMade === true,
    replaced: value.replaced === true,
    jobFolderCopy,
    warnings: asStrings(value.warnings),
  };
}

export function parseFiledScanResult(json: unknown): FiledScanResult {
  const result: FiledScanResult = { tickets: [], failures: [], fromScanId: null };
  if (!isObject(json)) {
    return result;
  }
  result.fromScanId = asString(json.fromScanId);
  if (Array.isArray(json.tickets)) {
    for (const entry of json.tickets) {
      const ticket = parseFiledTicket(entry);
      if (ticket) {
        result.tickets.push(ticket);
      }
    }
  }
  if (Array.isArray(json.failures)) {
    for (const entry of json.failures) {
      if (!isObject(entry)) {
        continue;
      }
      const ticketNumber = asString(entry.ticketNumber);
      const error = asString(entry.error);
      if (ticketNumber && error) {
        result.failures.push({ ticketNumber, error });
      }
    }
  }
  return result;
}

/** The letter for the next file dropped into a scan: the first one not used. */
export function nextSourceLetter(sources: ScanSource[]): string {
  const used = new Set(sources.map((source) => source.letter));
  for (let index = 0; ; index += 1) {
    const letter = scanSourceLetter(index);
    if (!used.has(letter)) {
      return letter;
    }
  }
}

/**
 * The Pg column for every page of a scan: the page's number in its own file,
 * with the file's letter in front when the scan holds more than one file (or
 * held more than one: a lone file "B" keeps its letter, so the page that was
 * B3 before the rest was filed is still B3).
 */
export function buildPgLabels(
  sources: ScanSource[],
  pages: Pick<ScanPage, "seq" | "sourceId" | "sourcePage">[],
): Map<number, string> {
  const labels = new Map<number, string>();
  const showLetters =
    sources.length > 1 || sources.some((source) => source.letter !== "A");
  const letterById = new Map(sources.map((source) => [source.id, source.letter]));
  for (const page of pages) {
    const letter = showLetters ? (letterById.get(page.sourceId) ?? "") : "";
    labels.set(page.seq, `${letter}${page.sourcePage}`);
  }
  return labels;
}
