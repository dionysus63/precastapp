/**
 * Shared rules for Jobs → Import Existing Job: bringing a job that was quoted
 * and submitted outside the app (Excel, PDFs) in one pass. Pure and
 * client-safe; the server action re-checks everything it receives.
 */

export type ImportPhase =
  | "QUOTED"
  | "AWARDED"
  | "SUBMITTED"
  | "APPROVED"
  | "IN_PRODUCTION"
  | "SHIPPING";

export type ImportStructureStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "APPROVED"
  | "IN_PRODUCTION"
  | "MADE"
  | "SHIPPED";

export type ImportJobStatus = "QUOTING" | "AWARDED" | "ACTIVE";

export type ImportPhaseOption = {
  value: ImportPhase;
  title: string;
  description: string;
  /** Starting status for every structure; null = quote only, no structures. */
  structureStatus: ImportStructureStatus | null;
  jobStatus: ImportJobStatus;
};

export const IMPORT_PHASES: ImportPhaseOption[] = [
  {
    value: "QUOTED",
    title: "Quoted",
    description: "Quote is out, waiting to hear if we got it.",
    structureStatus: null,
    jobStatus: "QUOTING",
  },
  {
    value: "AWARDED",
    title: "Awarded",
    description: "We got it. Submittals not sent yet.",
    structureStatus: "NOT_SUBMITTED",
    jobStatus: "AWARDED",
  },
  {
    value: "SUBMITTED",
    title: "Submittals out",
    description: "Submittals sent, waiting on approval.",
    structureStatus: "SUBMITTED",
    jobStatus: "AWARDED",
  },
  {
    value: "APPROVED",
    title: "Approved",
    description: "Approved, nothing poured yet.",
    structureStatus: "APPROVED",
    jobStatus: "AWARDED",
  },
  {
    value: "IN_PRODUCTION",
    title: "In production",
    description: "Some or all structures are being made.",
    structureStatus: "IN_PRODUCTION",
    jobStatus: "ACTIVE",
  },
  {
    value: "SHIPPING",
    title: "Shipping",
    description: "Some structures already made or delivered.",
    structureStatus: "MADE",
    jobStatus: "ACTIVE",
  },
];

export function getImportPhase(value: ImportPhase): ImportPhaseOption {
  return IMPORT_PHASES.find((phase) => phase.value === value) ?? IMPORT_PHASES[0]!;
}

export const IMPORT_STRUCTURE_STATUSES: {
  value: ImportStructureStatus;
  label: string;
}[] = [
  { value: "NOT_SUBMITTED", label: "Not submitted" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "MADE", label: "Made" },
  { value: "SHIPPED", label: "Shipped (delivered outside the app)" },
];

export function isImportStructureStatus(
  value: unknown,
): value is ImportStructureStatus {
  return IMPORT_STRUCTURE_STATUSES.some((status) => status.value === value);
}

export function isImportPhase(value: unknown): value is ImportPhase {
  return IMPORT_PHASES.some((phase) => phase.value === value);
}

/** The paperwork kinds a structure can carry, in grid column order. */
export type ImportDocKind = "DRILL_SHEET" | "SUBMITTAL" | "APPROVED_SUBMITTAL";

export const IMPORT_DOC_KINDS: {
  value: ImportDocKind;
  label: string;
  /** JobStructureDocument type the attached file is saved as. */
  documentType: "PRODUCTION_DRAWING" | "JOB_SPECIFIC_SUBMITTAL" | "APPROVED_SUBMITTAL";
  /** Suffix for a file cut out of a combined PDF. */
  fileSuffix: string;
}[] = [
  {
    value: "DRILL_SHEET",
    label: "Drill sheet",
    documentType: "PRODUCTION_DRAWING",
    fileSuffix: "Drill Sheet",
  },
  {
    value: "SUBMITTAL",
    label: "Submittal",
    documentType: "JOB_SPECIFIC_SUBMITTAL",
    fileSuffix: "Submittal",
  },
  {
    value: "APPROVED_SUBMITTAL",
    label: "Approved",
    documentType: "APPROVED_SUBMITTAL",
    fileSuffix: "Approved Submittal",
  },
];

