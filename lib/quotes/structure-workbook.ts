import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";
import { quoteLineItemTypeLabels } from "@/lib/quotes/constants";
import {
  computeDrillSheet,
  type DiameterConfig,
  type DrillSheetInput,
  type PipeOpeningSizeEntry,
  type TemplateConfig,
} from "@/lib/drill-sheet";

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
  wallHeightFeet?: number;
  wallPrice?: number;
  bootsPrice?: number;
  totalPrice?: number;
  warnings?: string[];
  errorMessage?: string | null;
};

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
  pipeType: string;
  bootCount: string;
  qty: string;
};

export type StructureWorkbookSession = {
  rows: StructureWorkbookRow[];
  returnPath: string;
  pendingLineItems: EditableQuoteLineItem[] | null;
  defaults?: StructureWorkbookDefaults;
};

export type StructureWorkbookApplyPayload = {
  lineItems: EditableQuoteLineItem[];
  returnPath: string;
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
    pipeType: "",
    bootCount: "1",
    qty: "1",
  };
}

export function applyDefaultsToBlankRow(
  row: StructureWorkbookRow,
  defaults: StructureWorkbookDefaults,
): StructureWorkbookRow {
  return {
    ...row,
    templateId: row.templateId.trim() ? row.templateId : defaults.templateId,
    diameterFeet: row.diameterFeet.trim()
      ? row.diameterFeet
      : defaults.diameterFeet,
    castingProductId: row.castingProductId.trim()
      ? row.castingProductId
      : defaults.castingProductId,
    pipeMaterial: row.pipeMaterial.trim()
      ? row.pipeMaterial
      : defaults.pipeMaterial,
    pipeSizeInches: row.pipeSizeInches.trim()
      ? row.pipeSizeInches
      : defaults.pipeSizeInches,
    pipeType: row.pipeType.trim() ? row.pipeType : defaults.pipeType,
    bootCount: row.bootCount.trim() ? row.bootCount : defaults.bootCount,
    qty: row.qty.trim() ? row.qty : defaults.qty,
  };
}

export function commitWorkbookRowPrice(
  row: StructureWorkbookRow,
  options: StructureWorkbookOptions,
): StructureWorkbookRow {
  const computed = computeWorkbookRowPrice(row, options);
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
): StructureWorkbookRow[] {
  return rows.map((row) => commitWorkbookRowPrice(row, options));
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
    pipeType: workbookDefaults.pipeType,
    bootCount: workbookDefaults.bootCount || "1",
    qty: workbookDefaults.qty || "1",
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

export function computeWorkbookRowPrice(
  row: StructureWorkbookRow,
  options: StructureWorkbookOptions,
): {
  wallHeightFeet: number | null;
  unitPrice: number | null;
  status: string;
  structureConfig: QuoteStructureConfig | null;
} {
  const template = options.templates.find((entry) => entry.id === row.templateId);
  const rim = parseNum(row.rimElevation);
  const lowInvert = parseNum(row.lowInvertElevation);
  const diameterFeet = parseNum(row.diameterFeet);
  const bootCount = Math.max(1, Math.floor(parseNum(row.bootCount) ?? 1));

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
      status: "Enter rim and low invert",
      structureConfig: null,
    };
  }

  const casting = options.castings.find(
    (entry) => entry.id === row.castingProductId,
  );
  const castingHeightFeet =
    casting?.heightFeet ?? template.defaultCastingHeightFeet ?? 0;

  const pipeSize = parseNum(row.pipeSizeInches);
  const hasPipe =
    row.pipeMaterial.trim() !== "" &&
    pipeSize != null &&
    row.pipeType.trim() !== "";

  const input: DrillSheetInput = {
    rimElevation: rim,
    castingHeightFeet,
    diameter: diameterConfig,
    template: templateToConfig(template),
    pipeOpeningSizes: options.pipeOpeningSizes,
    openings: [
      {
        label: "A",
        pipeMaterial: hasPipe ? row.pipeMaterial : null,
        pipeSizeInches: hasPipe ? pipeSize : null,
        pipeType: hasPipe ? row.pipeType : null,
        invertElevation: lowInvert,
        angleDegrees: 0,
        connectionType: hasPipe ? template.connectionType : null,
      },
    ],
  };

  const result = computeDrillSheet(input);

  let bootsPrice = result.bootsPrice;
  if (bootCount > 1 && bootsPrice > 0) {
    const perBoot = bootsPrice / 1;
    bootsPrice = Math.round(perBoot * bootCount * 100) / 100;
  } else if (bootCount === 0) {
    bootsPrice = 0;
  }

  const totalPrice = Math.round((result.wallPrice + bootsPrice) * 100) / 100;

  const warnings = [...result.warnings];
  if (result.errorMessage) {
    warnings.unshift(result.errorMessage);
  }
  if (hasPipe && result.bootsPrice === 0 && template.connectionType === "KOR_N_SEAL") {
    warnings.push("No boot price found for selected pipe size.");
  }

  const structureConfig: QuoteStructureConfig = {
    templateId: template.id,
    templateName: template.name,
    diameterFeet,
    castingProductId: row.castingProductId || null,
    rimElevation: rim,
    lowInvertElevation: lowInvert,
    pipeMaterial: hasPipe ? row.pipeMaterial : undefined,
    pipeSizeInches: hasPipe ? pipeSize! : undefined,
    pipeType: hasPipe ? row.pipeType : undefined,
    bootCount,
    wallHeightFeet: result.wallHeightFeet,
    wallPrice: result.wallPrice,
    bootsPrice,
    totalPrice,
    warnings,
    errorMessage: result.errorMessage,
  };

  const status =
    result.errorMessage ??
    (warnings.length > 0 ? warnings[0] : "OK");

  return {
    wallHeightFeet: result.wallHeightFeet,
    unitPrice: result.errorMessage ? null : totalPrice,
    status,
    structureConfig,
  };
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
  return `${diameterLabel} ${templateName} — Rim ${rim}' / Inv ${inv}'${wall ? ` — ${wall}` : ""}`.trim();
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
    statusNote: "Cut sheet required after award.",
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
    pipeType: config?.pipeType ?? "",
    bootCount: String(config?.bootCount ?? 1),
    qty: line.qty,
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
  const nonWorkbookStructures = existingLineItems.filter(
    (line) =>
      line.type !== "CONFIGURABLE_STRUCTURE" || !line.structureConfig,
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
    if (cells[8]?.trim()) row.pipeType = cells[8].trim();
    if (cells[9]?.trim()) row.bootCount = cells[9].trim();
    if (cells[10]?.trim()) row.qty = cells[10].trim();

    next.push(row);
  }

  return next;
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
