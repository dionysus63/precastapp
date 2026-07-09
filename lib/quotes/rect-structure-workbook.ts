// Rectangular Structure Workbook: quote-side rows, pricing, line-item
// conversion, and config (de)serialization.
//
// Mirrors lib/quotes/structure-workbook.ts (circular). Rect configs are
// stored in the same QuoteLineItem.structureConfigJson column with a
// `shape: "RECTANGULAR"` discriminator; circular configs have no shape
// field. Each workbook passes the other shape's lines through untouched so
// applying one never wipes the other.

import type {
  RectSheetCastingOption,
  RectSheetOpeningSizeOption,
  RectSheetTemplateOption,
} from "@/components/drill-sheets/rect-sheet-form";
import { quoteLineItemTypeLabels } from "@/lib/quotes/constants";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";
import { createRowId } from "@/lib/quotes/structure-workbook";
import {
  computeRectStructure,
  type RectOpeningPlacement,
  type RectStructureInput,
  type RectStructureResult,
  type RectWall,
} from "@/lib/rect-structure";
import { formatFeetInchesShort } from "@/lib/drill-sheet";

export type RectQuoteDetailLevel = "QUOTE" | "FULL";

/** Entry mode: quote-only (fast pricing) vs. full drill-sheet detail. */
export type RectWorkbookMode = "QUOTE" | "FULL";

/** One pipe size entering a structure in quote-only mode (no wall/invert detail). */
export type RectWorkbookPenetration = {
  id: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  qty: string;
};

export type RectQuoteOpening = {
  label: string;
  wall: RectWall;
  pipeMaterial?: string;
  pipeSizeInches?: number;
  invertElevation: number;
  angleDegrees?: number;
  placement?: RectOpeningPlacement;
  offsetInches?: number | null;
  widthOverrideInches?: number | null;
};

export type RectQuoteStructureConfig = {
  shape: "RECTANGULAR";
  templateId: string;
  templateName?: string;
  insideLengthFeet: number;
  insideWidthFeet: number;
  castingProductId?: string | null;
  rimElevation: number;
  lowInvertElevation: number;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  baseAttached: boolean;
  topSlabOpeningLengthInches?: number | null;
  topSlabOpeningWidthInches?: number | null;
  topSlabOpeningSide?: RectWall | null;
  detailLevel: RectQuoteDetailLevel;
  openings: RectQuoteOpening[];
  wallHeightFeet?: number;
  heaviestPickLbs?: number | null;
  wallPrice?: number;
  topSlabPrice?: number;
  baseSlabPrice?: number;
  openingsPrice?: number;
  totalPrice?: number;
  warnings?: string[];
  errorMessage?: string | null;
};

export type RectWorkbookOpeningRow = {
  id: string;
  label: string;
  wall: RectWall;
  pipeMaterial: string;
  pipeSizeInches: string;
  invertElevation: string;
  angle: string;
  placement: RectOpeningPlacement;
  offsetInches: string;
  widthOverrideInches: string;
};

export type RectWorkbookRow = {
  id: string;
  lineItemId?: string;
  structureNumber: string;
  templateId: string;
  insideLengthFeet: string;
  insideWidthFeet: string;
  castingProductId: string;
  rimElevation: string;
  /** Quote-only mode input; derived from openings in full mode. */
  lowInvertElevation: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  baseAttached: boolean;
  topSlabOpeningLengthInches: string;
  topSlabOpeningWidthInches: string;
  topSlabOpeningSide: RectWall;
  /** Quote-only mode pipe list (material + size + count). */
  penetrations: RectWorkbookPenetration[];
  openings: RectWorkbookOpeningRow[];
  qty: string;
  wallHeightFeet: number | null;
  heaviestPickLbs: number | null;
  unitPrice: number | null;
  status: string;
  config: RectQuoteStructureConfig | null;
};

export type RectWorkbookDefaults = {
  namePrefix: string;
  startNumber: number;
  templateId: string;
  insideLengthFeet: string;
  insideWidthFeet: string;
  castingProductId: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  baseAttached: boolean;
  qty: string;
  maxPickWeightLbs: string;
};

