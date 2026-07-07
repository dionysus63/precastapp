import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";
import { quoteLineItemTypeLabels } from "@/lib/quotes/constants";
import {
  computeDrillSheet,
  lookupPipeOpeningSize,
  type DiameterConfig,
  type DrillSheetInput,
  type PipeConnectionType,
  type PipeOpeningSizeEntry,
  type TemplateConfig,
} from "@/lib/drill-sheet";

export type WorkbookMode = "QUOTE" | "DRILL_SHEET";
export type QuoteStructureDetailLevel = "QUOTE" | "DRILL_SHEET";

export type QuoteStructureOpening = {
  label: string;
  pipeMaterial?: string;
  pipeSizeInches?: number;
  pipeType?: string;
  invertElevation: number;
  angleDegrees?: number;
  connectionType?: PipeConnectionType | null;
};

export type StructureWorkbookOpeningRow = {
  id: string;
  label: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  pipeType: string;
  invertElevation: string;
  angleDegrees: string;
  connectionType: string;
};

/** One pipe size entering a structure in quote-only mode (no invert/angle). */
export type StructureWorkbookPenetration = {
  id: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  qty: string;
};

export type QuoteStructurePenetration = {
  pipeMaterial: string;
  pipeSizeInches: number;
  qty: number;
};

export type QuoteStructureConfig = {
  templateId: string;
  templateName?: string;
  diameterFeet: number;
  castingProductId?: string | null;
  rimElevation: number;
  lowInvertElevation: number;
  pipeMaterial?: string;
  pipeSizeInches?: number;
  pipeType?: string;
  bootCount: number;
  detailLevel?: QuoteStructureDetailLevel;
  penetrations?: QuoteStructurePenetration[];
  openings?: QuoteStructureOpening[];
  wallHeightFeet?: number;
  wallPrice?: number;
  bootsPrice?: number;
  totalPrice?: number;
  warnings?: string[];
  errorMessage?: string | null;
};

export type StructureDrillSheetStatus = "created" | "ready" | "quote_only";

export type StructureWorkbookRow = {
  id: string;
  lineItemId?: string;
  structureNumber: string;
  templateId: string;
  diameterFeet: string;
  castingProductId: string;
  rimElevation: string;
  lowInvertElevation: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  pipeType: string;
  bootCount: string;
  qty: string;
  penetrations: StructureWorkbookPenetration[];
  openings: StructureWorkbookOpeningRow[];
  wallHeightFeet: number | null;
  unitPrice: number | null;
  status: string;
  structureConfig: QuoteStructureConfig | null;
};

export type StructureWorkbookDefaults = {
  namePrefix: string;
  startNumber: number;
  templateId: string;
  diameterFeet: string;
  castingProductId: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  bootCount: string;
  qty: string;
};

/** Quote header fields preserved while the structure workbook is open. */
export type QuoteFormWorkbookSnapshot = {
  customerId: string;
  customerName: string;
  customerLocked: boolean;
  jobId: string;
  jobBidderId: string;
  selectedJobLabel: string;
  jobNumber: string;
  projectName: string;
  scopeLabel: string;
  projectAddress: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactTitle: string;
};

export type StructureWorkbookSession = {
  rows: StructureWorkbookRow[];
  returnPath: string;
  pendingLineItems: EditableQuoteLineItem[] | null;
  pendingFormState?: QuoteFormWorkbookSnapshot | null;
  defaults?: StructureWorkbookDefaults;
  workbookMode?: WorkbookMode;
  planSheetId?: string | null;
  planMarkup?: import("@/lib/quotes/plan-sheet-markup").PlanSheetMarkup | null;
  viewMode?: "grid" | "takeoff";
  /** Rectangular-workbook lines carried through untouched on apply. */
  rectPassthroughLines?: EditableQuoteLineItem[] | null;
};

export type StructureWorkbookApplyPayload = {
  lineItems: EditableQuoteLineItem[];
  returnPath: string;
  planSheetId?: string | null;
};

export type StructureWorkbookOptions = {
  templates: DrillSheetTemplateOption[];
  castings: { id: string; name: string; heightFeet: number | null }[];
  pipeOpeningSizes: PipeOpeningSizeEntry[];
  diameterConfigs: DiameterConfig[];
};

const SESSION_PREFIX = "precast:quote-structure-workbook:";
const APPLY_PREFIX = "precast:quote-structure-workbook-apply:";

export function workbookSessionKey(quoteId: string | null | undefined): string {
  return `${SESSION_PREFIX}${quoteId ?? "new"}`;
}

export function workbookApplyKey(quoteId: string | null | undefined): string {
  return `${APPLY_PREFIX}${quoteId ?? "new"}`;
}

export function readWorkbookSession(
  quoteId: string | null | undefined,
): StructureWorkbookSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(workbookSessionKey(quoteId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StructureWorkbookSession;
  } catch {
    return null;
  }
}

export function writeWorkbookSession(
  quoteId: string | null | undefined,
  session: StructureWorkbookSession,
): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(
    workbookSessionKey(quoteId),
    JSON.stringify(session),
  );
}

