import { normalizeDegrees } from "@/lib/drill-sheet-diagram";

/** Marker for a workbook structure placed on the plan PDF. */
export type PlanSheetStructureMarker = {
  rowKey: string;
  /** Used to re-link markup when workbook rows are rebuilt from quote line items. */
  structureNumber?: string;
  page: number;
  /** PDF page coordinates (pdf.js viewport at scale 1, origin top-left). */
  x: number;
  y: number;
  /** Compass bearing of the outlet line (first pipe drawn), degrees clockwise from up. */
  outletBearingDegrees?: number;
};

/** Visual pipe line on the plan tied to a workbook opening. */
export type PlanSheetPipeLine = {
  openingKey: string;
  openingLabel?: string;
  rowKey: string;
  /** Angle relative to outlet (0 = outlet / opening A). */
  angleDegrees: number;
  /** Visual length in PDF page units. */
  length: number;
  /** Absolute bearing on the plan while dragging (for redraw). */
  bearingDegrees: number;
};

export type PlanSheetMarkup = {
  structures: PlanSheetStructureMarker[];
  pipes: PlanSheetPipeLine[];
};

export const EMPTY_PLAN_SHEET_MARKUP: PlanSheetMarkup = {
  structures: [],
  pipes: [],
};

export function parsePlanSheetMarkup(value: unknown): PlanSheetMarkup {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_PLAN_SHEET_MARKUP };
  }

  const raw = value as Partial<PlanSheetMarkup>;
  const structures = Array.isArray(raw.structures)
    ? raw.structures.filter(
        (marker): marker is PlanSheetStructureMarker =>
          marker != null &&
          typeof marker === "object" &&
          typeof (marker as PlanSheetStructureMarker).rowKey === "string" &&
          typeof (marker as PlanSheetStructureMarker).page === "number" &&
          typeof (marker as PlanSheetStructureMarker).x === "number" &&
          typeof (marker as PlanSheetStructureMarker).y === "number",
      )
    : [];

  const pipes = Array.isArray(raw.pipes)
    ? raw.pipes.filter(
        (line): line is PlanSheetPipeLine =>
          line != null &&
          typeof line === "object" &&
          typeof (line as PlanSheetPipeLine).openingKey === "string" &&
          typeof (line as PlanSheetPipeLine).rowKey === "string" &&
          typeof (line as PlanSheetPipeLine).angleDegrees === "number" &&
          typeof (line as PlanSheetPipeLine).length === "number" &&
          typeof (line as PlanSheetPipeLine).bearingDegrees === "number",
      )
    : [];

  return { structures, pipes };
}

export function snapBearingDegrees(
  degrees: number,
  snap = 5,
  free = false,
): number {
  if (free || snap <= 0) {
    return normalizeDegrees(degrees);
  }
  return normalizeDegrees(Math.round(degrees / snap) * snap);
}

/** Computes opening angle relative to the outlet line (0 = outlet). */
export function relativeAngleFromOutlet(
  bearingDegrees: number,
  outletBearingDegrees: number,
): number {
  return normalizeDegrees(bearingDegrees - outletBearingDegrees);
}

export function findStructureMarker(
  markup: PlanSheetMarkup,
  rowKey: string,
  page?: number,
): PlanSheetStructureMarker | undefined {
  return markup.structures.find(
    (marker) =>
      marker.rowKey === rowKey && (page == null || marker.page === page),
  );
}

export function pruneMarkupForRows(
  markup: PlanSheetMarkup,
  validRowKeys: Set<string>,
): PlanSheetMarkup {
  return {
    structures: markup.structures.filter((marker) =>
      validRowKeys.has(marker.rowKey),
    ),
    pipes: markup.pipes.filter((line) => validRowKeys.has(line.rowKey)),
  };
}

/** Re-links markup keys when workbook rows are rebuilt (e.g. from saved quote lines). */
export function rekeyPlanSheetMarkup(
  markup: PlanSheetMarkup,
  rows: { id: string; structureNumber: string; openings: { id: string; label: string }[] }[],
): PlanSheetMarkup {
  const rowIds = new Set(rows.map((row) => row.id));
  const rowByNumber = new Map<string, string>();
  for (const row of rows) {
    const key = row.structureNumber.trim();
    if (key) {
      rowByNumber.set(key, row.id);
    }
  }

  const rowKeyMap = new Map<string, string>();
  for (const marker of markup.structures) {
    if (rowIds.has(marker.rowKey)) {
      rowKeyMap.set(marker.rowKey, marker.rowKey);
      continue;
    }
    const numberKey = marker.structureNumber?.trim();
    if (numberKey && rowByNumber.has(numberKey)) {
      rowKeyMap.set(marker.rowKey, rowByNumber.get(numberKey)!);
    }
  }

  const structures: PlanSheetStructureMarker[] = [];
  for (const marker of markup.structures) {
    const nextRowKey = rowKeyMap.get(marker.rowKey);
    if (!nextRowKey) {
      continue;
    }
    const row = rows.find((entry) => entry.id === nextRowKey);
    structures.push({
      ...marker,
      rowKey: nextRowKey,
      structureNumber: row?.structureNumber ?? marker.structureNumber,
    });
  }

  const pipes: PlanSheetPipeLine[] = [];
  for (const line of markup.pipes) {
    const nextRowKey = rowKeyMap.get(line.rowKey);
    if (!nextRowKey) {
      continue;
    }
    const row = rows.find((entry) => entry.id === nextRowKey);
    if (!row) {
      continue;
    }

    let openingKey = line.openingKey;
    if (!row.openings.some((opening) => opening.id === openingKey)) {
      const label = line.openingLabel?.trim();
      const byLabel = label
        ? row.openings.find((opening) => opening.label === label)
        : undefined;
      if (byLabel) {
        openingKey = byLabel.id;
      }
    }

    pipes.push({
      ...line,
      rowKey: nextRowKey,
      openingKey,
      openingLabel:
        row.openings.find((opening) => opening.id === openingKey)?.label ??
        line.openingLabel,
    });
  }

  return { structures, pipes };
}

export type PlanSheetViewModel = {
  id: string;
  quoteId: string | null;
  jobId: string | null;
  sourceType: "UPLOAD" | "JOB_FILE";
  filePath: string;
  originalName: string;
  pageNumber: number;
  markup: PlanSheetMarkup;
};