export type RectWorkbookOptions = {
  templates: RectSheetTemplateOption[];
  castings: RectSheetCastingOption[];
  openingSizes: RectSheetOpeningSizeOption[];
};

export type RectWorkbookSession = {
  rows: RectWorkbookRow[];
  /** Non-rect structure lines carried through untouched on apply. */
  passthroughLines: EditableQuoteLineItem[];
  returnPath: string;
  defaults: RectWorkbookDefaults;
  mode?: RectWorkbookMode;
};

const SESSION_PREFIX = "precast:quote-rect-workbook:";

export function rectWorkbookSessionKey(
  quoteId: string | null | undefined,
): string {
  return `${SESSION_PREFIX}${quoteId ?? "new"}`;
}

export function readRectWorkbookSession(
  quoteId: string | null | undefined,
): RectWorkbookSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(rectWorkbookSessionKey(quoteId));
    return raw ? (JSON.parse(raw) as RectWorkbookSession) : null;
  } catch {
    return null;
  }
}

export function writeRectWorkbookSession(
  quoteId: string | null | undefined,
  session: RectWorkbookSession,
): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(
    rectWorkbookSessionKey(quoteId),
    JSON.stringify(session),
  );
}

export function clearRectWorkbookSession(
  quoteId: string | null | undefined,
): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.removeItem(rectWorkbookSessionKey(quoteId));
}