export function readWorkbookApplyPayload(
  quoteId: string | null | undefined,
): StructureWorkbookApplyPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(workbookApplyKey(quoteId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StructureWorkbookApplyPayload;
  } catch {
    return null;
  }
}

export function writeWorkbookApplyPayload(
  quoteId: string | null | undefined,
  payload: StructureWorkbookApplyPayload,
): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(workbookApplyKey(quoteId), JSON.stringify(payload));
}

export function clearWorkbookApplyPayload(
  quoteId: string | null | undefined,
): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.removeItem(workbookApplyKey(quoteId));
}

export function createRowId(): string {
  return `wb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultOpening(label: string): StructureWorkbookOpeningRow {
  return {
    id: createRowId(),
    label,
    pipeMaterial: "",
    pipeSizeInches: "",
    pipeType: "",
    invertElevation: "",
    angleDegrees: "0",
    connectionType: "",
  };
}

export function nextOpeningLabel(existingCount: number): string {
  return String.fromCharCode(65 + existingCount);
}

export function createDefaultPenetration(): StructureWorkbookPenetration {
  return {
    id: createRowId(),
    pipeMaterial: "",
    pipeSizeInches: "",
    qty: "1",
  };
}

/** Fills in `penetrations` for rows created before the field existed. */
export function ensureRowPenetrations(
  row: StructureWorkbookRow,
): StructureWorkbookRow {
  if (row.penetrations?.length) {
    return row;
  }

  if (row.pipeMaterial.trim()) {
    return {
      ...row,
      penetrations: [
        {
          id: createRowId(),
          pipeMaterial: row.pipeMaterial,
          pipeSizeInches: row.pipeSizeInches,
          qty: row.bootCount.trim() || "1",
        },
      ],
    };
  }

  return { ...row, penetrations: [createDefaultPenetration()] };
}

/** Derives legacy single-pipe fields and boot count from the penetrations list. */
export function syncRowFromPenetrations(
  row: StructureWorkbookRow,
): StructureWorkbookRow {
  const penetrations = row.penetrations ?? [];
  let bootCount = 0;
  for (const penetration of penetrations) {
    if (
      penetration.pipeMaterial.trim() &&
      parseNum(penetration.pipeSizeInches) != null
    ) {
      bootCount += Math.max(1, Math.floor(parseNum(penetration.qty) ?? 1));
    }
  }

  const first = penetrations[0];

  return {
    ...row,
    bootCount: String(bootCount),
    pipeMaterial: first?.pipeMaterial ?? "",
    pipeSizeInches: first?.pipeSizeInches ?? "",
    pipeType: "",
  };
}

export function seedOpeningsFromRow(
  row: StructureWorkbookRow,
): StructureWorkbookOpeningRow[] {
  if (row.openings?.length) {
    return row.openings;
  }

  // Expand quote-only penetrations into openings: each pipe becomes its own
  // opening; the first one carries the row's low invert so it prices.
  const seeded: StructureWorkbookOpeningRow[] = [];
  for (const penetration of ensureRowPenetrations(row).penetrations) {
    if (
      !penetration.pipeMaterial.trim() ||
      parseNum(penetration.pipeSizeInches) == null
    ) {
      continue;
    }
    const count = Math.max(1, Math.floor(parseNum(penetration.qty) ?? 1));
    for (let index = 0; index < count; index += 1) {
      seeded.push({
        id: createRowId(),
        label: nextOpeningLabel(seeded.length),
        pipeMaterial: penetration.pipeMaterial,
        pipeSizeInches: penetration.pipeSizeInches,
        pipeType: "",
        invertElevation: seeded.length === 0 ? row.lowInvertElevation : "",
        angleDegrees: "0",
        connectionType: "",
      });
    }
  }

  if (seeded.length > 0) {
    return seeded;
  }

  return [
    {
      id: createRowId(),
      label: "A",
      pipeMaterial: row.pipeMaterial,
      pipeSizeInches: row.pipeSizeInches,
      pipeType: "",
      invertElevation: row.lowInvertElevation,
      angleDegrees: "0",
      connectionType: "",
    },
  ];
}

export function ensureRowOpenings(row: StructureWorkbookRow): StructureWorkbookRow {
  return {
    ...row,
    openings: seedOpeningsFromRow(row),
  };
}

/** Backfills fields added after a session/row was first stored. */
export function normalizeWorkbookRow(
  row: StructureWorkbookRow,
): StructureWorkbookRow {
  return ensureRowOpenings(
    ensureRowPenetrations({
      ...row,
      penetrations: row.penetrations ?? [],
      openings: row.openings ?? [],
    }),
  );
}

/**
 * Prepares a row for full drill-sheet mode. Blank placeholder openings are
 * replaced by openings seeded from the quote-only penetrations list.
 */
export function upgradeRowToFullDetail(
  row: StructureWorkbookRow,
): StructureWorkbookRow {
  const withPenetrations = ensureRowPenetrations(row);
  const hasRealOpenings = (row.openings ?? []).some(
    (opening) =>
      opening.pipeMaterial.trim() !== "" ||
      parseNum(opening.invertElevation) != null,
  );
  const base = hasRealOpenings
    ? withPenetrations
    : { ...withPenetrations, openings: [] };
  return syncRowFromOpenings(ensureRowOpenings(base));
}

export function syncRowFromOpenings(row: StructureWorkbookRow): StructureWorkbookRow {
  const openings = row.openings ?? [];
  let lowestInvert: number | null = null;
  let bootCount = 0;
  const penetrationGroups = new Map<string, StructureWorkbookPenetration>();

  for (const opening of openings) {
    const invert = parseNum(opening.invertElevation);
    if (invert != null) {
      if (lowestInvert == null || invert < lowestInvert) {
        lowestInvert = invert;
      }
    }
    if (opening.pipeMaterial.trim() && parseNum(opening.pipeSizeInches) != null) {
      bootCount += 1;
      const key = `${opening.pipeMaterial}|${opening.pipeSizeInches}`;
      const existing = penetrationGroups.get(key);
      if (existing) {
        existing.qty = String((parseNum(existing.qty) ?? 0) + 1);
      } else {
        penetrationGroups.set(key, {
          id: createRowId(),
          pipeMaterial: opening.pipeMaterial,
          pipeSizeInches: opening.pipeSizeInches,
          qty: "1",
        });
      }
    }
  }

  const openingA = openings[0];
  const penetrations = [...penetrationGroups.values()];

  return {
    ...row,
    lowInvertElevation:
      lowestInvert != null ? String(lowestInvert) : row.lowInvertElevation,
    bootCount: String(bootCount),
    pipeMaterial: openingA?.pipeMaterial ?? row.pipeMaterial,
    pipeSizeInches: openingA?.pipeSizeInches ?? row.pipeSizeInches,
    pipeType: "",
    penetrations:
      penetrations.length > 0 ? penetrations : row.penetrations ?? [],
  };
}

export function isFullDetailReady(row: StructureWorkbookRow): boolean {
  const openings = row.openings ?? [];
  const openingA = openings[0];
  return openingA != null && parseNum(openingA.invertElevation) != null;
}

export function getStructureDrillSheetStatus(
  config: QuoteStructureConfig | null | undefined,
  /** True when the line's linked JobStructure is an actual drill sheet
   * (has a structure template) — plain won-quote structures don't count. */
  hasLinkedDrillSheet: boolean,
): StructureDrillSheetStatus | null {
  if (!config) {
    return null;
  }
  if (hasLinkedDrillSheet) {
    return "created";
  }
  if (config.detailLevel === "DRILL_SHEET") {
    return "ready";
  }
  return "quote_only";
}

export function countDrillSheetReadyLines(
  lineItems: EditableQuoteLineItem[],
): number {
  return lineItems.filter((line) => {
    if (line.type !== "CONFIGURABLE_STRUCTURE") {
      return false;
    }
    if (line.structureConfig?.detailLevel === "DRILL_SHEET") {
      return true;
    }
    return line.rectStructureConfig?.detailLevel === "FULL";
  }).length;
}

export function formatStructureNumber(
  prefix: string,
  number: number,
): string {
  return `${prefix}${number}`;
}

export function nextStructureNumber(
  existing: StructureWorkbookRow[],
  defaults: StructureWorkbookDefaults,
): number {
  const prefix = defaults.namePrefix;
  let max = defaults.startNumber - 1;

  for (const row of existing) {
    const name = row.structureNumber.trim();
    if (!name.startsWith(prefix)) {
      continue;
    }
    const suffix = name.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed;
    }
  }

  return Math.max(max + 1, defaults.startNumber);
}

export function createDefaultWorkbookDefaults(
  templates: DrillSheetTemplateOption[],
): StructureWorkbookDefaults {
  const template = templates[0];
  return {
    namePrefix: "MH-",
    startNumber: 1,
    templateId: template?.id ?? "",
    diameterFeet: template?.diameters[0]
      ? String(template.diameters[0].insideDiameterFeet)
      : "",
    castingProductId: template?.defaultCastingProductId ?? "",
    pipeMaterial: "",
    pipeSizeInches: "",
    bootCount: "1",
    qty: "1",
  };
}

export function applyDefaultsToBlankRow(
  row: StructureWorkbookRow,
  defaults: StructureWorkbookDefaults,
): StructureWorkbookRow {
  const withPenetrations = ensureRowPenetrations(row);
  const penetrations = withPenetrations.penetrations.map(
    (penetration, index) => {
      if (index > 0 || penetration.pipeMaterial.trim()) {
        return penetration;
      }
      return {
        ...penetration,
        pipeMaterial: defaults.pipeMaterial,
        pipeSizeInches: penetration.pipeSizeInches.trim()
          ? penetration.pipeSizeInches
          : defaults.pipeSizeInches,
        qty: penetration.qty.trim() ? penetration.qty : defaults.bootCount,
      };
    },
  );

  return syncRowFromPenetrations({
    ...withPenetrations,
    templateId: row.templateId.trim() ? row.templateId : defaults.templateId,
    diameterFeet: row.diameterFeet.trim()
      ? row.diameterFeet
      : defaults.diameterFeet,
    castingProductId: row.castingProductId.trim()
      ? row.castingProductId
      : defaults.castingProductId,
    penetrations,
    qty: row.qty.trim() ? row.qty : defaults.qty,
  });
}

export function commitWorkbookRowPrice(
  row: StructureWorkbookRow,
  options: StructureWorkbookOptions,
  workbookMode: WorkbookMode = "QUOTE",
): StructureWorkbookRow {
  const computed = computeWorkbookRowPrice(row, options, workbookMode);
  return {
    ...row,
    wallHeightFeet: computed.wallHeightFeet,
    unitPrice: computed.unitPrice,
    status: computed.status,
    structureConfig: computed.structureConfig,
  };
}

export function commitAllWorkbookRowPrices(
  rows: StructureWorkbookRow[],
  options: StructureWorkbookOptions,
  workbookMode: WorkbookMode = "QUOTE",
): StructureWorkbookRow[] {
  return rows.map((row) => commitWorkbookRowPrice(row, options, workbookMode));
}

export function createDefaultWorkbookRow(
  templates: DrillSheetTemplateOption[],
  existing?: StructureWorkbookRow[],
  defaults?: StructureWorkbookDefaults,
): StructureWorkbookRow {
  const workbookDefaults =
    defaults ?? createDefaultWorkbookDefaults(templates);
  const template =
    templates.find((entry) => entry.id === workbookDefaults.templateId) ??
    templates[0];
  const number = nextStructureNumber(existing ?? [], workbookDefaults);

  return {
    id: createRowId(),
    structureNumber: formatStructureNumber(
      workbookDefaults.namePrefix,
      number,
    ),
    templateId: workbookDefaults.templateId || template?.id || "",
    diameterFeet:
      workbookDefaults.diameterFeet ||
      (template?.diameters[0]
        ? String(template.diameters[0].insideDiameterFeet)
        : ""),
    castingProductId:
      workbookDefaults.castingProductId ||
      template?.defaultCastingProductId ||
      "",
    rimElevation: "",
    lowInvertElevation: "",
    pipeMaterial: workbookDefaults.pipeMaterial,
    pipeSizeInches: workbookDefaults.pipeSizeInches,
    pipeType: "",
    bootCount: workbookDefaults.bootCount || "1",
    qty: workbookDefaults.qty || "1",
    penetrations: [
      {
        id: createRowId(),
        pipeMaterial: workbookDefaults.pipeMaterial,
        pipeSizeInches: workbookDefaults.pipeSizeInches,
        qty: workbookDefaults.bootCount || "1",
      },
    ],
    openings: [createDefaultOpening("A")],
    wallHeightFeet: null,
    unitPrice: null,
    status: "",
    structureConfig: null,
  };
}

function parseNum(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function templateToConfig(template: DrillSheetTemplateOption): TemplateConfig {
  return {
    wallThicknessInches: template.wallThicknessInches,
    baseSlabThicknessInches: template.baseSlabThicknessInches,
    topSlabThicknessInches: template.topSlabThicknessInches,
    minimumBrickInches: template.minimumBrickInches,
    connectionType: template.connectionType,
    sumpMode: template.sumpMode,
    sumpFixedInches: template.sumpFixedInches,
    openingToJointMinTopInches: template.openingToJointMinTopInches,
    openingToJointMinBottomInches: template.openingToJointMinBottomInches,
  };
}

function openingsToQuoteConfig(
  openings: StructureWorkbookOpeningRow[],
  templateConnectionType: PipeConnectionType,
): QuoteStructureOpening[] {
  const result: QuoteStructureOpening[] = [];

  for (const opening of openings) {
    const invert = parseNum(opening.invertElevation);
    if (invert == null) {
      continue;
    }
    const pipeSize = parseNum(opening.pipeSizeInches);
    const hasPipe = opening.pipeMaterial.trim() !== "" && pipeSize != null;
    result.push({
      label: opening.label.trim() || "A",
      pipeMaterial: hasPipe ? opening.pipeMaterial : undefined,
      pipeSizeInches: hasPipe ? pipeSize : undefined,
      pipeType: hasPipe ? opening.pipeType : undefined,
      invertElevation: invert,
      angleDegrees: parseNum(opening.angleDegrees) ?? 0,
      connectionType: hasPipe
        ? ((opening.connectionType ||
            templateConnectionType) as PipeConnectionType)
        : null,
    });
  }

  return result;
}

function penetrationsToQuoteConfig(
  penetrations: StructureWorkbookPenetration[],
): QuoteStructurePenetration[] {
  const result: QuoteStructurePenetration[] = [];
  for (const penetration of penetrations) {
    const size = parseNum(penetration.pipeSizeInches);
    if (!penetration.pipeMaterial.trim() || size == null) {
      continue;
    }
    result.push({
      pipeMaterial: penetration.pipeMaterial,
      pipeSizeInches: size,
      qty: Math.max(1, Math.floor(parseNum(penetration.qty) ?? 1)),
    });
  }
  return result;
}

function computePenetrationsBootsPrice(
  penetrations: StructureWorkbookPenetration[],
  pipeOpeningSizes: PipeOpeningSizeEntry[],
  connectionType: PipeConnectionType,
): { bootsPrice: number; bootCount: number; missingPrices: string[] } {
  let bootsPrice = 0;
  let bootCount = 0;
  const missingPrices: string[] = [];

  for (const penetration of penetrations) {
    const size = parseNum(penetration.pipeSizeInches);
    if (!penetration.pipeMaterial.trim() || size == null) {
      continue;
    }
    const qty = Math.max(1, Math.floor(parseNum(penetration.qty) ?? 1));
    bootCount += qty;

    if (connectionType !== "KOR_N_SEAL") {
      continue;
    }
    const match = lookupPipeOpeningSize(
      pipeOpeningSizes,
      penetration.pipeMaterial,
      size,
      true,
    );
    if (match?.pricePerBoot != null) {
      bootsPrice += match.pricePerBoot * qty;
    } else {
      missingPrices.push(`${size}" ${penetration.pipeMaterial}`);
    }
  }

  return {
    bootsPrice: Math.round(bootsPrice * 100) / 100,
    bootCount,
    missingPrices,
  };
}

