import { randomId } from "@/lib/random-id";
import { tableInlineInputClassName } from "@/lib/table-styles";

export type StructureType =
  | "STOCK_PRODUCT"
  | "CONFIGURABLE_PRODUCT"
  | "CUSTOM_STRUCTURE";

export type StructureStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "APPROVED"
  | "IN_PRODUCTION"
  | "MADE"
  | "SHIPPED";

export const structureTypeOptions: {
  value: StructureType;
  label: string;
}[] = [
  { value: "STOCK_PRODUCT", label: "STOCK_PRODUCT — Stock Product" },
  {
    value: "CONFIGURABLE_PRODUCT",
    label: "CONFIGURABLE_PRODUCT — Configurable Product",
  },
  {
    value: "CUSTOM_STRUCTURE",
    label: "CUSTOM_STRUCTURE — Custom Structure",
  },
];

export const structureStatusOptions: {
  value: StructureStatus;
  label: string;
}[] = [
  { value: "NOT_SUBMITTED", label: "Not Submitted" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_PRODUCTION", label: "In Production" },
  { value: "MADE", label: "Made" },
  { value: "SHIPPED", label: "Shipped" },
];

/**
 * True when a structure was quoted without drill-sheet detail and still needs
 * its cut sheet created. Scoped to CONFIGURABLE_PRODUCT: custom structures
 * also carry needsCutSheet but never get a structure template — their
 * drawings arrive as submittal uploads, so they must not be gated on one.
 */
export function structureNeedsDrillSheet(structure: {
  needsCutSheet: boolean;
  structureTemplateId: string | null;
  structureType: string;
}): boolean {
  return (
    structure.needsCutSheet &&
    structure.structureTemplateId == null &&
    structure.structureType === "CONFIGURABLE_PRODUCT"
  );
}

export const structureInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const structureTableInputClassName = `${tableInlineInputClassName} w-full min-w-[72px]`;

export type OpeningRow = {
  id: string;
  openingNumber: string;
  wallLocation: string;
  clockPosition: string;
  pipeType: string;
  pipeDiameter: string;
  connectionType: string;
  invertElevation: string;
  holeDiameter: string;
  bootType: string;
  angle: string;
  notes: string;
};

export type CastingRow = {
  id: string;
  castingType: string;
  description: string;
  frameSize: string;
  coverType: string;
  grateType: string;
  hatchSize: string;
  loadRating: string;
  boltDown: string;
  vented: string;
  quantity: string;
  notes: string;
};

export function createOpeningRow(openingNumber = ""): OpeningRow {
  return {
    id: randomId(),
    openingNumber,
    wallLocation: "",
    clockPosition: "",
    pipeType: "",
    pipeDiameter: "",
    connectionType: "",
    invertElevation: "",
    holeDiameter: "",
    bootType: "",
    angle: "",
    notes: "",
  };
}

export function createCastingRow(): CastingRow {
  return {
    id: randomId(),
    castingType: "",
    description: "",
    frameSize: "",
    coverType: "",
    grateType: "",
    hatchSize: "",
    loadRating: "",
    boltDown: "no",
    vented: "no",
    quantity: "1",
    notes: "",
  };
}

export const placeholderOpenings: OpeningRow[] = [
  {
    id: "opening-1",
    openingNumber: "1",
    wallLocation: "North",
    clockPosition: "12:00",
    pipeType: "RCP",
    pipeDiameter: "12",
    connectionType: "Boot",
    invertElevation: "98.50",
    holeDiameter: "14",
    bootType: "Kor-N-Seal",
    angle: "0",
    notes: "",
  },
  {
    id: "opening-2",
    openingNumber: "2",
    wallLocation: "East",
    clockPosition: "3:00",
    pipeType: "PVC",
    pipeDiameter: "8",
    connectionType: "Gasket",
    invertElevation: "97.25",
    holeDiameter: "10",
    bootType: "",
    angle: "90",
    notes: "Sanitary lateral",
  },
];

export const placeholderCastings: CastingRow[] = [
  {
    id: "casting-1",
    castingType: "Frame & Cover",
    description: "Traffic-rated manhole frame",
    frameSize: '24"',
    coverType: "Solid",
    grateType: "",
    hatchSize: "",
    loadRating: "H-20",
    boltDown: "yes",
    vented: "no",
    quantity: "1",
    notes: "",
  },
];