function parseNum(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const WALLS: RectWall[] = ["UP", "DOWN", "LEFT", "RIGHT"];

/** Maps legacy plan-letter wall values (A/B/C/D) in stored configs. */
const LEGACY_WALLS: Record<string, RectWall> = {
  A: "UP",
  B: "RIGHT",
  C: "DOWN",
  D: "LEFT",
};

function normalizeWall(value: unknown): RectWall | null {
  if (WALLS.includes(value as RectWall)) {
    return value as RectWall;
  }
  if (typeof value === "string" && LEGACY_WALLS[value]) {
    return LEGACY_WALLS[value];
  }
  return null;
}
const PLACEMENTS: RectOpeningPlacement[] = [
  "CENTERED",
  "FROM_LEFT",
  "FROM_RIGHT",
  "TOUCH_LEFT",
  "TOUCH_RIGHT",
];

export function createRectOpeningRow(label: string): RectWorkbookOpeningRow {
  return {
    id: createRowId(),
    label,
    wall: "UP",
    pipeMaterial: "",
    pipeSizeInches: "",
    invertElevation: "",
    angle: "",
    placement: "CENTERED",
    offsetInches: "",
    widthOverrideInches: "",
  };
}

export function createRectPenetration(): RectWorkbookPenetration {
  return { id: createRowId(), pipeMaterial: "", pipeSizeInches: "", qty: "1" };
}

/**
 * Derives quote-mode fields from the full openings list: lowest invert and
 * the grouped pipe list.
 */
export function syncRectRowFromOpenings(row: RectWorkbookRow): RectWorkbookRow {
  let lowest: number | null = null;
  const groups = new Map<string, RectWorkbookPenetration>();
  for (const opening of row.openings) {
    const invert = parseNum(opening.invertElevation);
    if (invert != null && (lowest == null || invert < lowest)) {
      lowest = invert;
    }
    if (opening.pipeMaterial.trim() && parseNum(opening.pipeSizeInches) != null) {
      const key = `${opening.pipeMaterial}|${opening.pipeSizeInches}`;
      const existing = groups.get(key);
      if (existing) {
        existing.qty = String((parseNum(existing.qty) ?? 0) + 1);
      } else {
        groups.set(key, {
          id: createRowId(),
          pipeMaterial: opening.pipeMaterial,
          pipeSizeInches: opening.pipeSizeInches,
          qty: "1",
        });
      }
    }
  }
  return {
    ...row,
    lowInvertElevation:
      lowest != null ? String(lowest) : row.lowInvertElevation,
    penetrations:
      groups.size > 0 ? [...groups.values()] : row.penetrations,
  };
}

/**
 * Prepares a row for full-detail mode: blank placeholder openings are
 * replaced by openings seeded from the quote-only pipe list (first pipe
 * carries the low invert, all centered on the Up wall until edited).
 */
export function upgradeRectRowToFull(row: RectWorkbookRow): RectWorkbookRow {
  const hasRealOpenings = row.openings.some(
    (opening) =>
      opening.pipeMaterial.trim() !== "" ||
      parseNum(opening.invertElevation) != null,
  );
  if (hasRealOpenings) {
    return syncRectRowFromOpenings(row);
  }

  const seeded: RectWorkbookOpeningRow[] = [];
  for (const penetration of row.penetrations) {
    if (
      !penetration.pipeMaterial.trim() ||
      parseNum(penetration.pipeSizeInches) == null
    ) {
      continue;
    }
    const count = Math.max(1, Math.floor(parseNum(penetration.qty) ?? 1));
    for (let index = 0; index < count; index += 1) {
      seeded.push({
        ...createRectOpeningRow(String.fromCharCode(65 + seeded.length)),
        pipeMaterial: penetration.pipeMaterial,
        pipeSizeInches: penetration.pipeSizeInches,
        invertElevation: seeded.length === 0 ? row.lowInvertElevation : "",
      });
    }
  }
  if (seeded.length === 0) {
    seeded.push({
      ...createRectOpeningRow("A"),
      invertElevation: row.lowInvertElevation,
    });
  }
  return { ...row, openings: seeded };
}

export function createDefaultRectDefaults(
  templates: RectSheetTemplateOption[],
): RectWorkbookDefaults {
  const template = templates[0];
  const preset = template?.presetSizes[0];
  return {
    namePrefix: "CB-",
    startNumber: 1,
    templateId: template?.id ?? "",
    insideLengthFeet: preset ? String(preset.insideLengthFeet) : "",
    insideWidthFeet: preset ? String(preset.insideWidthFeet) : "",
    castingProductId: template?.defaultCastingProductId ?? "",
    hasTopSlab: true,
    hasBaseSlab: true,
    baseAttached: true,
    qty: "1",
    maxPickWeightLbs: "",
  };
}

export function nextRectStructureNumber(
  existing: RectWorkbookRow[],
  defaults: RectWorkbookDefaults,
): string {
  const prefix = defaults.namePrefix;
  let max = defaults.startNumber - 1;
  for (const row of existing) {
    const name = row.structureNumber.trim();
    if (!name.startsWith(prefix)) {
      continue;
    }
    const parsed = Number.parseInt(name.slice(prefix.length), 10);
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed;
    }
  }
  return `${prefix}${Math.max(max + 1, defaults.startNumber)}`;
}

export function createDefaultRectRow(
  templates: RectSheetTemplateOption[],
  existing: RectWorkbookRow[],
  defaults: RectWorkbookDefaults,
): RectWorkbookRow {
  const template =
    templates.find((entry) => entry.id === defaults.templateId) ?? templates[0];
  return {
    id: createRowId(),
    structureNumber: nextRectStructureNumber(existing, defaults),
    templateId: defaults.templateId || template?.id || "",
    insideLengthFeet: defaults.insideLengthFeet,
    insideWidthFeet: defaults.insideWidthFeet,
    castingProductId:
      defaults.castingProductId || template?.defaultCastingProductId || "",
    rimElevation: "",
    lowInvertElevation: "",
    hasTopSlab: defaults.hasTopSlab,
    hasBaseSlab: defaults.hasBaseSlab,
    baseAttached: defaults.baseAttached,
    topSlabOpeningLengthInches: "",
    topSlabOpeningWidthInches: "",
    topSlabOpeningSide: "UP",
    penetrations: [],
    openings: [createRectOpeningRow("A")],
    qty: defaults.qty || "1",
    wallHeightFeet: null,
    heaviestPickLbs: null,
    unitPrice: null,
    status: "",
    config: null,
  };
}