function buildDrillSheetOpeningsInput(
  row: StructureWorkbookRow,
  template: DrillSheetTemplateOption,
  workbookMode: WorkbookMode,
): DrillSheetInput["openings"] {
  if (workbookMode === "DRILL_SHEET") {
    const synced = syncRowFromOpenings(ensureRowOpenings(row));
    const result: DrillSheetInput["openings"] = [];

    for (const opening of synced.openings) {
      const invert = parseNum(opening.invertElevation);
      if (invert == null) {
        continue;
      }
      const pipeSize = parseNum(opening.pipeSizeInches);
      const hasPipe = opening.pipeMaterial.trim() !== "" && pipeSize != null;
      result.push({
        label: opening.label.trim() || "A",
        pipeMaterial: hasPipe ? opening.pipeMaterial : null,
        pipeSizeInches: hasPipe ? pipeSize : null,
        pipeType: hasPipe ? opening.pipeType : null,
        invertElevation: invert,
        angleDegrees: parseNum(opening.angleDegrees) ?? 0,
        connectionType: hasPipe
          ? ((opening.connectionType ||
              template.connectionType) as PipeConnectionType)
          : null,
      });
    }

    return result;
  }

  const lowInvert = parseNum(row.lowInvertElevation);
  if (lowInvert == null) {
    return [];
  }

  const pipeSize = parseNum(row.pipeSizeInches);
  const hasPipe = row.pipeMaterial.trim() !== "" && pipeSize != null;

  return [
    {
      label: "A",
      pipeMaterial: hasPipe ? row.pipeMaterial : null,
      pipeSizeInches: hasPipe ? pipeSize : null,
      pipeType: hasPipe ? row.pipeType : null,
      invertElevation: lowInvert,
      angleDegrees: 0,
      connectionType: hasPipe ? template.connectionType : null,
    },
  ];
}