/**
 * A file (or some of its pages) attached to one structure. `pages` are
 * 1-based; null means the whole file.
 */
export type ImportDocRef = { fileKey: string; pages: number[] | null };

export type ImportStructureRow = {
  kind: "STRUCTURE";
  key: string;
  structureNumber: string;
  description: string;
  quantity: string;
  unitPrice: string;
  weightLbs: string;
  status: ImportStructureStatus;
  docs: Partial<Record<ImportDocKind, ImportDocRef>>;
};

export type ImportProductRow = {
  kind: "PRODUCT";
  key: string;
  productId: string | null;
  productLabel: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unit: string;
};

export type ImportRow = ImportStructureRow | ImportProductRow;

export type ImportFileInfo = {
  key: string;
  kind: ImportDocKind | "QUOTE";
  name: string;
  /** True when one PDF covers many structures and is split by page. */
  combined: boolean;
};

/** What the wizard posts as JSON next to the files themselves. */
export type ImportJobPayload = {
  job:
    | { mode: "existing"; jobId: string }
    | {
        mode: "new";
        customerId: string | null;
        customerName: string;
        projectName: string;
        projectAddress: string;
        city: string;
        state: string;
        zip: string;
        contactName: string;
        contactPhone: string;
        contactEmail: string;
      };
  phase: ImportPhase;
  quote: {
    quoteNumber: string;
    quoteDate: string;
    taxRate: string;
  };
  files: ImportFileInfo[];
  rows: ImportRow[];
};

/** FormData field that carries a file's bytes. */
export function importFileField(fileKey: string): string {
  return `file:${fileKey}`;
}

/** "$1,234.50" / "1234.5" → 1234.5; blank or junk → null. */
export function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseQuantityInput(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Sum of qty × price over every priced row (cents-rounded). */
export function sumImportRows(rows: ImportRow[]): number {
  let cents = 0;
  for (const row of rows) {
    const quantity = parseQuantityInput(row.quantity) ?? 0;
    const price = parseMoneyInput(row.unitPrice) ?? 0;
    cents += Math.round(quantity * Math.round(price * 100));
  }
  return cents / 100;
}

/** [1,2,3,5,7,8] → "1–3, 5, 7–8". */
export function formatPageList(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let index = 1; index <= sorted.length; index += 1) {
    const page = sorted[index];
    if (page !== undefined && previous !== undefined && page === previous + 1) {
      previous = page;
      continue;
    }
    if (start !== undefined && previous !== undefined) {
      parts.push(start === previous ? String(start) : `${start}–${previous}`);
    }
    start = page;
    previous = page;
  }
  return parts.join(", ");
}