export function duplicateRectRow(
  row: RectWorkbookRow,
  existing: RectWorkbookRow[],
  defaults: RectWorkbookDefaults,
): RectWorkbookRow {
  return {
    ...row,
    id: createRowId(),
    lineItemId: undefined,
    structureNumber: nextRectStructureNumber(existing, defaults),
    penetrations: row.penetrations.map((penetration) => ({
      ...penetration,
      id: createRowId(),
    })),
    openings: row.openings.map((opening) => ({
      ...opening,
      id: createRowId(),
    })),
  };
}

/** Backfills fields added after a session/row was first stored. */
export function normalizeRectWorkbookRow(row: RectWorkbookRow): RectWorkbookRow {
  return {
    ...row,
    lowInvertElevation: row.lowInvertElevation ?? "",
    penetrations: row.penetrations ?? [],
    openings: row.openings?.length ? row.openings : [createRectOpeningRow("A")],
  };
}

/**
 * Quote-only mode carries no pipe detail: pricing runs on a single unsized
 * opening at the low invert (walls + slabs; opening prices and sump detail
 * come later with the full drill sheet).
 */
function quoteModeOpenings(row: RectWorkbookRow): RectWorkbookOpeningRow[] {
  return [
    {
      ...createRectOpeningRow("A"),
      invertElevation: row.lowInvertElevation,
    },
  ];
}

/** Prices a row via the same pure calculator the sheet form uses. */
export function computeRectWorkbookRow(
  row: RectWorkbookRow,
  options: RectWorkbookOptions,
  mode: RectWorkbookMode = "FULL",
): RectWorkbookRow {
  const template = options.templates.find(
    (entry) => entry.id === row.templateId,
  );
  if (!template) {
    return { ...row, unitPrice: null, status: "Select a template", config: null };
  }

  const length = parseNum(row.insideLengthFeet);
  const width = parseNum(row.insideWidthFeet);
  if (length == null || width == null) {
    return { ...row, unitPrice: null, status: "Enter the inside size", config: null };
  }

  const workingRow =
    mode === "FULL" ? syncRectRowFromOpenings(row) : row;
  const calcOpenings =
    mode === "FULL" ? workingRow.openings : quoteModeOpenings(workingRow);

  const rim = parseNum(workingRow.rimElevation);
  const openingsWithInverts = calcOpenings.filter(
    (opening) => parseNum(opening.invertElevation) != null,
  );
  if (rim == null || openingsWithInverts.length === 0) {
    return {
      ...workingRow,
      unitPrice: null,
      status:
        mode === "FULL"
          ? "Enter rim and at least one opening invert"
          : "Enter rim and low invert",
      config: null,
    };
  }

  const casting = options.castings.find(
    (entry) => entry.id === workingRow.castingProductId,
  );

  const input: RectStructureInput = {
    rimElevation: rim,
    castingHeightFeet:
      casting?.heightFeet ?? template.defaultCastingHeightFeet ?? 0,
    insideLengthFeet: length,
    insideWidthFeet: width,
    hasTopSlab: workingRow.hasTopSlab,
    hasBaseSlab: workingRow.hasBaseSlab,
    baseAttached: workingRow.baseAttached,
    template: {
      wallThicknessInches: template.wallThicknessInches,
      baseSlabThicknessInches: template.baseSlabThicknessInches,
      topSlabThicknessInches: template.topSlabThicknessInches,
      minimumBrickInches: template.minimumBrickInches,
      sumpMode: template.sumpMode,
      sumpFixedInches: template.sumpFixedInches,
      wallPricePerFoot: template.wallPricePerFoot,
      minPricingHeightFeet: template.minPricingHeightFeet,
      topSlabPrice: template.topSlabPrice,
      baseSlabPrice: template.baseSlabPrice,
    },
    openingSizes: options.openingSizes,
    openings: calcOpenings.map((opening) => ({
      label: opening.label,
      wall: opening.wall,
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: parseNum(opening.pipeSizeInches),
      invertElevation: parseNum(opening.invertElevation),
      angleDegrees: parseNum(opening.angle),
      placement: opening.placement,
      offsetInches: parseNum(opening.offsetInches),
      widthOverrideInches: parseNum(opening.widthOverrideInches),
    })),
    // Splits are decided at drill-sheet time; quote pricing is split-neutral.
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: workingRow.hasTopSlab
      ? {
          lengthInches:
            parseNum(workingRow.topSlabOpeningLengthInches) ?? null,
          widthInches:
            parseNum(workingRow.topSlabOpeningWidthInches) ?? null,
          side: workingRow.topSlabOpeningSide,
        }
      : null,
  };

  const result = computeRectStructure(input);
  const config = buildRectQuoteConfig(
    workingRow,
    template,
    result,
    rim,
    calcOpenings,
    mode,
  );

  const warnings = [...result.warnings];
  if (result.errorMessage) {
    warnings.unshift(result.errorMessage);
  }

  const status =
    result.errorMessage ??
    (warnings.length > 0
      ? warnings[0]
      : config.detailLevel === "FULL"
        ? "Rect sheet ready"
        : "Quote only — cut sheet after award");

  return {
    ...workingRow,
    wallHeightFeet: result.wallHeightFeet,
    heaviestPickLbs: result.weights.heaviestLbs,
    unitPrice: result.errorMessage ? null : result.totalPrice,
    status,
    config,
  };
}