export function computeWorkbookRowPrice(
  row: StructureWorkbookRow,
  options: StructureWorkbookOptions,
  workbookMode: WorkbookMode = "QUOTE",
): {
  wallHeightFeet: number | null;
  unitPrice: number | null;
  status: string;
  structureConfig: QuoteStructureConfig | null;
} {
  const template = options.templates.find((entry) => entry.id === row.templateId);
  const rim = parseNum(row.rimElevation);
  const diameterFeet = parseNum(row.diameterFeet);

  const workingRow =
    workbookMode === "DRILL_SHEET"
      ? syncRowFromOpenings(ensureRowOpenings(row))
      : syncRowFromPenetrations(ensureRowPenetrations(row));
  const lowInvert = parseNum(workingRow.lowInvertElevation);

  if (!template) {
    return {
      wallHeightFeet: null,
      unitPrice: null,
      status: "Select a template",
      structureConfig: null,
    };
  }

  if (diameterFeet == null) {
    return {
      wallHeightFeet: null,
      unitPrice: null,
      status: "Select a diameter",
      structureConfig: null,
    };
  }

  const diameterConfig = options.diameterConfigs.find(
    (entry) => Math.abs(entry.insideDiameterFeet - diameterFeet) < 1e-6,
  );

  if (!diameterConfig) {
    return {
      wallHeightFeet: null,
      unitPrice: null,
      status: "No diameter pricing configured",
      structureConfig: null,
    };
  }

  if (rim == null || lowInvert == null) {
    return {
      wallHeightFeet: null,
      unitPrice: null,
      status:
        workbookMode === "DRILL_SHEET"
          ? "Enter rim and opening inverts"
          : "Enter rim and low invert",
      structureConfig: null,
    };
  }

  const casting = options.castings.find(
    (entry) => entry.id === row.castingProductId,
  );
  const castingHeightFeet =
    casting?.heightFeet ?? template.defaultCastingHeightFeet ?? 0;

  const drillOpenings = buildDrillSheetOpeningsInput(
    workingRow,
    template,
    workbookMode,
  );

  if (drillOpenings.length === 0) {
    return {
      wallHeightFeet: null,
      unitPrice: null,
      status:
        workbookMode === "DRILL_SHEET"
          ? "Add at least opening A with invert"
          : "Enter rim and low invert",
      structureConfig: null,
    };
  }

  const input: DrillSheetInput = {
    rimElevation: rim,
    castingHeightFeet,
    diameter: diameterConfig,
    template: templateToConfig(template),
    pipeOpeningSizes: options.pipeOpeningSizes,
    openings: drillOpenings,
  };

  const result = computeDrillSheet(input);

  const warnings = [...result.warnings];
  if (result.errorMessage) {
    warnings.unshift(result.errorMessage);
  }

  const pipeSize = parseNum(workingRow.pipeSizeInches);
  const hasPipe =
    workingRow.pipeMaterial.trim() !== "" && pipeSize != null;

  let bootsPrice = result.bootsPrice;
  let bootCount = Math.max(
    0,
    Math.floor(parseNum(workingRow.bootCount) ?? 0),
  );

  if (workbookMode === "QUOTE") {
    // Boot pricing comes from the penetrations list so each pipe size is
    // priced with its own boot, not the first pipe's boot × count.
    const penetrationPricing = computePenetrationsBootsPrice(
      workingRow.penetrations,
      options.pipeOpeningSizes,
      template.connectionType,
    );
    bootsPrice = penetrationPricing.bootsPrice;
    bootCount = penetrationPricing.bootCount;
    for (const missing of penetrationPricing.missingPrices) {
      warnings.push(`No boot price found for ${missing}.`);
    }
  } else if (
    hasPipe &&
    result.bootsPrice === 0 &&
    template.connectionType === "KOR_N_SEAL"
  ) {
    warnings.push("No boot price found for selected pipe size.");
  }

  const totalPrice = Math.round((result.wallPrice + bootsPrice) * 100) / 100;

  const fullDetailReady =
    workbookMode === "DRILL_SHEET" && isFullDetailReady(workingRow);
  const detailLevel: QuoteStructureDetailLevel = fullDetailReady
    ? "DRILL_SHEET"
    : "QUOTE";
  const quoteOpenings =
    fullDetailReady && workingRow.openings?.length
      ? openingsToQuoteConfig(workingRow.openings, template.connectionType)
      : undefined;
  const quotePenetrations = penetrationsToQuoteConfig(
    workingRow.penetrations ?? [],
  );

  const structureConfig: QuoteStructureConfig = {
    templateId: template.id,
    templateName: template.name,
    diameterFeet,
    castingProductId: row.castingProductId || null,
    rimElevation: rim,
    lowInvertElevation: lowInvert,
    pipeMaterial: hasPipe ? workingRow.pipeMaterial : undefined,
    pipeSizeInches: hasPipe ? pipeSize! : undefined,
    pipeType: hasPipe ? workingRow.pipeType : undefined,
    bootCount,
    detailLevel,
    penetrations:
      quotePenetrations.length > 0 ? quotePenetrations : undefined,
    openings: quoteOpenings,
    wallHeightFeet: result.wallHeightFeet,
    wallPrice: result.wallPrice,
    bootsPrice,
    totalPrice,
    warnings,
    errorMessage: result.errorMessage,
  };

  let status =
    result.errorMessage ??
    (warnings.length > 0 ? warnings[0] : "OK");

  if (workbookMode === "DRILL_SHEET") {
    if (fullDetailReady && !result.errorMessage) {
      status = "Drill sheet ready";
    } else if (!fullDetailReady && !result.errorMessage) {
      status = "Quote only — add opening A invert for drill sheet";
    }
  }

  return {
    wallHeightFeet: result.wallHeightFeet,
    unitPrice: result.errorMessage ? null : totalPrice,
    status,
    structureConfig,
  };
}

