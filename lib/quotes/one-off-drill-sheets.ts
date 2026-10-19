// One-Off drill sheets (Quotes → One-Off tab): a spreadsheet-style grid for
// knocking out a few drill sheets without building a quote first.
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
  RectSheetOpeningSizeOption,
  RectSheetTemplateOption,
} from "@/components/drill-sheets/rect-sheet-form";
import type { RectWall } from "@/lib/rect-structure";
import {
  computeWorkbookRowPrice,
  createRowId,
  type QuoteStructureConfig,
  type StructureWorkbookOptions,
  type StructureWorkbookRow,
} from "@/lib/quotes/structure-workbook";
import {
  computeRectWorkbookRow,
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

/** One pipe opening's cells in a row: invert plus angle (circular) or wall (rect). */
export type OneOffOpeningCell = {
  invert: string;
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
  pipeType: string;
  pipeSize: string;
  rimElevation: string;
  /** Always `openingCount` long so every row lines up with the grid columns. */
  openings: OneOffOpeningCell[];
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
};

export const ONE_OFF_DEFAULT_OPENING_COUNT = 2;
export const ONE_OFF_MAX_OPENINGS = 8;
export const ONE_OFF_MAX_ROWS = 200;

/** Rect openings default to distinct walls in this order. */
const RECT_DEFAULT_WALLS: RectWall[] = ["UP", "DOWN", "LEFT", "RIGHT"];

export function openingLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function createOpeningCell(index: number): OneOffOpeningCell {
  return {
    invert: "",
    angle: "",
    wall: RECT_DEFAULT_WALLS[index % RECT_DEFAULT_WALLS.length],
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
      createOpeningCell(index),
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
      (_, index) => row.openings[index] ?? createOpeningCell(index),
    ),
  }));
}

// ---------------------------------------------------------------------------
// Row → calculated drill sheet
// ---------------------------------------------------------------------------

export function computeCircularOneOffRow(
  row: OneOffRow,
  options: OneOffCircularOptions,
): OneOffRowResult {
  const openings = row.openings
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.invert.trim() !== "")
    .map(({ cell, index }) => ({
      id: `${row.id}-${index}`,
      label: openingLetter(index),
      pipeMaterial: row.pipeType,
      pipeSizeInches: row.pipeSize,
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
    pipeMaterial: row.pipeType,
    pipeSizeInches: row.pipeSize,
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
  if (!row.pipeType || !row.pipeSize) {
    return notReady("Select a pipe type and size");
  }
  if (openings.length === 0) {
    return notReady(
      row.rimElevation.trim() ? "Enter at least one invert" : "Enter rim and inverts",
    );
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
  if (!row.pipeType || !row.pipeSize) {
    return notReady("Select a pipe type and size");
  }

  const openings = row.openings
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.invert.trim() !== "")
    .map(({ cell, index }) => ({
      ...createRectOpeningRow(openingLetter(index)),
      wall: cell.wall,
      pipeMaterial: row.pipeType,
      pipeSizeInches: row.pipeSize,
      invertElevation: cell.invert,
    }));
  if (openings.length === 0) {
    return notReady(
      row.rimElevation.trim() ? "Enter at least one invert" : "Enter rim and inverts",
    );
  }

  const preset = template.presetSizes[0];
  const workbookRow: RectWorkbookRow = {
    id: row.id,
    structureNumber: row.structureNumber,
    templateId: row.templateId,
    insideLengthFeet: preset ? String(preset.insideLengthFeet) : "",
    insideWidthFeet: preset ? String(preset.insideWidthFeet) : "",
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

  const computed = computeRectWorkbookRow(workbookRow, options, "FULL");
  const config = computed.config;
  const ready =
    config != null && config.detailLevel === "FULL" && !config.errorMessage;
  return {
    wallHeightFeet: computed.wallHeightFeet,
    status: ready ? firstWarningOr(config, "Ready") : computed.status,
    ready,
    config,
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