function buildRectQuoteConfig(
  row: RectWorkbookRow,
  template: RectSheetTemplateOption,
  result: RectStructureResult,
  rim: number,
  calcOpenings: RectWorkbookOpeningRow[],
  mode: RectWorkbookMode,
): RectQuoteStructureConfig {
  const openings: RectQuoteOpening[] = [];
  for (const opening of calcOpenings) {
    const invert = parseNum(opening.invertElevation);
    const pipeSize = parseNum(opening.pipeSizeInches);
    const hasPipe = opening.pipeMaterial.trim() !== "" && pipeSize != null;
    // Quote-mode pipes without inverts still ride along (at the low invert)
    // so the pipe list round-trips and award seeding has every opening.
    const effectiveInvert =
      invert ?? (mode === "QUOTE" ? parseNum(row.lowInvertElevation) : null);
    if (effectiveInvert == null || (!hasPipe && invert == null && openings.length > 0)) {
      continue;
    }
    openings.push({
      label: opening.label.trim() || "A",
      wall: opening.wall,
      pipeMaterial: hasPipe ? opening.pipeMaterial : undefined,
      pipeSizeInches: hasPipe ? pipeSize : undefined,
      invertElevation: effectiveInvert,
      angleDegrees: parseNum(opening.angle) ?? 0,
      placement: opening.placement,
      offsetInches: parseNum(opening.offsetInches),
      widthOverrideInches: parseNum(opening.widthOverrideInches),
    });
  }

  // FULL only when entered with full drill-sheet detail and it computes
  // cleanly; quote-only rows always need a cut sheet after award.
  const detailLevel: RectQuoteDetailLevel =
    mode === "FULL" && openings.length > 0 && !result.errorMessage
      ? "FULL"
      : "QUOTE";

  return {
    shape: "RECTANGULAR",
    templateId: template.id,
    templateName: template.name,
    insideLengthFeet: result.insideLengthFeet ?? 0,
    insideWidthFeet: result.insideWidthFeet ?? 0,
    castingProductId: row.castingProductId || null,
    rimElevation: rim,
    lowInvertElevation: result.lowInvertElevation ?? rim,
    hasTopSlab: row.hasTopSlab,
    hasBaseSlab: row.hasBaseSlab,
    baseAttached: row.baseAttached,
    topSlabOpeningLengthInches: result.topSlabOpening?.lengthInches ?? null,
    topSlabOpeningWidthInches: result.topSlabOpening?.widthInches ?? null,
    topSlabOpeningSide: result.topSlabOpening?.side ?? null,
    detailLevel,
    openings,
    wallHeightFeet: result.wallHeightFeet,
    heaviestPickLbs: result.weights.heaviestLbs,
    wallPrice: result.wallPrice,
    topSlabPrice: result.topSlabPrice,
    baseSlabPrice: result.baseSlabPrice,
    openingsPrice: result.openingsPrice,
    totalPrice: result.totalPrice,
    warnings: result.warnings,
    errorMessage: result.errorMessage,
  };
}