export function formatPenetrationsSummary(
  penetrations: QuoteStructurePenetration[] | undefined,
): string {
  if (!penetrations?.length) {
    return "";
  }
  return penetrations
    .map(
      (penetration) =>
        `${penetration.qty}×${penetration.pipeSizeInches}" ${penetration.pipeMaterial}`,
    )
    .join(", ");
}

export function formatStructureDescription(
  config: QuoteStructureConfig,
): string {
  const diameterLabel =
    config.diameterFeet != null
      ? `${Math.round(config.diameterFeet * 12)}"`
      : "";
  const templateName = config.templateName ?? "Structure";
  const wall =
    config.wallHeightFeet != null
      ? `${config.wallHeightFeet.toFixed(1)}' wall`
      : "";
  const rim = config.rimElevation.toFixed(2);
  const inv = config.lowInvertElevation.toFixed(2);
  const pipes = formatPenetrationsSummary(config.penetrations);
  const base = `${diameterLabel} ${templateName} — Rim ${rim}' / Inv ${inv}'${wall ? ` — ${wall}` : ""}`.trim();
  return pipes ? `${base} — Pipes: ${pipes}` : base;
}

export function workbookRowToLineItem(
  row: StructureWorkbookRow,
  lineNumber: number,
  existingId?: string,
): EditableQuoteLineItem | null {
  if (!row.structureConfig || row.unitPrice == null) {
    return null;
  }

  const structureNumber = row.structureNumber.trim() || "Structure";

  return {
    id: existingId ?? row.lineItemId ?? createRowId(),
    lineNumber,
    type: "CONFIGURABLE_STRUCTURE",
    typeLabel: quoteLineItemTypeLabels.CONFIGURABLE_STRUCTURE,
    item: structureNumber,
    description: formatStructureDescription(row.structureConfig),
    qty: row.qty.trim() || "1",
    unit: "EA",
    unitPrice: row.unitPrice.toFixed(2),
    weight: "",
    yards: "",
    taxable: true,
    statusNote:
      row.structureConfig.detailLevel === "DRILL_SHEET"
        ? "Drill sheet ready — create after award."
        : "Cut sheet required after award.",
    structureConfig: row.structureConfig,
  };
}

