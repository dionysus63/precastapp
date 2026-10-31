// One-Off drill sheets saved to finish later (Quotes → One-Off).
//
// A draft is the page's working state — job pick, shape choice and both
// grids — serialized as JSON into `OneOffDraft.draftJson`, modelled on the
// parked load plans (SavedLoadPlan). Nothing in a draft is a real structure;
// creating the sheets from it removes the draft.
//
// Safe to import from both server and client modules.

import {
  ONE_OFF_MAX_OPENINGS,
  ONE_OFF_MAX_ROWS,
  createEmptySection,
  createEmptySetup,
  createOpeningCell,
  type OneOffRow,
  type OneOffSection,
  type OneOffSetup,
  type OneOffShapeChoice,
} from "@/lib/quotes/one-off-drill-sheets";
import { RECT_WALLS, type RectWall } from "@/lib/rect-structure";

export type OneOffJobDetails = {
  id: string;
  jobNumber: string;
  customerName: string;
  projectName: string;
  projectAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** Structure numbers already on the job, so new ones don't collide. */
  structureNumbers: string[];
  /** Saved drill sheets on the job, which the One-Off page can edit. */
  sheetCount: number;
};

export type OneOffNewJobInput = {
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

/**
 * The job step as stored in a draft. An existing job is kept by id only and
 * reloaded on resume, so its address and taken numbers are never stale.
 */
export type OneOffDraftJob =
  | { mode: "existing"; jobId: string }
  | { mode: "new"; fields: OneOffNewJobInput; customerLabel: string };

export const ONE_OFF_DRAFT_VERSION = 1;
export const ONE_OFF_DRAFT_NAME_MAX = 80;

export type OneOffDraftState = {
  version: typeof ONE_OFF_DRAFT_VERSION;
  job: OneOffDraftJob | null;
  jobConfirmed: boolean;
  shapeChoice: OneOffShapeChoice | null;
  /** With "Both", whether the rectangular step has been opened. */
  rectUnlocked: boolean;
  circular: OneOffSection;
  rect: OneOffSection;
};

/** One row of the saved-drafts list. */
export type OneOffDraftSummary = {
  id: string;
  name: string;
  /** "J26-0412 — Main St (ACME)" or "New job — …"; empty when no job yet. */
  jobLabel: string;
  /** Null when the draft's existing job has since been deleted. */
  jobMissing: boolean;
  shapeChoice: OneOffShapeChoice | null;
  rowCount: number;
  savedBy: string | null;
  /** ISO timestamp of the last save. */
  savedAt: string;
};

/** A draft loaded for the page, with its existing job reloaded. */
export type OneOffResumedDraft = {
  id: string;
  name: string;
  savedBy: string | null;
  savedAt: string;
  state: OneOffDraftState;
  /** The reloaded job for an existing-job draft; null if none or deleted. */
  job: OneOffJobDetails | null;
  /** True when the draft pointed at a job that no longer exists. */
  jobMissing: boolean;
};

export type OneOffDraftSaveResult = {
  id: string;
  name: string;
  savedBy: string | null;
  savedAt: string;
};

// ---------------------------------------------------------------------------
// Serialize / parse
// ---------------------------------------------------------------------------

export function serializeOneOffDraftState(state: OneOffDraftState): string {
  return JSON.stringify(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseSetup(value: unknown, fallback: OneOffSetup): OneOffSetup {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    templateId: str(value.templateId),
    diameterFeet: str(value.diameterFeet),
    castingProductId: str(value.castingProductId),
    pipeType: str(value.pipeType),
    pipeSize: str(value.pipeSize),
    quantity: str(value.quantity),
    prefix: str(value.prefix, fallback.prefix),
    startNumber: str(value.startNumber, fallback.startNumber),
  };
}

function parseWall(value: unknown, index: number): RectWall {
  return RECT_WALLS.includes(value as RectWall)
    ? (value as RectWall)
    : createOpeningCell(index).wall;
}

function parseRow(value: unknown, openingCount: number): OneOffRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = str(value.id).trim();
  if (!id) {
    return null;
  }
  const rawOpenings = Array.isArray(value.openings) ? value.openings : [];
  const row: OneOffRow = {
    id,
    structureNumber: str(value.structureNumber),
    templateId: str(value.templateId),
    diameterFeet: str(value.diameterFeet),
    castingProductId: str(value.castingProductId),
    pipeType: str(value.pipeType),
    pipeSize: str(value.pipeSize),
    rimElevation: str(value.rimElevation),
    openings: Array.from({ length: openingCount }, (_, index) => {
      const cell: unknown = rawOpenings[index];
      if (!isRecord(cell)) {
        return createOpeningCell(index);
      }
      return {
        invert: str(cell.invert),
        angle: str(cell.angle),
        wall: parseWall(cell.wall, index),
      };
    }),
  };
  if (typeof value.insideLengthFeet === "string") {
    row.insideLengthFeet = value.insideLengthFeet;
  }
  if (typeof value.insideWidthFeet === "string") {
    row.insideWidthFeet = value.insideWidthFeet;
  }
  return row;
}

function parseSection(
  value: unknown,
  shape: "CIRCULAR" | "RECTANGULAR",
): OneOffSection {
  const empty = createEmptySection(shape);
  if (!isRecord(value)) {
    return empty;
  }
  const rawCount = Number(value.openingCount);
  const openingCount =
    Number.isInteger(rawCount) && rawCount >= 1
      ? Math.min(ONE_OFF_MAX_OPENINGS, rawCount)
      : empty.openingCount;
  const rows = Array.isArray(value.rows)
    ? value.rows
        .slice(0, ONE_OFF_MAX_ROWS)
        .map((row) => parseRow(row, openingCount))
        .filter((row): row is OneOffRow => row != null)
    : null;
  return {
    setup: parseSetup(value.setup, createEmptySetup(shape)),
    rows,
    openingCount,
  };
}

function parseNewJobFields(value: unknown): OneOffNewJobInput {
  const fields = isRecord(value) ? value : {};
  return {
    customerId: nullableStr(fields.customerId),
    customerName: str(fields.customerName),
    projectName: str(fields.projectName),
    projectAddress: str(fields.projectAddress),
    city: str(fields.city),
    state: str(fields.state),
    zip: str(fields.zip),
    contactName: str(fields.contactName),
    contactPhone: str(fields.contactPhone),
    contactEmail: str(fields.contactEmail),
  };
}

function parseJob(value: unknown): OneOffDraftJob | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.mode === "existing") {
    const jobId = str(value.jobId).trim();
    return jobId ? { mode: "existing", jobId } : null;
  }
  if (value.mode === "new") {
    return {
      mode: "new",
      fields: parseNewJobFields(value.fields),
      customerLabel: str(value.customerLabel),
    };
  }
  return null;
}