export function formatRectStructureDescription(
  config: RectQuoteStructureConfig,
): string {
  const size = `${formatFeetInchesShort(config.insideLengthFeet)} x ${formatFeetInchesShort(config.insideWidthFeet)}`;
  const slabs =
    config.hasTopSlab && config.hasBaseSlab
      ? "Top + Base"
      : config.hasTopSlab
        ? "Top Slab, Open Bottom"
        : config.hasBaseSlab
          ? "No Top Slab"
          : "Open Top + Bottom";
  const wall =
    config.wallHeightFeet != null
      ? ` — ${config.wallHeightFeet.toFixed(1)}' wall`
      : "";
  const pipeSummary = config.openings
    .filter((opening) => opening.pipeSizeInches != null)
    .map((opening) => `${opening.pipeSizeInches}" ${opening.pipeMaterial ?? ""}`.trim())
    .join(", ");
  return `${size} ${config.templateName ?? "Rect Structure"} (${slabs}) — Rim ${config.rimElevation.toFixed(2)}' / Inv ${config.lowInvertElevation.toFixed(2)}'${wall}${pipeSummary ? ` — Pipes: ${pipeSummary}` : ""}`;
}

export function rectWorkbookRowToLineItem(
  row: RectWorkbookRow,
  lineNumber: number,
): EditableQuoteLineItem | null {
  if (!row.config || row.unitPrice == null) {
    return null;
  }
  return {
    id: row.lineItemId ?? createRowId(),
    lineNumber,
    type: "CONFIGURABLE_STRUCTURE",
    typeLabel: quoteLineItemTypeLabels.CONFIGURABLE_STRUCTURE,
    item: row.structureNumber.trim() || "Structure",
    description: formatRectStructureDescription(row.config),
    qty: row.qty.trim() || "1",
    unit: "EA",
    unitPrice: row.unitPrice.toFixed(2),
    weight:
      row.heaviestPickLbs != null ? String(Math.round(row.heaviestPickLbs)) : "",
    yards: "",
    taxable: true,
    statusNote:
      row.config.detailLevel === "FULL"
        ? "Rect sheet ready — create after award."
        : "Cut sheet required after award.",
    rectStructureConfig: row.config,
  };
}