export function lineItemToWorkbookRow(
  line: EditableQuoteLineItem,
  templates: DrillSheetTemplateOption[],
): StructureWorkbookRow {
  const config = line.structureConfig;
  const template = config
    ? templates.find((entry) => entry.id === config.templateId)
    : templates[0];

  const openings: StructureWorkbookOpeningRow[] = config?.openings?.length
    ? config.openings.map((opening) => ({
        id: createRowId(),
        label: opening.label,
        pipeMaterial: opening.pipeMaterial ?? "",
        pipeSizeInches: opening.pipeSizeInches?.toString() ?? "",
        pipeType: opening.pipeType ?? "",
        invertElevation: opening.invertElevation.toString(),
        angleDegrees: String(opening.angleDegrees ?? 0),
        connectionType: opening.connectionType ?? "",
      }))
    : [
        {
          id: createRowId(),
          label: "A",
          pipeMaterial: config?.pipeMaterial ?? "",
          pipeSizeInches: config?.pipeSizeInches?.toString() ?? "",
          pipeType: config?.pipeType ?? "",
          invertElevation: config?.lowInvertElevation?.toString() ?? "",
          angleDegrees: "0",
          connectionType: "",
        },
      ];

  const penetrations: StructureWorkbookPenetration[] = config?.penetrations
    ?.length
    ? config.penetrations.map((penetration) => ({
        id: createRowId(),
        pipeMaterial: penetration.pipeMaterial,
        pipeSizeInches: String(penetration.pipeSizeInches),
        qty: String(penetration.qty),
      }))
    : config?.pipeMaterial
      ? [
          {
            id: createRowId(),
            pipeMaterial: config.pipeMaterial,
            pipeSizeInches: config.pipeSizeInches?.toString() ?? "",
            qty: String(config.bootCount || 1),
          },
        ]
      : [createDefaultPenetration()];

  return {
    id: createRowId(),
    lineItemId: line.id,
    structureNumber: line.item,
    templateId: config?.templateId ?? template?.id ?? "",
    diameterFeet: config?.diameterFeet?.toString() ?? "",
    castingProductId: config?.castingProductId ?? template?.defaultCastingProductId ?? "",
    rimElevation: config?.rimElevation?.toString() ?? "",
    lowInvertElevation: config?.lowInvertElevation?.toString() ?? "",
    pipeMaterial: config?.pipeMaterial ?? "",
    pipeSizeInches: config?.pipeSizeInches?.toString() ?? "",
    pipeType: "",
    bootCount: String(config?.bootCount ?? 1),
    qty: line.qty,
    penetrations,
    openings,
    wallHeightFeet: config?.wallHeightFeet ?? null,
    unitPrice: config?.totalPrice ?? parseNum(line.unitPrice),
    status: config?.errorMessage ?? (config?.warnings?.[0] ?? ""),
    structureConfig: config ?? null,
  };
}

