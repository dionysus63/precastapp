// Quick Build drill sheets (Quotes → Quick Build, and each job's Quick Build
// tab; once called One-Off): a spreadsheet-style grid for
// knocking out a few drill sheets without building a quote first, and for
// editing them again later.
//
// Each grid row is one structure. Rows are converted to the same workbook
// rows the quote's structure workbooks use, so wall heights, warnings and the
// saved drill sheets come from the exact same calculators.

import {
  rectMoveDirections,
  rectMoveFromPlacement,
  rectMovePlacement,
  type RectMoveDirection,
} from "@/lib/rect-opening-move";
import type { RectStepsPosition } from "@/lib/rect-steps";
import type {
  DrillSheetCastingOption,
  DrillSheetTemplateOption,
} from "@/components/drill-sheets/drill-sheet-form";
import type {
  RectSheetCastingOption,
  RectSheetFormValues,
  RectSheetOpeningSizeOption,
  RectSheetTemplateOption,
} from "@/components/drill-sheets/rect-sheet-form";
import {
  WALL_HEIGHT_ADJUST_STEP_INCHES,
  type DrillSheetResult,
} from "@/lib/drill-sheet";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";
import {
  RECT_WALLS,
  RECT_WALL_LABELS,
  lookupRectOpeningSize,
  wallInsideRunFeet,
  type RectOpeningPlacement,
  type RectStructureResult,
  type RectWall,
} from "@/lib/rect-structure";
import {
  computeWorkbookRowPrice,
  createRowId,
  templateDiameterFeet,
  type QuoteStructureConfig,
  type StructureWorkbookOptions,
  type StructureWorkbookRow,
} from "@/lib/quotes/structure-workbook";
import {
  computeRectWorkbookRowDetail,
  createRectOpeningRow,
  type RectQuoteStructureConfig,
  type RectWorkbookRow,
} from "@/lib/quotes/rect-structure-workbook";

export type OneOffShape = "CIRCULAR" | "RECTANGULAR";
export type OneOffShapeChoice = OneOffShape | "BOTH";

export type OneOffCircularOptions = {
  templates: DrillSheetTemplateOption[];
  castings: DrillSheetCastingOption[];
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"];
  diameterConfigs: StructureWorkbookOptions["diameterConfigs"];
};

export type OneOffRectOptions = {
  templates: RectSheetTemplateOption[];
  castings: RectSheetCastingOption[];
  openingSizes: RectSheetOpeningSizeOption[];
};

/**
 * "Special" changes to one rectangular pipe opening, picked from a dropdown
 * under the inlet's wall. To add one: list it here, give the cell whatever
 * extra input it needs, and apply it in `rectOpeningSpecial`.
 */
export const ONE_OFF_OPENING_SPECIALS = [
  { value: "WIDEN", label: "Widen" },
  { value: "MOVE", label: "Move" },
  { value: "WIDEN_MOVE", label: "Widen + Move" },
] as const;

export type OneOffOpeningSpecial =
  | ""
  | (typeof ONE_OFF_OPENING_SPECIALS)[number]["value"];

export function isOpeningSpecial(value: unknown): value is OneOffOpeningSpecial {
  return (
    value === "" ||
    ONE_OFF_OPENING_SPECIALS.some((special) => special.value === value)
  );
}

/** True for the specials that set the opening's width (Widen, Widen + Move). */
export function specialWidens(special: OneOffOpeningSpecial | undefined): boolean {
  return special === "WIDEN" || special === "WIDEN_MOVE";
}

/** True for the specials that move the opening off center (Move, Widen + Move). */
export function specialMoves(special: OneOffOpeningSpecial | undefined): boolean {
  return special === "MOVE" || special === "WIDEN_MOVE";
}

/**
 * One pipe opening's cells in a row: invert, the inlet's own pipe (type and
 * size, since one structure can take different pipes), plus angle (circular)
 * or wall (rect). A blank pipe type or size means the row's default.
 */
export type OneOffOpeningCell = {
  invert: string;
  /** Pipe type (material) for this inlet; blank falls back to the row's. */
  pipeType: string;
  /** Pipe diameter in inches for this inlet; blank falls back to the row's. */
  pipeSize: string;
  angle: string;
  wall: RectWall;
  /** Rect only: the special change picked for this opening; blank = none. */
  special: OneOffOpeningSpecial;
  /** Widen: the opening's full width in inches (whole numbers only). */
  widenInches: string;
  /**
   * Move: which way the opening goes off the center of its wall, as the
   * sheet is read (Left / Right on the Up and Down walls, Up / Down on the
   * Left and Right walls). Blank until one is picked.
   */
  moveDirection: RectMoveDirection | "";
  /** Move: how far off center, in inches (the cell rounds to whole inches). */
  moveInches: string;
};

export type OneOffRow = {
  id: string;
  structureNumber: string;
  templateId: string;
  /** Circular only. */
  diameterFeet: string;
  castingProductId: string;
  /** Default pipe type: what new inlets start at and blank inlet cells use. */
  pipeType: string;
  /** Default pipe size, likewise. */
  pipeSize: string;
  rimElevation: string;
  /** Always `openingCount` long so every row lines up with the grid columns. */
  openings: OneOffOpeningCell[];
  /**
   * Wall height moved by hand with the grid's up/down arrows, in inches
   * (6" a click). Unset or 0 = the calculated wall height.
   */
  wallHeightAdjustInches?: number;
  /** Rect only: where the steps go; unset or blank = no steps. */
  stepsPosition?: RectStepsPosition | "";
  /**
   * Rect only: the sheet's own inside size when editing an existing sheet.
   * Unset on new rows, which take the template's first preset size.
   */
  insideLengthFeet?: string;
  insideWidthFeet?: string;
};