export function rectLineItemToWorkbookRow(
  line: EditableQuoteLineItem,
): RectWorkbookRow | null {
  const config = line.rectStructureConfig;
  if (!config) {
    return null;
  }
  const penetrationGroups = new Map<string, RectWorkbookPenetration>();
  for (const opening of config.openings) {
    if (opening.pipeMaterial && opening.pipeSizeInches != null) {
      const key = `${opening.pipeMaterial}|${opening.pipeSizeInches}`;
      const existing = penetrationGroups.get(key);
      if (existing) {
        existing.qty = String((Number(existing.qty) || 0) + 1);
      } else {
        penetrationGroups.set(key, {
          id: createRowId(),
          pipeMaterial: opening.pipeMaterial,
          pipeSizeInches: String(opening.pipeSizeInches),
          qty: "1",
        });
      }
    }
  }

  return {
    id: createRowId(),
    lineItemId: line.id,
    structureNumber: line.item,
    templateId: config.templateId,
    insideLengthFeet: String(config.insideLengthFeet),
    insideWidthFeet: String(config.insideWidthFeet),
    castingProductId: config.castingProductId ?? "",
    rimElevation: String(config.rimElevation),
    lowInvertElevation: String(config.lowInvertElevation),
    penetrations:
      penetrationGroups.size > 0
        ? [...penetrationGroups.values()]
        : [createRectPenetration()],
    hasTopSlab: config.hasTopSlab,
    hasBaseSlab: config.hasBaseSlab,
    baseAttached: config.baseAttached,
    topSlabOpeningLengthInches:
      config.topSlabOpeningLengthInches != null
        ? String(config.topSlabOpeningLengthInches)
        : "",
    topSlabOpeningWidthInches:
      config.topSlabOpeningWidthInches != null
        ? String(config.topSlabOpeningWidthInches)
        : "",
    topSlabOpeningSide: config.topSlabOpeningSide ?? "UP",
    openings: config.openings.length
      ? config.openings.map((opening) => ({
          id: createRowId(),
          label: opening.label,
          wall: opening.wall,
          pipeMaterial: opening.pipeMaterial ?? "",
          pipeSizeInches: opening.pipeSizeInches?.toString() ?? "",
          invertElevation: String(opening.invertElevation),
          angle:
            opening.angleDegrees != null && opening.angleDegrees !== 0
              ? String(opening.angleDegrees)
              : "",
          placement: opening.placement ?? "CENTERED",
          offsetInches:
            opening.offsetInches != null ? String(opening.offsetInches) : "",
          widthOverrideInches:
            opening.widthOverrideInches != null
              ? String(opening.widthOverrideInches)
              : "",
        }))
      : [createRectOpeningRow("A")],
    qty: line.qty,
    wallHeightFeet: config.wallHeightFeet ?? null,
    heaviestPickLbs: config.heaviestPickLbs ?? null,
    unitPrice: config.totalPrice ?? parseNum(line.unitPrice),
    status: config.errorMessage ?? config.warnings?.[0] ?? "",
    config,
  };
}

/**
 * Adds rows pasted from Excel (tab-separated). Column order:
 * Structure #, Template name, Length, Width, Rim, Low Invert, Qty.
 */
export function applyRectTsvToRows(
  tsvRows: string[][],
  templates: RectSheetTemplateOption[],
  defaults: RectWorkbookDefaults,
  existing: RectWorkbookRow[],
): RectWorkbookRow[] {
  const next: RectWorkbookRow[] = [];
  const templateByName = new Map(
    templates.map((template) => [template.name.toLowerCase(), template]),
  );

  for (const cells of tsvRows) {
    if (cells.every((cell) => cell.trim() === "")) {
      continue;
    }
    const row = createDefaultRectRow(templates, [...existing, ...next], defaults);
    if (cells[0]?.trim()) row.structureNumber = cells[0].trim();

    const templateName = cells[1]?.trim().toLowerCase();
    if (templateName) {
      const match = templateByName.get(templateName);
      if (match) {
        row.templateId = match.id;
      }
    }

    if (cells[2]?.trim()) row.insideLengthFeet = cells[2].trim();
    if (cells[3]?.trim()) row.insideWidthFeet = cells[3].trim();
    if (cells[4]?.trim()) row.rimElevation = cells[4].trim();
    if (cells[5]?.trim()) row.lowInvertElevation = cells[5].trim();
    if (cells[6]?.trim()) row.qty = cells[6].trim();

    next.push(row);
  }

  return next;
}

export function isRectStructureLine(line: EditableQuoteLineItem): boolean {
  return line.type === "CONFIGURABLE_STRUCTURE" && line.rectStructureConfig != null;
}

/**
 * Line items the rect workbook returns to the quote: every structure line it
 * does NOT manage (circular workbook lines) passed through untouched, then
 * the rect lines. The quote form's merge keeps non-structure lines itself.
 */
export function buildRectApplyLineItems(
  pendingLineItems: EditableQuoteLineItem[],
  rectLines: EditableQuoteLineItem[],
): EditableQuoteLineItem[] {
  const passthrough = pendingLineItems.filter(
    (line) =>
      line.type === "CONFIGURABLE_STRUCTURE" &&
      line.structureConfig != null &&
      line.rectStructureConfig == null,
  );
  return [...passthrough, ...rectLines];
}