export function mergeWorkbookLineItems(
  existingLineItems: EditableQuoteLineItem[],
  workbookLines: EditableQuoteLineItem[],
): EditableQuoteLineItem[] {
  // Both workbooks (circular and rectangular) return the FULL set of
  // workbook-managed structure lines — each passes the other shape's lines
  // through untouched — so every configured structure line here is replaced
  // by the incoming batch.
  const nonWorkbookStructures = existingLineItems.filter(
    (line) =>
      line.type !== "CONFIGURABLE_STRUCTURE" ||
      (!line.structureConfig && !line.rectStructureConfig),
  );
  const merged = [...nonWorkbookStructures, ...workbookLines];
  return merged.map((line, index) => ({
    ...line,
    lineNumber: index + 1,
  }));
}

export function parseTsvPaste(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  return normalized.split("\n").map((line) => line.split("\t"));
}

export function applyTsvToRows(
  rows: StructureWorkbookRow[],
  tsvRows: string[][],
  templates: DrillSheetTemplateOption[],
  defaults?: StructureWorkbookDefaults,
): StructureWorkbookRow[] {
  const next = [...rows];
  const templateByName = new Map(
    templates.map((template) => [template.name.toLowerCase(), template]),
  );
  const workbookDefaults = defaults ?? createDefaultWorkbookDefaults(templates);

  for (const cells of tsvRows) {
    if (cells.every((cell) => cell.trim() === "")) {
      continue;
    }

    const row = createDefaultWorkbookRow(templates, next, workbookDefaults);
    row.structureNumber = cells[0]?.trim() ?? row.structureNumber;

    const templateName = cells[1]?.trim().toLowerCase();
    if (templateName) {
      const match = templateByName.get(templateName);
      if (match) {
        row.templateId = match.id;
        if (!cells[2]?.trim() && match.diameters[0]) {
          row.diameterFeet = String(match.diameters[0].insideDiameterFeet);
        }
      }
    }

    if (cells[2]?.trim()) row.diameterFeet = cells[2].trim();
    if (cells[3]?.trim()) row.castingProductId = cells[3].trim();
    if (cells[4]?.trim()) row.rimElevation = cells[4].trim();
    if (cells[5]?.trim()) row.lowInvertElevation = cells[5].trim();
    if (cells[6]?.trim()) row.pipeMaterial = cells[6].trim();
    if (cells[7]?.trim()) row.pipeSizeInches = cells[7].trim();
    if (cells[8]?.trim()) row.bootCount = cells[8].trim();
    if (cells[9]?.trim()) row.qty = cells[9].trim();

    row.penetrations = row.pipeMaterial.trim()
      ? [
          {
            id: createRowId(),
            pipeMaterial: row.pipeMaterial,
            pipeSizeInches: row.pipeSizeInches,
            qty: row.bootCount.trim() || "1",
          },
        ]
      : [createDefaultPenetration()];

    next.push(row);
  }

  return next;
}

