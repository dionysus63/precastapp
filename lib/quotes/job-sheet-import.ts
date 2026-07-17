// Maps stored drill sheets (JobStructure + calc/dims/openings) back into
// quote workbook rows — the reverse of the workbook → drill-sheet direction
// the detailing import uses. Lets a quote pick up structures whose sheets
// were built straight on the job: the rows price live in the workbook, and
// quote-won adoption links the lines back to these structures by number
// instead of duplicating them.

import {
  createRowId,
  createDefaultOpening,
  type StructureWorkbookOpeningRow,
  type StructureWorkbookRow,
} from "@/lib/quotes/structure-workbook";
import {
  createRectOpeningRow,
  type RectWorkbookOpeningRow,
  type RectWorkbookRow,
} from "@/lib/quotes/rect-structure-workbook";
import { formatPipeDescription } from "@/lib/drill-sheet";
import type { RectOpeningPlacement, RectWall } from "@/lib/rect-structure";
import type { PipeConnectionType } from "@/app/generated/prisma/client";

type DecimalLike = { toString(): string };

function decimalToInput(value: DecimalLike | null | undefined): string {
  if (value == null) {
    return "";
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

/** Just the stored fields the mappers read — structural, so any include works. */
export type StoredSheetForImport = {
  structureTemplateId: string | null;
  structureNumber: string | null;
  calc: {
    rimElevation: DecimalLike | null;
    lowestInvertFeet: DecimalLike | null;
    insideDiameterFeet: DecimalLike | null;
    insideLengthFeet: DecimalLike | null;
    insideWidthFeet: DecimalLike | null;
  } | null;
  dimensions: {
    insideLength: DecimalLike | null;
    insideWidth: DecimalLike | null;
    hasTopSlab: boolean | null;
    hasBaseSlab: boolean | null;
    baseAttached: boolean | null;
    topSlabOpeningLengthInches: DecimalLike | null;
    topSlabOpeningWidthInches: DecimalLike | null;
    topSlabOpeningSide: string | null;
  } | null;
  castings: { castingProductId: string | null }[];
  openings: {
    label: string | null;
    wall: string | null;
    pipeMaterial: string | null;
    pipeType: string | null;
    pipeSizeInches: DecimalLike | null;
    invertElevation: DecimalLike | null;
    angle: DecimalLike | null;
    connectionType: PipeConnectionType | null;
    horizontalPlacement: string | null;
    offsetInches: DecimalLike | null;
    openingWidthInches: DecimalLike | null;
  }[];
};

function lowestInvertText(sheet: StoredSheetForImport): string {
  const stored = decimalToInput(sheet.calc?.lowestInvertFeet);
  if (stored !== "") {
    return stored;
  }
  const inverts = sheet.openings
    .map((opening) => Number(opening.invertElevation ?? NaN))
    .filter((value) => Number.isFinite(value));
  return inverts.length > 0 ? String(Math.min(...inverts)) : "";
}

/**
 * Stored rect sheet → workbook row (full detail). Sections aren't part of a
 * workbook row — the existing sheet keeps its splits when the quote-won
 * linking adopts the structure.
 */
export function mapRectSheetToWorkbookRow(
  sheet: StoredSheetForImport,
): RectWorkbookRow {
  const openings: RectWorkbookOpeningRow[] = sheet.openings.map(
    (opening, index) => ({
      id: createRowId(),
      label: opening.label?.trim() || String.fromCharCode(65 + index),
      wall: (opening.wall ?? "UP") as RectWall,
      pipeMaterial: opening.pipeMaterial ?? "",
      pipeSizeInches: decimalToInput(opening.pipeSizeInches),
      invertElevation: decimalToInput(opening.invertElevation),
      angle: decimalToInput(opening.angle),
      placement: (opening.horizontalPlacement ??
        "CENTERED") as RectOpeningPlacement,
      offsetInches: decimalToInput(opening.offsetInches),
      // Stored width includes any manual skew override; re-entering it keeps
      // the saved width even if the catalog changes (same as the edit form).
      widthOverrideInches: decimalToInput(opening.openingWidthInches),
    }),
  );

  return {
    id: createRowId(),
    structureNumber: sheet.structureNumber ?? "",
    templateId: sheet.structureTemplateId ?? "",
    insideLengthFeet: decimalToInput(
      sheet.dimensions?.insideLength ?? sheet.calc?.insideLengthFeet,
    ),
    insideWidthFeet: decimalToInput(
      sheet.dimensions?.insideWidth ?? sheet.calc?.insideWidthFeet,
    ),
    castingProductId: sheet.castings[0]?.castingProductId ?? "",
    rimElevation: decimalToInput(sheet.calc?.rimElevation),
    lowInvertElevation: lowestInvertText(sheet),
    hasTopSlab: sheet.dimensions?.hasTopSlab ?? true,
    hasBaseSlab: sheet.dimensions?.hasBaseSlab ?? true,
    baseAttached: sheet.dimensions?.baseAttached ?? true,
    topSlabOpeningLengthInches: decimalToInput(
      sheet.dimensions?.topSlabOpeningLengthInches,
    ),
    topSlabOpeningWidthInches: decimalToInput(
      sheet.dimensions?.topSlabOpeningWidthInches,
    ),
    topSlabOpeningSide: (sheet.dimensions?.topSlabOpeningSide ??
      "UP") as RectWall,
    penetrations: [],
    openings: openings.length > 0 ? openings : [createRectOpeningRow("A")],
    qty: "1",
    wallHeightFeet: null,
    heaviestPickLbs: null,
    unitPrice: null,
    status: "",
    config: null,
  };
}

/** Stored circular sheet → workbook row (full detail). */
export function mapCircularSheetToWorkbookRow(
  sheet: StoredSheetForImport,
): StructureWorkbookRow {
  const openings: StructureWorkbookOpeningRow[] = sheet.openings.map(
    (opening, index) => ({
      id: createRowId(),
      label: opening.label?.trim() || String.fromCharCode(65 + index),
      // Legacy rows split material/type; the workbook uses them combined.
      pipeMaterial: formatPipeDescription(
        opening.pipeMaterial,
        opening.pipeType,
      ),
      pipeSizeInches: decimalToInput(opening.pipeSizeInches),
      pipeType: "",
      invertElevation: decimalToInput(opening.invertElevation),
      angleDegrees: decimalToInput(opening.angle) || "0",
      connectionType: opening.connectionType ?? "",
    }),
  );

  const firstOpening = sheet.openings[0] ?? null;

  return {
    id: createRowId(),
    structureNumber: sheet.structureNumber ?? "",
    templateId: sheet.structureTemplateId ?? "",
    diameterFeet: decimalToInput(sheet.calc?.insideDiameterFeet),
    castingProductId: sheet.castings[0]?.castingProductId ?? "",
    rimElevation: decimalToInput(sheet.calc?.rimElevation),
    lowInvertElevation: lowestInvertText(sheet),
    pipeMaterial: firstOpening
      ? formatPipeDescription(firstOpening.pipeMaterial, firstOpening.pipeType)
      : "",
    pipeSizeInches: decimalToInput(firstOpening?.pipeSizeInches ?? null),
    pipeType: "",
    bootCount: "1",
    qty: "1",
    penetrations: [],
    openings: openings.length > 0 ? openings : [createDefaultOpening("A")],
    wallHeightFeet: null,
    unitPrice: null,
    status: "",
    structureConfig: null,
  };
}
