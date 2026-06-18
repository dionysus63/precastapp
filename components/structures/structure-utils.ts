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

export const structureInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const structureTableInputClassName =
  "w-full min-w-[72px] rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900";

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
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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