function parsePenetrationsFromJson(
  value: unknown,
): QuoteStructurePenetration[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const penetrations: QuoteStructurePenetration[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const penetration = entry as Record<string, unknown>;
    if (
      typeof penetration.pipeMaterial !== "string" ||
      typeof penetration.pipeSizeInches !== "number"
    ) {
      continue;
    }
    penetrations.push({
      pipeMaterial: penetration.pipeMaterial,
      pipeSizeInches: penetration.pipeSizeInches,
      qty:
        typeof penetration.qty === "number" && penetration.qty > 0
          ? Math.floor(penetration.qty)
          : 1,
    });
  }

  return penetrations.length > 0 ? penetrations : undefined;
}

function parseOpeningsFromJson(value: unknown): QuoteStructureOpening[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const openings: QuoteStructureOpening[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const opening = entry as Record<string, unknown>;
    if (typeof opening.invertElevation !== "number") {
      continue;
    }

    openings.push({
      label: typeof opening.label === "string" ? opening.label : "A",
      pipeMaterial:
        typeof opening.pipeMaterial === "string"
          ? opening.pipeMaterial
          : undefined,
      pipeSizeInches:
        typeof opening.pipeSizeInches === "number"
          ? opening.pipeSizeInches
          : undefined,
      pipeType:
        typeof opening.pipeType === "string" ? opening.pipeType : undefined,
      invertElevation: opening.invertElevation,
      angleDegrees:
        typeof opening.angleDegrees === "number" ? opening.angleDegrees : 0,
      connectionType:
        opening.connectionType === "KOR_N_SEAL" ||
        opening.connectionType === "CAST_IN" ||
        opening.connectionType === "GROUTED" ||
        opening.connectionType === "OTHER"
          ? opening.connectionType
          : null,
    });
  }

  return openings.length > 0 ? openings : undefined;
}

export function parseStructureConfigJson(
  value: unknown,
): QuoteStructureConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const data = value as Record<string, unknown>;
  if (typeof data.templateId !== "string" || typeof data.diameterFeet !== "number") {
    return null;
  }
  if (
    typeof data.rimElevation !== "number" ||
    typeof data.lowInvertElevation !== "number"
  ) {
    return null;
  }
  return {
    templateId: data.templateId,
    templateName:
      typeof data.templateName === "string" ? data.templateName : undefined,
    diameterFeet: data.diameterFeet,
    castingProductId:
      typeof data.castingProductId === "string" ? data.castingProductId : null,
    rimElevation: data.rimElevation,
    lowInvertElevation: data.lowInvertElevation,
    pipeMaterial:
      typeof data.pipeMaterial === "string" ? data.pipeMaterial : undefined,
    pipeSizeInches:
      typeof data.pipeSizeInches === "number" ? data.pipeSizeInches : undefined,
    pipeType: typeof data.pipeType === "string" ? data.pipeType : undefined,
    bootCount: typeof data.bootCount === "number" ? data.bootCount : 1,
    detailLevel:
      data.detailLevel === "DRILL_SHEET" ? "DRILL_SHEET" : "QUOTE",
    penetrations: parsePenetrationsFromJson(data.penetrations),
    openings: parseOpeningsFromJson(data.openings),
    wallHeightFeet:
      typeof data.wallHeightFeet === "number" ? data.wallHeightFeet : undefined,
    wallPrice: typeof data.wallPrice === "number" ? data.wallPrice : undefined,
    bootsPrice:
      typeof data.bootsPrice === "number" ? data.bootsPrice : undefined,
    totalPrice:
      typeof data.totalPrice === "number" ? data.totalPrice : undefined,
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    errorMessage:
      typeof data.errorMessage === "string" ? data.errorMessage : null,
  };
}