export function parseRectStructureConfigJson(
  value: unknown,
): RectQuoteStructureConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const data = value as Record<string, unknown>;
  if (data.shape !== "RECTANGULAR") {
    return null;
  }
  if (
    typeof data.templateId !== "string" ||
    typeof data.insideLengthFeet !== "number" ||
    typeof data.insideWidthFeet !== "number" ||
    typeof data.rimElevation !== "number"
  ) {
    return null;
  }

  const openings: RectQuoteOpening[] = [];
  if (Array.isArray(data.openings)) {
    for (const entry of data.openings) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const opening = entry as Record<string, unknown>;
      if (typeof opening.invertElevation !== "number") {
        continue;
      }
      openings.push({
        label: typeof opening.label === "string" ? opening.label : "A",
        wall: normalizeWall(opening.wall) ?? "UP",
        pipeMaterial:
          typeof opening.pipeMaterial === "string"
            ? opening.pipeMaterial
            : undefined,
        pipeSizeInches:
          typeof opening.pipeSizeInches === "number"
            ? opening.pipeSizeInches
            : undefined,
        invertElevation: opening.invertElevation,
        angleDegrees:
          typeof opening.angleDegrees === "number" ? opening.angleDegrees : 0,
        placement: PLACEMENTS.includes(
          opening.placement as RectOpeningPlacement,
        )
          ? (opening.placement as RectOpeningPlacement)
          : "CENTERED",
        offsetInches:
          typeof opening.offsetInches === "number"
            ? opening.offsetInches
            : null,
        widthOverrideInches:
          typeof opening.widthOverrideInches === "number"
            ? opening.widthOverrideInches
            : null,
      });
    }
  }

  return {
    shape: "RECTANGULAR",
    templateId: data.templateId,
    templateName:
      typeof data.templateName === "string" ? data.templateName : undefined,
    insideLengthFeet: data.insideLengthFeet,
    insideWidthFeet: data.insideWidthFeet,
    castingProductId:
      typeof data.castingProductId === "string" ? data.castingProductId : null,
    rimElevation: data.rimElevation,
    lowInvertElevation:
      typeof data.lowInvertElevation === "number"
        ? data.lowInvertElevation
        : data.rimElevation,
    hasTopSlab: data.hasTopSlab !== false,
    hasBaseSlab: data.hasBaseSlab !== false,
    baseAttached: data.baseAttached !== false,
    topSlabOpeningLengthInches:
      typeof data.topSlabOpeningLengthInches === "number"
        ? data.topSlabOpeningLengthInches
        : null,
    topSlabOpeningWidthInches:
      typeof data.topSlabOpeningWidthInches === "number"
        ? data.topSlabOpeningWidthInches
        : null,
    topSlabOpeningSide: normalizeWall(data.topSlabOpeningSide),
    detailLevel: data.detailLevel === "FULL" ? "FULL" : "QUOTE",
    openings,
    wallHeightFeet:
      typeof data.wallHeightFeet === "number" ? data.wallHeightFeet : undefined,
    heaviestPickLbs:
      typeof data.heaviestPickLbs === "number" ? data.heaviestPickLbs : null,
    wallPrice: typeof data.wallPrice === "number" ? data.wallPrice : undefined,
    topSlabPrice:
      typeof data.topSlabPrice === "number" ? data.topSlabPrice : undefined,
    baseSlabPrice:
      typeof data.baseSlabPrice === "number" ? data.baseSlabPrice : undefined,
    openingsPrice:
      typeof data.openingsPrice === "number" ? data.openingsPrice : undefined,
    totalPrice:
      typeof data.totalPrice === "number" ? data.totalPrice : undefined,
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined,
    errorMessage:
      typeof data.errorMessage === "string" ? data.errorMessage : null,
  };
}