function parseShapeChoice(value: unknown): OneOffShapeChoice | null {
  return value === "CIRCULAR" || value === "RECTANGULAR" || value === "BOTH"
    ? value
    : null;
}

/**
 * Rebuilds a draft state from stored or client-sent JSON, dropping anything
 * malformed rather than failing, so a draft always opens. Returns null only
 * when the value isn't a draft at all.
 */
export function parseOneOffDraftState(value: unknown): OneOffDraftState | null {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(raw)) {
    return null;
  }
  const job = parseJob(raw.job);
  return {
    version: ONE_OFF_DRAFT_VERSION,
    job,
    jobConfirmed: raw.jobConfirmed === true && job != null,
    shapeChoice: parseShapeChoice(raw.shapeChoice),
    rectUnlocked: raw.rectUnlocked === true,
    circular: parseSection(raw.circular, "CIRCULAR"),
    rect: parseSection(raw.rect, "RECTANGULAR"),
  };
}

// ---------------------------------------------------------------------------
// Describing a draft
// ---------------------------------------------------------------------------

/** Rows the draft would create: both grids with "Both", else the chosen one. */
export function countDraftRows(state: OneOffDraftState): number {
  const circular =
    state.shapeChoice === "CIRCULAR" || state.shapeChoice === "BOTH"
      ? (state.circular.rows?.length ?? 0)
      : 0;
  const rect =
    state.shapeChoice === "RECTANGULAR" || state.shapeChoice === "BOTH"
      ? (state.rect.rows?.length ?? 0)
      : 0;
  return circular + rect;
}

export function describeDraftShape(choice: OneOffShapeChoice | null): string {
  switch (choice) {
    case "CIRCULAR":
      return "Circular";
    case "RECTANGULAR":
      return "Rectangular";
    case "BOTH":
      return "Circular + rectangular";
    default:
      return "No structure type yet";
  }
}

/** Line used for an existing job in summaries and default draft names. */
export function describeDraftExistingJob(job: {
  jobNumber: string;
  projectName: string;
  customerName: string;
}): string {
  return `${job.jobNumber} — ${job.projectName} (${job.customerName})`;
}

/**
 * The job line for a draft. `existingJob` is the reloaded job for an
 * existing-job draft (null when it no longer exists).
 */
export function describeDraftJob(
  job: OneOffDraftJob | null,
  existingJob: { jobNumber: string; projectName: string; customerName: string } | null,
): string {
  if (!job) {
    return "";
  }
  if (job.mode === "existing") {
    return existingJob ? describeDraftExistingJob(existingJob) : "Job no longer exists";
  }
  const contractor = job.customerLabel || job.fields.customerName;
  const project = job.fields.projectName.trim();
  if (!project && !contractor) {
    return "New job";
  }
  return `New job — ${project || "untitled"}${contractor ? ` (${contractor})` : ""}`;
}

/** Suggested name for a draft that hasn't been named: the job, else the date. */
export function defaultDraftName(jobLabel: string, savedOn = new Date()): string {
  const base =
    jobLabel.trim() ||
    `One-Off ${savedOn.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  return normalizeDraftName(base);
}

/** Trims and caps a typed draft name; empty stays empty for the caller. */
export function normalizeDraftName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, ONE_OFF_DRAFT_NAME_MAX);
}
