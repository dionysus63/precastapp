// One-Off drill sheets (Quotes → One-Off): a spreadsheet-style grid for
// knocking out a few drill sheets without building a quote first, and for
// editing them again later.
//
// Each grid row is one structure. Rows are converted to the same workbook
// rows the quote's structure workbooks use, so wall heights, warnings and the
// saved drill sheets come from the exact same calculators.

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
import type { DrillSheetResult } from "@/lib/drill-sheet";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";
import {
  RECT_WALLS,
  type RectStructureResult,
  type RectWall,
} from "@/lib/rect-structure";
import {
  computeWorkbookRowPrice,
  createRowId,
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

/** Rect openings default to distinct walls in this order. */
const RECT_DEFAULT_WALLS: RectWall[] = ["UP", "DOWN", "LEFT", "RIGHT"];

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
    angle: "",
    wall: RECT_DEFAULT_WALLS[index % RECT_DEFAULT_WALLS.length],
  };
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
  const openings = filled.map(({ cell, index, pipe }) => ({
    ...createRectOpeningRow(openingLetter(index)),
    wall: cell.wall,
    pipeMaterial: pipe.pipeType,
    pipeSizeInches: pipe.pipeSize,
    invertElevation: cell.invert,
  }));
  if (openings.length === 0) {
    return notReady(
      row.rimElevation.trim() ? "Enter at least one invert" : "Enter rim and inverts",
    );
  }
  const missingPipe = missingPipeStatus(filled);
  if (missingPipe) {
    return notReady(missingPipe);
  }

  const preset = template.presetSizes[0];
  const workbookRow: RectWorkbookRow = {
    id: row.id,
    structureNumber: row.structureNumber,
    templateId: row.templateId,
    insideLengthFeet:
      row.insideLengthFeet ?? (preset ? String(preset.insideLengthFeet) : ""),
    insideWidthFeet:
      row.insideWidthFeet ?? (preset ? String(preset.insideWidthFeet) : ""),
    castingProductId: row.castingProductId,
    rimElevation: row.rimElevation,
    lowInvertElevation: "",
    hasTopSlab: template.topSlabThicknessInches > 0,
    hasBaseSlab: template.baseSlabThicknessInches > 0,
    baseAttached: template.baseSlabThicknessInches > 0,
    topSlabOpeningLengthInches: "",
    topSlabOpeningWidthInches: "",
    topSlabOpeningSide: "UP",
    penetrations: [],
    openings,
    qty: "1",
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
    status: ready ? firstWarningOr(config, "Ready") : computed.status,
    ready,
    config,
    rectSheet,
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
// the grid doesn't show (inspection, steps, section splits, opening
// placements) is kept as it was.

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
  };
}

export function rectRowFromSheet(
  structureId: string,
  values: RectSheetFormValues,
): OneOffRow {
  return {
    id: structureId,
    structureNumber: values.structureNumber,
    templateId: values.templateId,
    diameterFeet: "",
    castingProductId: values.castingProductId,
    ...firstPipe(values.openings),
    rimElevation: values.rimElevation,
    openings: values.openings.map((opening, index) => ({
      ...createOpeningCell(index),
      invert: opening.invertElevation,
      pipeType: opening.pipeMaterial.trim(),
      pipeSize: opening.pipeSizeInches.trim(),
      wall: isRectWall(opening.wall) ? opening.wall : createOpeningCell(index).wall,
    })),
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
export function isRowChanged(row: OneOffRow, loaded: OneOffRow): boolean {
  return (
    row.structureNumber.trim() !== loaded.structureNumber.trim() ||
    row.templateId !== loaded.templateId ||
    row.diameterFeet !== loaded.diameterFeet ||
    row.castingProductId !== loaded.castingProductId ||
    row.rimElevation.trim() !== loaded.rimElevation.trim() ||
    row.openings.some((cell, index) => {
      const before = loaded.openings[index];
      return (
        cell.invert.trim() !== (before?.invert.trim() ?? "") ||
        (cell.invert.trim() !== "" &&
          (pipeKey(openingPipe(row, cell)) !==
            (before ? pipeKey(openingPipe(loaded, before)) : "") ||
            cell.angle.trim() !== (before?.angle.trim() ?? "") ||
            cell.wall !== before?.wall))
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
  const diameter = template.diameters.find(
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

  const openings = row.openings.flatMap((cell, index) => {
    if (cell.invert.trim() === "") {
      return [];
    }
    const saved = values.openings[index];
    const base = saved ?? createRectOpeningRow(openingLetter(index));
    const pipe = openingPipe(row, cell);
    // A width override belongs to the saved pipe; a different pipe loses it.
    const samePipe =
      saved != null &&
      saved.pipeMaterial.trim() === pipe.pipeType &&
      saved.pipeSizeInches.trim() === pipe.pipeSize;
    return [
      {
        ...base,
        wall: cell.wall,
        pipeMaterial: pipe.pipeType,
        pipeSizeInches: pipe.pipeSize,
        widthOverrideInches: samePipe ? saved.widthOverrideInches : "",
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
      insideLengthFeet: row.insideLengthFeet ?? values.insideLengthFeet,
      insideWidthFeet: row.insideWidthFeet ?? values.insideWidthFeet,
      openings,
    },
  };
}