/** "1-3, 5" → [1,2,3,5]; pages past `pageCount` or junk → null. */
export function parsePageList(value: string, pageCount: number): number[] | null {
  const pages = new Set<number>();
  const pieces = value
    .split(/[,;\s]+/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  if (pieces.length === 0) {
    return null;
  }
  for (const piece of pieces) {
    const range = piece.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from < 1 || to < from || to > pageCount) {
        return null;
      }
      for (let page = from; page <= to; page += 1) {
        pages.add(page);
      }
      continue;
    }
    if (!/^\d+$/.test(piece)) {
      return null;
    }
    const page = Number(piece);
    if (page < 1 || page > pageCount) {
      return null;
    }
    pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex that finds a structure number inside a file name, forgiving the
 * separator ("MH-1", "MH 1", "MH_1", "MH1") but not a longer number ("MH-10").
 */
function structureNumberPattern(structureNumber: string): RegExp | null {
  const pieces = structureNumber
    .trim()
    .match(/[A-Za-z]+|\d+/g);
  if (!pieces || pieces.length === 0) {
    return null;
  }
  const body = pieces.map(escapeRegExp).join("[\\s_.-]*");
  return new RegExp(`(?:^|[^A-Za-z0-9])${body}(?![0-9])`, "i");
}

/**
 * Which structure a separately-dropped file belongs to, by its file name
 * ("CB-3 submittal.pdf" → CB-3). The longest matching number wins, so
 * "DMH-1" beats "MH-1". Null when nothing (or only a tie) matches.
 */
export function matchFileToStructure(
  fileName: string,
  structureNumbers: string[],
): string | null {
  const stem = fileName.replace(/\.[^.]+$/, "");
  let best: string | null = null;
  let bestLength = 0;
  let tie = false;
  for (const number of structureNumbers) {
    const pattern = structureNumberPattern(number);
    if (!pattern || !pattern.test(stem)) {
      continue;
    }
    const length = number.replace(/[^A-Za-z0-9]/g, "").length;
    if (length > bestLength) {
      best = number;
      bestLength = length;
      tie = false;
    } else if (length === bestLength && best?.toLowerCase() !== number.toLowerCase()) {
      tie = true;
    }
  }
  return tie ? null : best;
}

/**
 * "Match pages in order": spread a combined PDF's pages over the structures
 * in grid order. When the pages divide evenly every structure gets the same
 * count (14 pages, 7 structures → 2 each); otherwise one page each until
 * either runs out.
 */
export function assignPagesInOrder(
  pageCount: number,
  structureCount: number,
): number[][] {
  if (pageCount <= 0 || structureCount <= 0) {
    return [];
  }
  const perStructure =
    pageCount % structureCount === 0 ? pageCount / structureCount : 1;
  const result: number[][] = [];
  for (let index = 0; index < structureCount; index += 1) {
    const first = index * perStructure + 1;
    if (first > pageCount) {
      result.push([]);
      continue;
    }
    const pages: number[] = [];
    for (let page = first; page < first + perStructure && page <= pageCount; page += 1) {
      pages.push(page);
    }
    result.push(pages);
  }
  return result;
}

/** Fields a structure-status change stamps with today's date. */
export function statusDateFields(status: ImportStructureStatus): (
  | "submittedDate"
  | "approvedDate"
  | "productionDate"
  | "madeDate"
  | "shippedDate"
)[] {
  const order: ImportStructureStatus[] = [
    "NOT_SUBMITTED",
    "SUBMITTED",
    "APPROVED",
    "IN_PRODUCTION",
    "MADE",
    "SHIPPED",
  ];
  const reached = order.indexOf(status);
  const fields: (
    | "submittedDate"
    | "approvedDate"
    | "productionDate"
    | "madeDate"
    | "shippedDate"
  )[] = [];
  if (reached >= 1) fields.push("submittedDate");
  if (reached >= 2) fields.push("approvedDate");
  if (reached >= 3) fields.push("productionDate");
  if (reached >= 4) fields.push("madeDate");
  if (reached >= 5) fields.push("shippedDate");
  return fields;
}

/**
 * Attach separately-dropped files to the structures their names point at
 * ("CB-3.pdf" → CB-3). Only files no row uses yet, and only rows with that
 * paperwork slot still empty, so a choice made by hand is never undone.
 */
export function autoMatchFiles(
  rows: ImportRow[],
  files: Pick<ImportFileInfo, "key" | "kind" | "name" | "combined">[],
): ImportRow[] {
  const used = new Set<string>();
  for (const row of rows) {
    if (row.kind !== "STRUCTURE") {
      continue;
    }
    for (const ref of Object.values(row.docs)) {
      if (ref) {
        used.add(ref.fileKey);
      }
    }
  }
  const structureNumbers = rows
    .filter((row): row is ImportStructureRow => row.kind === "STRUCTURE")
    .map((row) => row.structureNumber.trim())
    .filter(Boolean);

  let next = rows;
  for (const file of files) {
    if (file.combined || file.kind === "QUOTE" || used.has(file.key)) {
      continue;
    }
    const kind = file.kind;
    const match = matchFileToStructure(file.name, structureNumbers);
    if (!match) {
      continue;
    }
    const index = next.findIndex(
      (row) =>
        row.kind === "STRUCTURE" &&
        row.structureNumber.trim().toLowerCase() === match.toLowerCase() &&
        !row.docs[kind],
    );
    if (index < 0) {
      continue;
    }
    const row = next[index] as ImportStructureRow;
    next = [...next];
    next[index] = { ...row, docs: { ...row.docs, [kind]: { fileKey: file.key, pages: null } } };
    used.add(file.key);
  }
  return next;
}