/** What the setup step asks for before any rows exist. */
export type OneOffSetup = {
  templateId: string;
  diameterFeet: string;
  castingProductId: string;
  pipeType: string;
  pipeSize: string;
  quantity: string;
  prefix: string;
  startNumber: string;
};

export type OneOffSection = {
  setup: OneOffSetup;
  /** Null until the setup is applied and rows are built. */
  rows: OneOffRow[] | null;
  openingCount: number;
};

export type OneOffRowResult = {
  wallHeightFeet: number | null;
  /** Brick left under the casting; null until the row calculates. */
  brickFeet?: number | null;
  status: string;
  ready: boolean;
  config: QuoteStructureConfig | RectQuoteStructureConfig | null;
  /** The full calculation behind a circular row, for the live preview. */
  circularSheet?: DrillSheetResult | null;
  /** The full calculation behind a rectangular row, for the live preview. */
  rectSheet?: RectStructureResult | null;
};

export const ONE_OFF_DEFAULT_OPENING_COUNT = 2;
export const ONE_OFF_MAX_OPENINGS = 8;
export const ONE_OFF_MAX_ROWS = 200;

/**
 * Rect openings default to distinct walls in this order: inlet A on the Down
 * wall, B on the Up wall, then Left and Right.
 */
const RECT_DEFAULT_WALLS: RectWall[] = ["DOWN", "UP", "LEFT", "RIGHT"];

/**
 * The angle a new inlet starts with. Inlet A is the one the others are
 * measured from, so it starts typed in as 0; the rest start blank. Only
 * circular sheets read the angle.
 */
function defaultOpeningAngle(index: number): string {
  return index === 0 ? "0" : "";
}

export function openingLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function createOpeningCell(
  index: number,
  pipeType = "",
  pipeSize = "",
): OneOffOpeningCell {
  return {
    invert: "",
    pipeType,
    pipeSize,
    angle: defaultOpeningAngle(index),
    wall: RECT_DEFAULT_WALLS[index % RECT_DEFAULT_WALLS.length],
    special: "",
    widenInches: "",
    moveDirection: "",
    moveInches: "",
  };
}

/**
 * Picks an inlet's special. Inputs that belong to another special are
 * cleared so a hidden value never rides along.
 */
export function setOpeningSpecial(
  row: OneOffRow,
  index: number,
  special: OneOffOpeningSpecial,
): OneOffRow {
  return {
    ...row,
    openings: row.openings.map((cell, cellIndex) =>
      cellIndex === index
        ? {
            ...cell,
            special,
            widenInches: specialWidens(special) ? cell.widenInches : "",
            moveDirection: specialMoves(special) ? cell.moveDirection : "",
            moveInches: specialMoves(special) ? cell.moveInches : "",
          }
        : cell,
    ),
  };
}

/**
 * Puts an inlet on another wall. A Move direction that the new wall does not
 * have (Left on a side wall) is cleared, so it has to be picked again.
 */
export function setOpeningWall(
  row: OneOffRow,
  index: number,
  wall: RectWall,
): OneOffRow {
  return {
    ...row,
    openings: row.openings.map((cell, cellIndex) =>
      cellIndex === index
        ? {
            ...cell,
            wall,
            moveDirection:
              cell.moveDirection !== "" &&
              rectMoveDirections(wall).includes(cell.moveDirection)
                ? cell.moveDirection
                : "",
          }
        : cell,
    ),
  };
}

/** The catalog ("standard") opening width for a rect inlet's pipe, if listed. */
export function standardRectOpeningWidth(
  openingSizes: OneOffRectOptions["openingSizes"],
  pipe: OneOffPipe,
): number | null {
  return (
    lookupRectOpeningSize(
      openingSizes,
      pipe.pipeType,
      pipe.pipeSize.trim() === "" ? null : Number(pipe.pipeSize),
    )?.openingWidthInches ?? null
  );
}

type RectOpeningSpecialResult =
  | {
      widthOverrideInches: string;
      placement: RectOpeningPlacement;
      offsetInches: string;
    }
  | { error: string };

/** A whole-looking number without a trailing ".0": 6, 16.5. */
function inchesLabel(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * Where a Move puts an inlet along its wall, or why it can't be used yet.
 * The distance is from the middle of the wall to the middle of the opening.
 * An opening may move until it meets the end of the wall, no further.
 */
function rectOpeningMove(
  cell: OneOffOpeningCell,
  letter: string,
  openingWidthInches: number | null,
  wallRunInches: number | null,
):
  | { placement: RectOpeningPlacement; offsetInches: string }
  | { error: string } {
  if (
    cell.moveDirection === "" ||
    !rectMoveDirections(cell.wall).includes(cell.moveDirection)
  ) {
    return { error: `Pick which way to move inlet ${letter}` };
  }
  const typed = cell.moveInches.trim();
  if (typed === "") {
    return { error: `Enter how many inches to move inlet ${letter}` };
  }
  const inches = Number(typed);
  if (!Number.isFinite(inches) || inches <= 0) {
    return { error: `Move ${letter}: enter the inches as a number above 0` };
  }
  if (wallRunInches == null || !(wallRunInches > 0)) {
    // No size yet: the calculation says so itself.
    return { placement: "CENTERED", offsetInches: "" };
  }
  if (openingWidthInches != null) {
    const room = Math.round((wallRunInches - openingWidthInches) * 50) / 100;
    if (room <= 0) {
      return {
        error: `Move ${letter}: the opening already fills the ${RECT_WALL_LABELS[cell.wall]} wall`,
      };
    }
    if (inches > room + 1e-6) {
      return {
        error: `Move ${letter}: ${inchesLabel(room)}" is the most it can move before the end of the wall`,
      };
    }
  }
  const moved = rectMovePlacement(
    cell.wall,
    cell.moveDirection,
    inches,
    wallRunInches,
  );
  if (!moved) {
    return { placement: "CENTERED", offsetInches: "" };
  }
  return {
    placement: moved.placement,
    offsetInches: String(moved.offsetInches),
  };
}

/** The width a Widen sets, or why it can't be used yet. */
function rectOpeningWiden(
  cell: OneOffOpeningCell,
  letter: string,
  standardWidthInches: number | null,
): { widthInches: number } | { error: string } {
  const typed = cell.widenInches.trim();
  if (typed === "") {
    return { error: `Enter the Widen width for inlet ${letter}` };
  }
  const width = Number(typed);
  if (!Number.isInteger(width) || width <= 0) {
    return { error: `Widen ${letter}: width must be a whole number of inches` };
  }
  if (standardWidthInches != null && width <= standardWidthInches) {
    return {
      error: `Widen ${letter}: enter more than the standard ${standardWidthInches}" width`,
    };
  }
  return { widthInches: width };
}

/**
 * What an inlet's special does to its rect opening, or why it can't be used
 * yet. Widen sets the opening's full width; the height stays the catalog's.
 * Move slides the opening along its wall, away from the middle. Widen + Move
 * does both, and the room to move is what the wider opening leaves.
 */
function rectOpeningSpecial(
  cell: OneOffOpeningCell,
  letter: string,
  standardWidthInches: number | null,
  wallRunInches: number | null,
): RectOpeningSpecialResult {
  let widthOverrideInches = "";
  let openingWidthInches = standardWidthInches;
  if (specialWidens(cell.special)) {
    const widened = rectOpeningWiden(cell, letter, standardWidthInches);
    if ("error" in widened) {
      return widened;
    }
    widthOverrideInches = String(widened.widthInches);
    openingWidthInches = widened.widthInches;
  }
  if (!specialMoves(cell.special)) {
    return { widthOverrideInches, placement: "CENTERED", offsetInches: "" };
  }
  const moved = rectOpeningMove(cell, letter, openingWidthInches, wallRunInches);
  return "error" in moved ? moved : { widthOverrideInches, ...moved };
}

/** Inside length of the wall an inlet sits in, in inches; null without a size. */
function wallRunInchesFor(
  wall: RectWall,
  insideLengthFeet: string,
  insideWidthFeet: string,
): number | null {
  const length = parseNum(insideLengthFeet);
  const width = parseNum(insideWidthFeet);
  if (length == null || width == null) {
    return null;
  }
  const run = wallInsideRunFeet(wall, length, width) * 12;
  return run > 0 ? run : null;
}

export type OneOffPipe = { pipeType: string; pipeSize: string };

/** The pipe an inlet uses: its own cell, else the row's default. */
export function openingPipe(row: OneOffRow, cell: OneOffOpeningCell): OneOffPipe {
  return {
    pipeType: cell.pipeType.trim() || row.pipeType.trim(),
    pipeSize: cell.pipeSize.trim() || row.pipeSize.trim(),
  };
}

export function createEmptySetup(shape: OneOffShape): OneOffSetup {
  return {
    templateId: "",
    diameterFeet: "",
    castingProductId: "",
    pipeType: "",
    pipeSize: "",
    quantity: "",
    prefix: shape === "CIRCULAR" ? "MH-" : "CB-",
    startNumber: "1",
  };
}

export function createEmptySection(shape: OneOffShape): OneOffSection {
  return {
    setup: createEmptySetup(shape),
    rows: null,
    openingCount: ONE_OFF_DEFAULT_OPENING_COUNT,
  };
}

// ---------------------------------------------------------------------------
// Pipe type / size choices
// ---------------------------------------------------------------------------

export type PipeTypeChoice = { label: string; sizes: number[] };

/**
 * Circular pipe types as the drill sheet form labels them ("material type",
 * e.g. "PVC SDR35"); the drill-sheet calculator matches either form.
 */
export function circularPipeTypeChoices(
  pipeOpeningSizes: OneOffCircularOptions["pipeOpeningSizes"],
): PipeTypeChoice[] {
  const byLabel = new Map<string, Set<number>>();
  for (const entry of pipeOpeningSizes) {
    const label = [entry.pipeMaterial, entry.pipeType]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");
    if (!label) {
      continue;
    }
    const sizes = byLabel.get(label) ?? new Set<number>();
    sizes.add(entry.pipeSizeInches);
    byLabel.set(label, sizes);
  }
  return sortChoices(byLabel);
}

export function rectPipeTypeChoices(
  openingSizes: OneOffRectOptions["openingSizes"],
): PipeTypeChoice[] {
  const byLabel = new Map<string, Set<number>>();
  for (const entry of openingSizes) {
    const label = entry.pipeMaterial.trim();
    if (!label) {
      continue;
    }
    const sizes = byLabel.get(label) ?? new Set<number>();
    sizes.add(entry.pipeSizeInches);
    byLabel.set(label, sizes);
  }
  return sortChoices(byLabel);
}

function sortChoices(byLabel: Map<string, Set<number>>): PipeTypeChoice[] {
  return [...byLabel.entries()]
    .map(([label, sizes]) => ({
      label,
      sizes: [...sizes].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function sizesForPipeType(
  choices: PipeTypeChoice[],
  pipeType: string,
): number[] {
  return choices.find((choice) => choice.label === pipeType)?.sizes ?? [];
}

/** "<type>|<size>" for comparing two inlets' pipes; blank when either is. */
export function pipeKey(pipe: OneOffPipe): string {
  return pipe.pipeType && pipe.pipeSize ? `${pipe.pipeType}|${pipe.pipeSize}` : "";
}

/**
 * Changes one inlet's pipe type, keeping its size when the new type comes in
 * that size and clearing it otherwise so the status asks for a new pick.
 */
export function setOpeningPipeType(
  row: OneOffRow,
  index: number,
  pipeType: string,
  choices: PipeTypeChoice[],
): OneOffRow {
  const cell = row.openings[index];
  if (!cell) {
    return row;
  }
  const current = openingPipe(row, cell);
  const keepSize = sizesForPipeType(choices, pipeType).some(
    (size) => String(size) === current.pipeSize,
  );
  return {
    ...row,
    openings: row.openings.map((entry, entryIndex) =>
      entryIndex === index
        ? { ...entry, pipeType, pipeSize: keepSize ? current.pipeSize : "" }
        : entry,
    ),
  };
}

// ---------------------------------------------------------------------------
// Setup → rows
// ---------------------------------------------------------------------------

function parseNum(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * A round template is cast in one mold, so its single diameter is the
 * setup's diameter: nothing to pick, and a setup saved before the template
 * changed follows it. Legacy templates listing several keep the user's pick.
 */
export function withTemplateDiameter(
  setup: OneOffSetup,
  templates: OneOffCircularOptions["templates"],
): OneOffSetup {
  const locked = templateDiameterFeet(
    templates.find((entry) => entry.id === setup.templateId),
  );
  return locked == null || setup.diameterFeet === String(locked)
    ? setup
    : { ...setup, diameterFeet: String(locked) };
}

/** Labels of the setup fields still missing; empty when rows can be built. */
export function missingSetupFields(
  shape: OneOffShape,
  setup: OneOffSetup,
): string[] {
  const missing: string[] = [];
  if (!setup.templateId) missing.push("template");
  if (shape === "CIRCULAR" && !setup.diameterFeet) missing.push("diameter");
  if (!setup.castingProductId) missing.push("casting");
  if (!setup.pipeType) missing.push("pipe type");
  if (!setup.pipeSize) missing.push("pipe size");
  const quantity = parseNum(setup.quantity);
  if (quantity == null || quantity < 1 || !Number.isInteger(quantity)) {
    missing.push("quantity");
  } else if (quantity > ONE_OFF_MAX_ROWS) {
    missing.push(`quantity (${ONE_OFF_MAX_ROWS} max)`);
  }
  return missing;
}

/**
 * Next free number for `prefix`, past every structure number already taken
 * (on the job and in the grid) that uses that prefix.
 */
export function nextFreeStructureNumber(
  prefix: string,
  taken: string[],
  startAt = 1,
): number {
  let max = startAt - 1;
  const wanted = prefix.trim().toLowerCase();
  for (const raw of taken) {
    const name = raw.trim().toLowerCase();
    if (!name.startsWith(wanted)) {
      continue;
    }
    const suffix = name.slice(wanted.length);
    if (!/^\d+$/.test(suffix)) {
      continue;
    }
    max = Math.max(max, Number.parseInt(suffix, 10));
  }
  return max + 1;
}

export function createRowFromSetup(
  setup: OneOffSetup,
  structureNumber: string,
  openingCount: number,
): OneOffRow {
  return {
    id: createRowId(),
    structureNumber,
    templateId: setup.templateId,
    diameterFeet: setup.diameterFeet,
    castingProductId: setup.castingProductId,
    pipeType: setup.pipeType,
    pipeSize: setup.pipeSize,
    rimElevation: "",
    openings: Array.from({ length: openingCount }, (_, index) =>
      createOpeningCell(index, setup.pipeType, setup.pipeSize),
    ),
  };
}

export function buildRowsFromSetup(
  setup: OneOffSetup,
  openingCount: number,
): OneOffRow[] {
  const quantity = Math.min(
    ONE_OFF_MAX_ROWS,
    Math.max(1, Math.floor(parseNum(setup.quantity) ?? 1)),
  );
  const start = Math.max(1, Math.floor(parseNum(setup.startNumber) ?? 1));
  return Array.from({ length: quantity }, (_, index) =>
    createRowFromSetup(setup, `${setup.prefix}${start + index}`, openingCount),
  );
}

/** Pads or trims every row's openings to `openingCount`. */
export function resizeRowOpenings(
  rows: OneOffRow[],
  openingCount: number,
): OneOffRow[] {
  return rows.map((row) => ({
    ...row,
    openings: Array.from(
      { length: openingCount },
      (_, index) =>
        row.openings[index] ??
        createOpeningCell(index, row.pipeType, row.pipeSize),
    ),
  }));
}

// ---------------------------------------------------------------------------
// Row → calculated drill sheet
// ---------------------------------------------------------------------------

/** Inlets with an invert typed in, each with the pipe it will use. */
function filledOpenings(row: OneOffRow) {
  return row.openings
    .map((cell, index) => ({ cell, index, pipe: openingPipe(row, cell) }))
    .filter(({ cell }) => cell.invert.trim() !== "");
}

/** "Pick a pipe for inlet B" (or "inlets A, C") when type or size is blank. */
function missingPipeStatus(
  openings: { index: number; pipe: OneOffPipe }[],
): string | null {
  const letters = openings
    .filter((entry) => !entry.pipe.pipeType || !entry.pipe.pipeSize)
    .map((entry) => openingLetter(entry.index));
  if (letters.length === 0) {
    return null;
  }
  return `Pick a pipe for inlet${letters.length === 1 ? "" : "s"} ${letters.join(", ")}`;
}

export function computeCircularOneOffRow(
  row: OneOffRow,
  options: OneOffCircularOptions,
): OneOffRowResult {
  const filled = filledOpenings(row);
  const openings = filled.map(({ cell, index, pipe }) => ({
    id: `${row.id}-${index}`,
    label: openingLetter(index),
    pipeMaterial: pipe.pipeType,
    pipeSizeInches: pipe.pipeSize,
    pipeType: "",
    invertElevation: cell.invert,
    angleDegrees: cell.angle,
    connectionType: "",
  }));

  const workbookRow: StructureWorkbookRow = {
    id: row.id,
    structureNumber: row.structureNumber,
    templateId: row.templateId,
    diameterFeet: row.diameterFeet,
    castingProductId: row.castingProductId,
    rimElevation: row.rimElevation,
    lowInvertElevation: "",
    pipeMaterial: openings[0]?.pipeMaterial ?? row.pipeType,
    pipeSizeInches: openings[0]?.pipeSizeInches ?? row.pipeSize,
    pipeType: "",
    bootCount: String(openings.length),
    qty: "1",
    penetrations: [],
    openings,
    wallHeightAdjustInches: row.wallHeightAdjustInches ?? 0,
    wallHeightFeet: null,
    unitPrice: null,
    status: "",
    structureConfig: null,
  };

  if (!row.castingProductId) {
    return notReady("Select a casting");
  }
  if (openings.length === 0) {
    return notReady(
      row.rimElevation.trim() ? "Enter at least one invert" : "Enter rim and inverts",
    );
  }
  const missingPipe = missingPipeStatus(filled);
  if (missingPipe) {
    return notReady(missingPipe);
  }

  const computed = computeWorkbookRowPrice(workbookRow, options, "DRILL_SHEET");
  const config = computed.structureConfig;
  const ready =
    config != null &&
    config.detailLevel === "DRILL_SHEET" &&
    !config.errorMessage;
  return {
    wallHeightFeet: computed.wallHeightFeet,
    brickFeet: computed.drillSheetResult?.brickFeet ?? null,
    status: ready ? firstWarningOr(config, "Ready") : computed.status,
    ready,
    config,
    circularSheet: computed.drillSheetResult ?? null,
  };
}

export function computeRectOneOffRow(
  row: OneOffRow,
  options: OneOffRectOptions,
): OneOffRowResult {
  const template = options.templates.find(
    (entry) => entry.id === row.templateId,
  );
  if (!template) {
    return notReady("Select a template");
  }
  if (!row.castingProductId) {
    return notReady("Select a casting");
  }

  const filled = filledOpenings(row);
  if (filled.length === 0) {
    return notReady(
      row.rimElevation.trim() ? "Enter at least one invert" : "Enter rim and inverts",
    );
  }
  const missingPipe = missingPipeStatus(filled);
  if (missingPipe) {
    return notReady(missingPipe);
  }
  const preset = template.presetSizes[0];
  const insideLengthFeet =
    row.insideLengthFeet ?? (preset ? String(preset.insideLengthFeet) : "");
  const insideWidthFeet =
    row.insideWidthFeet ?? (preset ? String(preset.insideWidthFeet) : "");

  const openings = [];
  for (const { cell, index, pipe } of filled) {
    const letter = openingLetter(index);
    const special = rectOpeningSpecial(
      cell,
      letter,
      standardRectOpeningWidth(options.openingSizes, pipe),
      wallRunInchesFor(cell.wall, insideLengthFeet, insideWidthFeet),
    );
    if ("error" in special) {
      return notReady(special.error);
    }
    openings.push({
      ...createRectOpeningRow(letter),
      wall: cell.wall,
      pipeMaterial: pipe.pipeType,
      pipeSizeInches: pipe.pipeSize,
      invertElevation: cell.invert,
      widthOverrideInches: special.widthOverrideInches,
      placement: special.placement,
      offsetInches: special.offsetInches,
    });
  }

  const workbookRow: RectWorkbookRow = {
    id: row.id,
    structureNumber: row.structureNumber,
    templateId: row.templateId,
    insideLengthFeet,
    insideWidthFeet,
    castingProductId: row.castingProductId,
    rimElevation: row.rimElevation,
    lowInvertElevation: "",
    hasTopSlab: template.topSlabThicknessInches > 0,
    hasBaseSlab: template.baseSlabThicknessInches > 0,
    baseAttached: template.baseSlabThicknessInches > 0,
    topSlabOpeningLengthInches: "",
    topSlabOpeningWidthInches: "",
    topSlabOpeningSide: "UP",
    stepsPosition: row.stepsPosition ?? "",
    penetrations: [],
    openings,
    qty: "1",
    wallHeightAdjustInches: row.wallHeightAdjustInches ?? 0,
    wallHeightFeet: null,
    heaviestPickLbs: null,
    unitPrice: null,
    status: "",
    config: null,
  };

  const { row: computed, result: rectSheet } = computeRectWorkbookRowDetail(
    workbookRow,
    options,
    "FULL",
  );
  const config = computed.config;
  const ready =
    config != null && config.detailLevel === "FULL" && !config.errorMessage;
  return {
    wallHeightFeet: computed.wallHeightFeet,
    brickFeet: rectSheet?.brickFeet ?? null,
    status: ready ? firstWarningOr(config, "Ready") : computed.status,
    ready,
    config,
    rectSheet,
  };
}

/**
 * One click of a wall height arrow: 6" up (+1) or down (-1) from where the
 * row's wall stands now.
 */
export function stepRowWallHeight(row: OneOffRow, direction: 1 | -1): OneOffRow {
  const next =
    (row.wallHeightAdjustInches ?? 0) +
    direction * WALL_HEIGHT_ADJUST_STEP_INCHES;
  return { ...row, wallHeightAdjustInches: next };
}

/**
 * Which wall height arrows a row can still use. Raising takes 6" out of the
 * brick, so it stops when less than that is left; lowering stops at a 6"
 * wall. A row that has not calculated yet can only undo a change already
 * made (so a change that broke the row can always be backed out).
 */
export function wallHeightArrowState(
  row: OneOffRow,
  result: OneOffRowResult | undefined,
): { canRaise: boolean; canLower: boolean } {
  const adjust = row.wallHeightAdjustInches ?? 0;
  const stepFeet = WALL_HEIGHT_ADJUST_STEP_INCHES / 12;
  const wall = result?.wallHeightFeet ?? null;
  const brick = result?.brickFeet ?? null;
  if (wall == null || brick == null) {
    return { canRaise: adjust < 0, canLower: adjust > 0 };
  }
  return {
    canRaise: adjust < 0 || brick >= stepFeet - 1e-6,
    canLower: adjust > 0 || wall >= 2 * stepFeet - 1e-6,
  };
}

function notReady(status: string): OneOffRowResult {
  return { wallHeightFeet: null, status, ready: false, config: null };
}

function firstWarningOr(
  config: { warnings?: string[] },
  fallback: string,
): string {
  return config.warnings?.[0] ?? fallback;
}

/** Structure numbers used more than once (case-insensitive), as typed. */
export function findDuplicateStructureNumbers(numbers: string[]): string[] {
  const seen = new Map<string, number>();
  for (const raw of numbers) {
    const key = raw.trim().toLowerCase();
    if (!key) {
      continue;
    }
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates: string[] = [];
  const reported = new Set<string>();
  for (const raw of numbers) {
    const key = raw.trim().toLowerCase();
    if ((seen.get(key) ?? 0) > 1 && !reported.has(key)) {
      reported.add(key);
      duplicates.push(raw.trim());
    }
  }
  return duplicates;
}

// ---------------------------------------------------------------------------
// Editing saved sheets
// ---------------------------------------------------------------------------
//
// An existing sheet is loaded into a grid row (the row id is the structure
// id), edited, then merged back over the sheet's saved form values. Anything
// the grid doesn't show (inspection, section splits, an opening held against
// a wall end) is kept as it was.

/** The row's pipe type and default size: the first opening that names one. */
function firstPipe(
  openings: { pipeMaterial: string; pipeSizeInches: string }[],
): { pipeType: string; pipeSize: string } {
  const opening = openings.find((entry) => entry.pipeMaterial.trim() !== "");
  return {
    pipeType: opening?.pipeMaterial.trim() ?? "",
    pipeSize: opening?.pipeSizeInches.trim() ?? "",
  };
}

function isRectWall(value: string): value is RectWall {
  return RECT_WALLS.includes(value as RectWall);
}

export function circularRowFromSheet(
  structureId: string,
  values: DrillSheetFormValues,
  templates: OneOffCircularOptions["templates"],
): OneOffRow {
  const template = templates.find((entry) => entry.id === values.templateId);
  const diameter = template?.diameters.find(
    (entry) => entry.id === values.diameterId,
  );
  return {
    id: structureId,
    structureNumber: values.manholeNumber,
    templateId: values.templateId,
    diameterFeet: diameter
      ? String(diameter.insideDiameterFeet)
      : values.unmatchedDiameterFeet != null
        ? String(values.unmatchedDiameterFeet)
        : "",
    castingProductId: values.castingProductId,
    ...firstPipe(values.openings),
    rimElevation: values.rimElevation,
    openings: values.openings.map((opening, index) => ({
      ...createOpeningCell(index),
      invert: opening.invertElevation,
      pipeType: opening.pipeMaterial.trim(),
      pipeSize: opening.pipeSizeInches.trim(),
      angle: opening.angle,
    })),
    wallHeightAdjustInches: values.wallHeightAdjustInches ?? 0,
  };
}

/**
 * A saved rect opening always carries its width. It only counts as widened
 * when that width is more than the catalog's for its pipe (or the pipe is no
 * longer in the catalog, so the saved width is all there is to go on).
 */
function widenFromSavedWidth(
  opening: RectSheetFormValues["openings"][number],
  openingSizes: OneOffRectOptions["openingSizes"],
): Pick<OneOffOpeningCell, "special" | "widenInches"> {
  const saved = parseNum(opening.widthOverrideInches);
  if (saved == null || saved <= 0) {
    return { special: "", widenInches: "" };
  }
  const standard = standardRectOpeningWidth(openingSizes, {
    pipeType: opening.pipeMaterial.trim(),
    pipeSize: opening.pipeSizeInches.trim(),
  });
  if (standard != null && saved <= standard) {
    return { special: "", widenInches: "" };
  }
  return { special: "WIDEN", widenInches: String(saved) };
}

/**
 * The Special a saved rect opening shows in the grid: Widen when it is wider
 * than standard, Move when it sits off center, Widen + Move when both. An
 * opening placed some other way (against a wall end, or hanging past one,
 * which only the sheet form allows) shows no Move and keeps the place it was
 * saved at.
 */
function specialFromSavedOpening(
  opening: RectSheetFormValues["openings"][number],
  wall: RectWall,
  openingSizes: OneOffRectOptions["openingSizes"],
  wallRunInches: number | null,
): Pick<
  OneOffOpeningCell,
  "special" | "widenInches" | "moveDirection" | "moveInches"
> {
  const widened = widenFromSavedWidth(opening, openingSizes);
  const moved =
    wallRunInches == null
      ? null
      : rectMoveFromPlacement(
          wall,
          opening.placement,
          parseNum(opening.offsetInches),
          wallRunInches,
        );
  const widthInches =
    parseNum(opening.widthOverrideInches) ??
    standardRectOpeningWidth(openingSizes, {
      pipeType: opening.pipeMaterial.trim(),
      pipeSize: opening.pipeSizeInches.trim(),
    });
  const fits =
    moved != null &&
    wallRunInches != null &&
    (widthInches == null ||
      moved.inches <= (wallRunInches - widthInches) / 2 + 0.005);
  if (!moved || !fits) {
    return { ...widened, moveDirection: "", moveInches: "" };
  }
  return {
    special: widened.special === "WIDEN" ? "WIDEN_MOVE" : "MOVE",
    widenInches: widened.widenInches,
    moveDirection: moved.direction,
    moveInches: inchesLabel(moved.inches),
  };
}

export function rectRowFromSheet(
  structureId: string,
  values: RectSheetFormValues,
  openingSizes: OneOffRectOptions["openingSizes"],
): OneOffRow {
  return {
    id: structureId,
    structureNumber: values.structureNumber,
    templateId: values.templateId,
    diameterFeet: "",
    castingProductId: values.castingProductId,
    ...firstPipe(values.openings),
    rimElevation: values.rimElevation,
    openings: values.openings.map((opening, index) => {
      const wall = isRectWall(opening.wall)
        ? opening.wall
        : createOpeningCell(index).wall;
      return {
        ...createOpeningCell(index),
        invert: opening.invertElevation,
        pipeType: opening.pipeMaterial.trim(),
        pipeSize: opening.pipeSizeInches.trim(),
        wall,
        ...specialFromSavedOpening(
          opening,
          wall,
          openingSizes,
          wallRunInchesFor(wall, values.insideLengthFeet, values.insideWidthFeet),
        ),
      };
    }),
    wallHeightAdjustInches: values.wallHeightAdjustInches ?? 0,
    ...(values.stepsPosition ? { stepsPosition: values.stepsPosition } : {}),
    insideLengthFeet: values.insideLengthFeet,
    insideWidthFeet: values.insideWidthFeet,
  };
}

/** Grid columns needed to show every row's openings. */
export function openingCountForRows(rows: OneOffRow[]): number {
  return Math.min(
    ONE_OFF_MAX_OPENINGS,
    Math.max(
      ONE_OFF_DEFAULT_OPENING_COUNT,
      ...rows.map((row) => row.openings.length),
    ),
  );
}

/** True when the grid row differs from the row as it was loaded. */
/**
 * Same number typed two ways ("100.5" loaded, "100.50" after the grid rounds
 * it on blur) is not a change; anything that isn't a number compares as text.
 */
function sameNumberText(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (left === right) {
    return true;
  }
  if (left === "" || right === "") {
    return false;
  }
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return (
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    leftNumber === rightNumber
  );
}

export function isRowChanged(row: OneOffRow, loaded: OneOffRow): boolean {
  return (
    row.structureNumber.trim() !== loaded.structureNumber.trim() ||
    row.templateId !== loaded.templateId ||
    row.diameterFeet !== loaded.diameterFeet ||
    row.castingProductId !== loaded.castingProductId ||
    (row.wallHeightAdjustInches ?? 0) !== (loaded.wallHeightAdjustInches ?? 0) ||
    (row.stepsPosition ?? "") !== (loaded.stepsPosition ?? "") ||
    !sameNumberText(row.rimElevation, loaded.rimElevation) ||
    row.openings.some((cell, index) => {
      const before = loaded.openings[index];
      return (
        !sameNumberText(cell.invert, before?.invert ?? "") ||
        (cell.invert.trim() !== "" &&
          (pipeKey(openingPipe(row, cell)) !==
            (before ? pipeKey(openingPipe(loaded, before)) : "") ||
            !sameNumberText(cell.angle, before?.angle ?? "") ||
            cell.wall !== before?.wall ||
            cell.special !== (before?.special ?? "") ||
            !sameNumberText(cell.widenInches, before?.widenInches ?? "") ||
            cell.moveDirection !== (before?.moveDirection ?? "") ||
            !sameNumberText(cell.moveInches, before?.moveInches ?? "")))
      );
    })
  );
}

type MergeResult<T> = { values: T } | { error: string };

/**
 * Applies an edited grid row to a circular sheet's saved form values. Grid
 * column N is the sheet's opening N; a blank invert drops that opening. Each
 * inlet takes the pipe in its own cell.
 */
export function mergeCircularRow(
  values: DrillSheetFormValues,
  row: OneOffRow,
  templates: OneOffCircularOptions["templates"],
  today: string,
): MergeResult<DrillSheetFormValues> {
  const template = templates.find((entry) => entry.id === row.templateId);
  if (!template) {
    return { error: "Select a template" };
  }
  // The template's mold sets the diameter. A row that names another size (a
  // saved sheet whose template has since changed) is never silently resized.
  const diameter =
    row.diameterFeet.trim() === "" && template.diameters.length === 1
      ? template.diameters[0]
      : template.diameters.find(
          (entry) => String(entry.insideDiameterFeet) === row.diameterFeet,
        );
  if (!diameter) {
    return { error: "Select a diameter" };
  }
  const openings = row.openings.flatMap((cell, index) => {
    if (cell.invert.trim() === "") {
      return [];
    }
    const saved = values.openings[index];
    const pipe = openingPipe(row, cell);
    return [
      {
        label: saved?.label || openingLetter(index),
        pipeMaterial: pipe.pipeType,
        pipeSizeInches: pipe.pipeSize,
        invertElevation: cell.invert.trim(),
        angle: cell.angle.trim() || "0",
        connectionType: saved?.connectionType || template.connectionType,
      },
    ];
  });
  if (openings.length === 0) {
    return { error: "Enter at least one invert" };
  }

  return {
    values: {
      ...values,
      templateId: template.id,
      diameterId: diameter.id,
      unmatchedDiameterFeet: null,
      castingProductId: row.castingProductId,
      manholeNumber: row.structureNumber.trim(),
      date: values.date || today,
      rimElevation: row.rimElevation.trim(),
      wallHeightAdjustInches: row.wallHeightAdjustInches ?? 0,
      openings,
    },
  };
}

/**
 * Applies an edited grid row to a rect sheet's saved form values; same rules
 * as mergeCircularRow. Changing the template resets the slabs and section
 * splits to the new template's single-pour defaults.
 */
export function mergeRectRow(
  values: RectSheetFormValues,
  row: OneOffRow,
  loaded: OneOffRow,
  templates: OneOffRectOptions["templates"],
  today: string,
): MergeResult<RectSheetFormValues> {
  const template = templates.find((entry) => entry.id === row.templateId);
  if (!template) {
    return { error: "Select a template" };
  }
  const templateChanged = row.templateId !== loaded.templateId;

  const insideLengthFeet = row.insideLengthFeet ?? values.insideLengthFeet;
  const insideWidthFeet = row.insideWidthFeet ?? values.insideWidthFeet;

  const openings = row.openings.flatMap((cell, index) => {
    if (cell.invert.trim() === "") {
      return [];
    }
    const saved = values.openings[index];
    const base = saved ?? createRectOpeningRow(openingLetter(index));
    const pipe = openingPipe(row, cell);
    // Move sets where the opening sits along its wall. Taking a Move off
    // puts the opening back in the middle; an opening the grid never showed
    // as moved (one against a wall end, say) keeps the place it was saved at.
    const moved =
      specialMoves(cell.special) && cell.moveDirection !== ""
        ? rectMovePlacement(
            cell.wall,
            cell.moveDirection,
            Number(cell.moveInches.trim()),
            wallRunInchesFor(cell.wall, insideLengthFeet, insideWidthFeet) ?? 0,
          )
        : null;
    const wasMoved = specialMoves(loaded.openings[index]?.special);
    const placement: Pick<
      RectSheetFormValues["openings"][number],
      "placement" | "offsetInches"
    > = moved
      ? { placement: moved.placement, offsetInches: String(moved.offsetInches) }
      : specialMoves(cell.special) || wasMoved
        ? { placement: "CENTERED", offsetInches: "" }
        : { placement: base.placement, offsetInches: base.offsetInches };
    return [
      {
        ...base,
        wall: cell.wall,
        pipeMaterial: pipe.pipeType,
        pipeSizeInches: pipe.pipeSize,
        // The grid's Special cell is also the opening's width: Widen (with
        // or without Move) sets it, anything else leaves the catalog width.
        widthOverrideInches: specialWidens(cell.special)
          ? cell.widenInches.trim()
          : "",
        ...placement,
        invertElevation: cell.invert.trim(),
      },
    ];
  });
  if (openings.length === 0) {
    return { error: "Enter at least one invert" };
  }

  const slabs = templateChanged
    ? {
        hasTopSlab: template.topSlabThicknessInches > 0,
        hasBaseSlab: template.baseSlabThicknessInches > 0,
        baseAttached: template.baseSlabThicknessInches > 0,
        sections: [],
      }
    : {};

  return {
    values: {
      ...values,
      ...slabs,
      templateId: template.id,
      castingProductId: row.castingProductId,
      structureNumber: row.structureNumber.trim(),
      date: values.date || today,
      rimElevation: row.rimElevation.trim(),
      wallHeightAdjustInches: row.wallHeightAdjustInches ?? 0,
      stepsPosition: row.stepsPosition ?? "",
      insideLengthFeet,
      insideWidthFeet,
      openings,
    },
  };
}
