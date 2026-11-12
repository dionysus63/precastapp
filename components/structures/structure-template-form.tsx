"use client";

import Link from "next/link";
import { isActionError, type ActionError } from "@/lib/action-result";
import { randomId } from "@/lib/random-id";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  sheetPdfCoverageSummary,
  useSheetPdfCoverage,
} from "@/components/structures/sheet-pdf-manager";
import { structureInputClassName } from "@/components/structures/structure-utils";
import {
  type MoldDiameterBasis,
  resolveSheetDiameter,
} from "@/lib/mold-sheet-settings";
import { RECT_WALL_LABELS, type RectWall } from "@/lib/rect-structure";
import {
  sheetPdfFitsTemplate,
  sheetPdfSlabLabel,
  type SheetPdfKind,
} from "@/lib/sheet-pdf";

const RECT_WALL_OPTIONS: RectWall[] = ["UP", "RIGHT", "DOWN", "LEFT"];

type DiameterField = {
  id: string;
  insideDiameterFeet: string;
};

type RectSizeField = {
  id: string;
  insideLengthInches: string;
  insideWidthInches: string;
};

/** "54" → 4'-6" — live hint under the inch inputs. */
function feetInchesHint(inchesText: string): string | null {
  const inches = Number(inchesText);
  if (!Number.isFinite(inches) || inches <= 0) {
    return null;
  }
  const feet = Math.floor(inches / 12);
  const rest = Math.round(inches % 12);
  return `${feet}'-${rest}"`;
}

export type CastingOption = {
  id: string;
  name: string;
  heightFeet: number | null;
};

export type StructureTemplateFormValue = {
  name: string;
  agencyStandard: string;
  shape: "CIRCULAR" | "RECTANGULAR";
  wallThicknessInches: string;
  baseSlabThicknessInches: string;
  topSlabThicknessInches: string;
  castingProductId: string;
  minimumBrickInches: string;
  connectionType: "KOR_N_SEAL" | "CAST_IN" | "GROUTED" | "OTHER";
  sumpMode: "DEFAULT" | "FIXED";
  sumpFixedInches: string;
  openingToJointMinTopInches: string;
  openingToJointMinBottomInches: string;
  /** Circular only: top slab clear opening in whole inches. */
  topSlabOpeningInches: string;
  rectWallPricePerFoot: string;
  rectMinPricingHeightFeet: string;
  rectTopSlabPrice: string;
  rectBaseSlabPrice: string;
  /** Rectangular only: default top-slab access opening structures inherit. */
  rectTopSlabOpeningLengthInches: string;
  rectTopSlabOpeningWidthInches: string;
  rectTopSlabOpeningSide: RectWall;
  sheetPdfId: string;
  status: "ACTIVE" | "INACTIVE";
  notes: string;
  diameters: DiameterField[];
  rectSizes: RectSizeField[];
};

/** A Sheet PDF the template could print on (Structures → Sheet PDFs). */
export type SheetPdfOption = SheetPdfKind & {
  id: string;
  name: string;
};

/** A registered circular mold (Settings → Structure Molds). */
export type TemplateMoldOption = {
  label: string | null;
  insideDiameterFeet: number;
  wallThicknessInches: number | null;
  maxBaseHeightFeet: number;
  maxRiserHeightFeet: number;
  /** False = keyless mold. */
  hasKey?: boolean;
  /** Which diameter the mold's drill sheets print. */
  sheetDiameterBasis?: MoldDiameterBasis;
};

type StructureTemplateFormProps = {
  /** Returns `{ error }` on failure (shown above the buttons). */
  action: (formData: FormData) => Promise<void | ActionError>;
  cancelHref: string;
  submitLabel: string;
  defaultValue?: StructureTemplateFormValue;
  /** ISO updatedAt of the template when the edit page loaded it — rejects
   * stale saves (optimistic concurrency). */
  expectedUpdatedAt?: string;
  castingOptions: CastingOption[];
  sheetPdfOptions?: SheetPdfOption[];
  /** Circular templates can only offer diameters with a registered mold. */
  moldOptions?: TemplateMoldOption[];
  /** Rect wall/slab prices read and write this price list's entry. */
  priceListId?: string | null;
  priceListName?: string | null;
  /** Drill sheets using this template: the shape is locked while any do. */
  sheetCount?: number;
};

function uid() {
  return randomId();
}

function createDiameter(): DiameterField {
  return { id: uid(), insideDiameterFeet: "" };
}

const slabInputClassName = `${structureInputClassName} disabled:cursor-not-allowed disabled:border-dashed disabled:bg-slate-100 disabled:text-slate-500`;

/** The mold's constants, shown read-only under the template's mold pick. */
function moldFacts(mold: TemplateMoldOption): { label: string; value: string }[] {
  const sheetDiameter = resolveSheetDiameter(mold.insideDiameterFeet, mold);
  return [
    { label: "Inside diameter", value: `${mold.insideDiameterFeet}'` },
    {
      label: "Wall thickness",
      value:
        mold.wallThicknessInches != null
          ? `${mold.wallThicknessInches}"`
          : "Not set",
    },
    {
      label: "Sheet shows",
      value:
        sheetDiameter.basis === "OUTSIDE" && sheetDiameter.feet != null
          ? `Outside diameter (${sheetDiameter.feet}' OD)`
          : "Inside diameter (ID)",
    },
    { label: "Key", value: mold.hasKey === false ? "No" : "Yes" },
  ];
}

function moldOptionLabel(mold: TemplateMoldOption): string {
  const sheetDiameter = resolveSheetDiameter(mold.insideDiameterFeet, mold);
  const parts = [
    `${mold.insideDiameterFeet}' ID`,
    sheetDiameter.basis === "OUTSIDE" && sheetDiameter.feet != null
      ? `${sheetDiameter.feet}' OD on sheets`
      : null,
    mold.wallThicknessInches != null
      ? `${mold.wallThicknessInches}" wall`
      : null,
    `base ≤ ${mold.maxBaseHeightFeet}'`,
    `riser ≤ ${mold.maxRiserHeightFeet}'`,
    mold.hasKey === false ? "no key" : null,
  ].filter(Boolean);
  return `${mold.label ? `${mold.label} — ` : ""}${parts.join(" · ")}`;
}


const defaultFormValue: StructureTemplateFormValue = {
  name: "",
  agencyStandard: "",
  shape: "CIRCULAR",
  wallThicknessInches: "8",
  baseSlabThicknessInches: "8",
  topSlabThicknessInches: "16",
  castingProductId: "",
  minimumBrickInches: "4",
  connectionType: "KOR_N_SEAL",
  sumpMode: "DEFAULT",
  sumpFixedInches: "",
  openingToJointMinTopInches: "4",
  openingToJointMinBottomInches: "4",
  topSlabOpeningInches: "",
  rectWallPricePerFoot: "",
  rectMinPricingHeightFeet: "",
  rectTopSlabPrice: "",
  rectBaseSlabPrice: "",
  rectTopSlabOpeningLengthInches: "",
  rectTopSlabOpeningWidthInches: "",
  rectTopSlabOpeningSide: "UP",
  sheetPdfId: "",
  status: "ACTIVE",
  notes: "",
  diameters: [createDiameter()],
  rectSizes: [],
};

export function StructureTemplateForm({
  action,
  cancelHref,
  submitLabel,
  defaultValue,
  expectedUpdatedAt,
  castingOptions,
  sheetPdfOptions = [],
  moldOptions = [],
  priceListId = null,
  priceListName = null,
  sheetCount = 0,
}: StructureTemplateFormProps) {
  const sheetsLocked = sheetCount > 0;
  const initial = defaultValue ?? defaultFormValue;
  const [name, setName] = useState(initial.name);
  const [agencyStandard, setAgencyStandard] = useState(initial.agencyStandard);
  const [shape, setShape] = useState(initial.shape);
  const [wallThicknessInches, setWallThicknessInches] = useState(
    initial.wallThicknessInches,
  );
  const [baseSlabThicknessInches, setBaseSlabThicknessInches] = useState(
    initial.baseSlabThicknessInches,
  );
  const [topSlabThicknessInches, setTopSlabThicknessInches] = useState(
    initial.topSlabThicknessInches,
  );
  const [castingProductId, setCastingProductId] = useState(
    initial.castingProductId,
  );
  const [minimumBrickInches, setMinimumBrickInches] = useState(
    initial.minimumBrickInches,
  );
  const [connectionType, setConnectionType] = useState(initial.connectionType);
  const [sumpMode, setSumpMode] = useState(initial.sumpMode);
  const [sumpFixedInches, setSumpFixedInches] = useState(
    initial.sumpFixedInches,
  );
  const [openingToJointMinTopInches, setOpeningToJointMinTopInches] =
    useState(initial.openingToJointMinTopInches);
  const [openingToJointMinBottomInches, setOpeningToJointMinBottomInches] =
    useState(initial.openingToJointMinBottomInches);
  const [topSlabOpeningInches, setTopSlabOpeningInches] = useState(
    initial.topSlabOpeningInches,
  );
  const [rectWallPricePerFoot, setRectWallPricePerFoot] = useState(
    initial.rectWallPricePerFoot,
  );
  const [rectMinPricingHeightFeet, setRectMinPricingHeightFeet] = useState(
    initial.rectMinPricingHeightFeet,
  );
  const [rectTopSlabPrice, setRectTopSlabPrice] = useState(
    initial.rectTopSlabPrice,
  );
  const [rectBaseSlabPrice, setRectBaseSlabPrice] = useState(
    initial.rectBaseSlabPrice,
  );
  const [rectTopSlabOpeningLengthInches, setRectTopSlabOpeningLengthInches] =
    useState(initial.rectTopSlabOpeningLengthInches);
  const [rectTopSlabOpeningWidthInches, setRectTopSlabOpeningWidthInches] =
    useState(initial.rectTopSlabOpeningWidthInches);
  const [rectTopSlabOpeningSide, setRectTopSlabOpeningSide] =
    useState<RectWall>(initial.rectTopSlabOpeningSide);
  const [sheetPdfId, setSheetPdfId] = useState(initial.sheetPdfId);
  const [status, setStatus] = useState(initial.status);
  const [notes, setNotes] = useState(initial.notes);
  // A round template is cast in exactly one mold; the mold is its diameter.
  const [moldDiameterFeet, setMoldDiameterFeet] = useState(
    initial.diameters[0]?.insideDiameterFeet ?? "",
  );
  const extraDiameterCount = Math.max(0, initial.diameters.length - 1);
  // Rectangular slabs are explicit checkboxes (stored as thickness 0 = none).
  const [hasTopSlab, setHasTopSlab] = useState(
    defaultValue ? Number(initial.topSlabThicknessInches) > 0 : true,
  );
  const [hasBaseSlab, setHasBaseSlab] = useState(
    defaultValue ? Number(initial.baseSlabThicknessInches) > 0 : true,
  );
  // A rectangular template is one mold/form: exactly one inside footprint.
  // Legacy templates with several preset rows seed from the first.
  const [rectLengthInches, setRectLengthInches] = useState(
    initial.rectSizes[0]?.insideLengthInches ?? "",
  );
  const [rectWidthInches, setRectWidthInches] = useState(
    initial.rectSizes[0]?.insideWidthInches ?? "",
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const isRect = shape === "RECTANGULAR";
  // Round structures always have both slabs.
  const topSlabOn = !isRect || hasTopSlab;
  const baseSlabOn = !isRect || hasBaseSlab;
  const selectedMold =
    moldDiameterFeet === ""
      ? null
      : (moldOptions.find(
          (mold) =>
            Math.abs(mold.insideDiameterFeet - Number(moldDiameterFeet)) < 1e-6,
        ) ?? null);
  // Changing the mold would silently resize every sheet already built.
  const moldLocked = sheetsLocked && initial.diameters.length === 1;
  const rectSizeLocked = sheetsLocked && initial.rectSizes.length > 0;
  const lockedByText = `${sheetCount} drill sheet${sheetCount === 1 ? " uses" : "s use"} this template`;
  // A Sheet PDF is drawn for one shape and, when rectangular, one slab
  // combination: only the ones that fit this template are offered. A pick
  // that stops fitting (the shape or a slab changed) is simply not sent, and
  // comes back if the change is undone.
  const sheetPdfKind: SheetPdfKind = {
    shape,
    hasTopSlab: topSlabOn,
    hasBaseSlab: baseSlabOn,
  };
  const fittingSheetPdfs = sheetPdfOptions.filter((option) =>
    sheetPdfFitsTemplate(option, sheetPdfKind),
  );
  const selectedSheetPdfId = fittingSheetPdfs.some(
    (option) => option.id === sheetPdfId,
  )
    ? sheetPdfId
    : "";
  const unfitSheetPdf = selectedSheetPdfId
    ? null
    : (sheetPdfOptions.find((option) => option.id === sheetPdfId) ?? null);
  const sheetPdfCoverage = useSheetPdfCoverage(selectedSheetPdfId || null);
  const sheetPdfKindText = isRect
    ? `rectangular Sheet PDFs drawn for ${sheetPdfSlabLabel(topSlabOn, baseSlabOn)}`
    : "round Sheet PDFs";

  const payloadJson = useMemo(() => {
    return JSON.stringify({
      name,
      agencyStandard,
      shape,
      wallThicknessInches,
      baseSlabThicknessInches,
      topSlabThicknessInches,
      hasTopSlab: topSlabOn,
      hasBaseSlab: baseSlabOn,
      castingProductId: castingProductId || null,
      minimumBrickInches,
      connectionType,
      sumpMode,
      sumpFixedInches: sumpMode === "FIXED" ? sumpFixedInches : null,
      openingToJointMinTopInches,
      openingToJointMinBottomInches,
      topSlabOpeningInches: topSlabOpeningInches || null,
      rectWallPricePerFoot: rectWallPricePerFoot || null,
      rectMinPricingHeightFeet: rectMinPricingHeightFeet || null,
      rectTopSlabPrice: rectTopSlabPrice || null,
      rectBaseSlabPrice: rectBaseSlabPrice || null,
      rectTopSlabOpeningLengthInches: rectTopSlabOpeningLengthInches || null,
      rectTopSlabOpeningWidthInches: rectTopSlabOpeningWidthInches || null,
      rectTopSlabOpeningSide,
      sheetPdfId: selectedSheetPdfId || null,
      status,
      notes,
      diameters:
        moldDiameterFeet === ""
          ? []
          : [{ insideDiameterFeet: moldDiameterFeet }],
      rectSizes: [
        {
          insideLengthInches: rectLengthInches,
          insideWidthInches: rectWidthInches,
        },
      ],
    });
  }, [
    name,
    agencyStandard,
    shape,
    wallThicknessInches,
    baseSlabThicknessInches,
    topSlabThicknessInches,
    castingProductId,
    minimumBrickInches,
    connectionType,
    sumpMode,
    sumpFixedInches,
    openingToJointMinTopInches,
    openingToJointMinBottomInches,
    topSlabOpeningInches,
    rectWallPricePerFoot,
    rectMinPricingHeightFeet,
    rectTopSlabPrice,
    rectBaseSlabPrice,
    rectTopSlabOpeningLengthInches,
    rectTopSlabOpeningWidthInches,
    rectTopSlabOpeningSide,
    selectedSheetPdfId,
    status,
    notes,
    moldDiameterFeet,
    topSlabOn,
    baseSlabOn,
    rectLengthInches,
    rectWidthInches,
  ]);

  return (
    <form
      action={async (formData) => {
        setSaveError(null);
        const result = await action(formData);
        if (isActionError(result)) {
          setSaveError(result.error);
        }
      }}
      className="space-y-3"
    >
      <input type="hidden" name="payload" value={payloadJson} />
      {priceListId ? (
        <input type="hidden" name="priceListId" value={priceListId} />
      ) : null}
      {expectedUpdatedAt ? (
        <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      ) : null}

      <SectionCard title="Template Details">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Template Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Suffolk County Sanitary Manhole"
              className={structureInputClassName}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Agency / Standard
            </label>
            <input
              type="text"
              value={agencyStandard}
              onChange={(e) => setAgencyStandard(e.target.value)}
              className={structureInputClassName}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Shape
            </label>
            <select
              value={shape}
              onChange={(e) => {
                const nextShape = e.target.value as "CIRCULAR" | "RECTANGULAR";
                setShape(nextShape);
              }}
              disabled={sheetsLocked}
              className={structureInputClassName}
            >
              <option value="CIRCULAR">Circular</option>
              <option value="RECTANGULAR">Rectangular</option>
            </select>
            {sheetsLocked ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Locked: {lockedByText}. Duplicate it to make a different shape.
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Status
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "ACTIVE" | "INACTIVE")
              }
              className={structureInputClassName}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {isRect ? (
        <SectionCard
          title="Size"
          description="Every structure on this template is this size inside."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Inside Length (in) *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required={isRect}
                disabled={rectSizeLocked}
                value={rectLengthInches}
                onChange={(e) => setRectLengthInches(e.target.value)}
                placeholder="48"
                className={slabInputClassName}
              />
              {feetInchesHint(rectLengthInches) ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  {feetInchesHint(rectLengthInches)}
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Inside Width (in) *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required={isRect}
                disabled={rectSizeLocked}
                value={rectWidthInches}
                onChange={(e) => setRectWidthInches(e.target.value)}
                placeholder="48"
                className={slabInputClassName}
              />
              {feetInchesHint(rectWidthInches) ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  {feetInchesHint(rectWidthInches)}
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Wall Thickness (in)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={wallThicknessInches}
                onChange={(e) => setWallThicknessInches(e.target.value)}
                className={structureInputClassName}
              />
            </div>
          </div>
          {rectSizeLocked ? (
            <p className="mt-2 text-[11px] text-slate-500">
              The inside size is locked: {lockedByText}. Duplicate it to make
              another size.
            </p>
          ) : null}
        </SectionCard>
      ) : (
        <SectionCard
          title="Size"
          description="One mold per template. The mold sets the diameter."
        >
          <div className="space-y-3">
            <div>
              <label
                htmlFor="template-mold"
                className="block text-xs font-medium text-slate-700"
              >
                Mold *
              </label>
              <select
                id="template-mold"
                required={!isRect}
                value={moldDiameterFeet}
                onChange={(e) => setMoldDiameterFeet(e.target.value)}
                disabled={moldLocked}
                className={`${structureInputClassName} max-w-2xl disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600`}
              >
                <option value="">— Select mold —</option>
                {moldOptions.map((mold) => (
                  <option
                    key={mold.insideDiameterFeet}
                    value={String(mold.insideDiameterFeet)}
                  >
                    {moldOptionLabel(mold)}
                  </option>
                ))}
                {moldDiameterFeet !== "" && !selectedMold ? (
                  <option value={moldDiameterFeet}>
                    {moldDiameterFeet}&apos; ID — no mold configured
                  </option>
                ) : null}
              </select>
              {moldOptions.length === 0 ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  No molds configured yet. Add them in Settings → Structure
                  Molds first.
                </p>
              ) : null}
              {moldDiameterFeet !== "" && !selectedMold ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  No mold registered for {moldDiameterFeet}&apos;. Add it in
                  Settings → Structure Molds or pick another mold.
                </p>
              ) : null}
              {moldLocked ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Locked: {lockedByText}. Duplicate it to use another mold.
                </p>
              ) : null}
              {extraDiameterCount > 0 ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  This template used to offer {extraDiameterCount + 1}{" "}
                  diameters. Saving keeps only the mold picked here.
                </p>
              ) : null}
            </div>
            {selectedMold ? (
              <dl className="grid overflow-hidden rounded-lg border border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
                {moldFacts(selectedMold).map((fact) => (
                  <div
                    key={fact.label}
                    className="border-b border-slate-200 bg-slate-50 px-3 py-2 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0"
                  >
                    <dt className="text-[11px] text-slate-500">{fact.label}</dt>
                    <dd className="text-sm font-semibold text-slate-900">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="text-[11px] text-slate-500">
              These values come from the mold (Settings → Structure Molds) and
              are read-only here. For another size, duplicate the template and
              pick a different mold.
            </p>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Slabs"
        description={
          isRect
            ? "Check a slab to include it. Every structure on this template gets the same slabs."
            : "Round structures always have both slabs."
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex h-9 w-28 items-center gap-2 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={topSlabOn}
                disabled={!isRect || sheetsLocked}
                onChange={(e) => {
                  setHasTopSlab(e.target.checked);
                  if (e.target.checked && !(Number(topSlabThicknessInches) > 0)) {
                    setTopSlabThicknessInches("");
                  }
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              Top slab
            </label>
            <div className="w-40">
              <label className="block text-xs font-medium text-slate-700">
                {isRect ? "Thickness (in)" : "Thickness (in, incl. key)"}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label="Top slab thickness (in)"
                required={topSlabOn}
                disabled={!topSlabOn}
                value={topSlabOn ? topSlabThicknessInches : ""}
                onChange={(e) => setTopSlabThicknessInches(e.target.value)}
                className={slabInputClassName}
              />
            </div>
            {isRect ? (
              <>
                <div className="w-40">
                  <label className="block text-xs font-medium text-slate-700">
                    Top Slab Price ($)
                    {priceListName ? ` — ${priceListName}` : ""}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!topSlabOn}
                    value={topSlabOn ? rectTopSlabPrice : ""}
                    onChange={(e) => setRectTopSlabPrice(e.target.value)}
                    placeholder={topSlabOn ? "300.00" : ""}
                    className={slabInputClassName}
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs font-medium text-slate-700">
                    Opening Length (in)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    aria-label="Top Slab Opening Length (in)"
                    disabled={!topSlabOn}
                    value={topSlabOn ? rectTopSlabOpeningLengthInches : ""}
                    onChange={(e) =>
                      setRectTopSlabOpeningLengthInches(e.target.value)
                    }
                    placeholder={topSlabOn ? "30" : ""}
                    className={slabInputClassName}
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs font-medium text-slate-700">
                    Opening Width (in)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    aria-label="Top Slab Opening Width (in)"
                    disabled={!topSlabOn}
                    value={topSlabOn ? rectTopSlabOpeningWidthInches : ""}
                    onChange={(e) =>
                      setRectTopSlabOpeningWidthInches(e.target.value)
                    }
                    placeholder={topSlabOn ? "30" : ""}
                    className={slabInputClassName}
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs font-medium text-slate-700">
                    Opening Touches Wall
                  </label>
                  <select
                    disabled={!topSlabOn}
                    value={rectTopSlabOpeningSide}
                    onChange={(e) =>
                      setRectTopSlabOpeningSide(e.target.value as RectWall)
                    }
                    className={slabInputClassName}
                  >
                    {RECT_WALL_OPTIONS.map((wall) => (
                      <option key={wall} value={wall}>
                        {RECT_WALL_LABELS[wall]} wall
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="w-40">
                <label className="block text-xs font-medium text-slate-700">
                  Top Slab Opening (in)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={topSlabOpeningInches}
                  onChange={(e) => setTopSlabOpeningInches(e.target.value)}
                  placeholder="30"
                  className={structureInputClassName}
                />
              </div>
            )}
            {isRect && !topSlabOn ? (
              <p className="flex h-9 items-center text-xs text-slate-500">
                No top slab. Open top.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex h-9 w-28 items-center gap-2 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={baseSlabOn}
                disabled={!isRect || sheetsLocked}
                onChange={(e) => {
                  setHasBaseSlab(e.target.checked);
                  if (
                    e.target.checked &&
                    !(Number(baseSlabThicknessInches) > 0)
                  ) {
                    setBaseSlabThicknessInches("");
                  }
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              Base slab
            </label>
            <div className="w-40">
              <label className="block text-xs font-medium text-slate-700">
                Thickness (in)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label="Base slab thickness (in)"
                required={baseSlabOn}
                disabled={!baseSlabOn}
                value={baseSlabOn ? baseSlabThicknessInches : ""}
                onChange={(e) => setBaseSlabThicknessInches(e.target.value)}
                className={slabInputClassName}
              />
            </div>
            {isRect ? (
              <div className="w-40">
                <label className="block text-xs font-medium text-slate-700">
                  Base Slab Price ($)
                  {priceListName ? ` — ${priceListName}` : ""}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!baseSlabOn}
                  value={baseSlabOn ? rectBaseSlabPrice : ""}
                  onChange={(e) => setRectBaseSlabPrice(e.target.value)}
                  placeholder={baseSlabOn ? "200.00" : ""}
                  className={slabInputClassName}
                />
              </div>
            ) : null}
            {isRect && !baseSlabOn ? (
              <p className="flex h-9 items-center text-xs text-slate-500">
                No base slab. Open bottom.
              </p>
            ) : null}
          </div>

          {isRect ? (
            <p className="text-[11px] text-slate-500">
              {sheetsLocked
                ? `Slabs are locked: ${lockedByText}. Duplicate it to add or remove a slab.`
                : "To sell the same box with different slabs, duplicate the template and change the checkboxes on the copy."}{" "}
              The opening runs along the inside length; structures inherit it
              unless they enter their own. Blank leaves the sheet&apos;s top
              slab box empty.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              The top slab opening is whole inches and prints on the drill
              sheet. Blank leaves the sheet&apos;s opening box empty.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Sheet PDF"
        description={`The blank fillable drawing these drill sheets print on. Only ${sheetPdfKindText} are listed.`}
      >
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-[260px] flex-1 sm:max-w-md">
            <label
              htmlFor="template-sheet-pdf"
              className="block text-xs font-medium text-slate-700"
            >
              Sheet PDF
            </label>
            <select
              id="template-sheet-pdf"
              value={selectedSheetPdfId}
              onChange={(e) => setSheetPdfId(e.target.value)}
              className={structureInputClassName}
            >
              <option value="">— None —</option>
              {fittingSheetPdfs.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          {sheetPdfCoverage ? (
            <p className="pb-2 text-xs font-semibold" aria-live="polite">
              {sheetPdfCoverage.status === "loading" ? (
                <span className="font-normal text-slate-400">
                  Checking fields…
                </span>
              ) : sheetPdfCoverage.status === "error" ? (
                <span className="text-rose-700">
                  Field check: {sheetPdfCoverage.message}
                </span>
              ) : sheetPdfCoverageSummary(sheetPdfCoverage).ok ? (
                <span className="text-green-700">
                  Field check: all fields matched
                </span>
              ) : (
                <span
                  className="text-amber-700"
                  title={`Missing: ${sheetPdfCoverage.missing.join(", ")}`}
                >
                  Field check:{" "}
                  {sheetPdfCoverageSummary(sheetPdfCoverage).text.toLowerCase()}
                </span>
              )}
            </p>
          ) : null}
          {/* A new tab, so edits made on this form are not lost. */}
          <Link
            href="/structures/sheet-pdfs"
            target="_blank"
            className="pb-2 text-xs font-semibold text-sky-800 underline hover:text-sky-950"
          >
            Manage Sheet PDFs
          </Link>
        </div>
        {unfitSheetPdf ? (
          <p className="mt-2 text-xs text-slate-600">
            &ldquo;{unfitSheetPdf.name}&rdquo; is not drawn for this
            template&apos;s {isRect ? "slabs" : "shape"}, so it is no longer
            picked.
          </p>
        ) : null}
        {fittingSheetPdfs.length === 0 ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          >
            There are no {sheetPdfKindText} yet. Add one under{" "}
            <Link
              href="/structures/sheet-pdfs"
              target="_blank"
              className="font-semibold underline"
            >
              Sheet PDFs
            </Link>
            , then pick it here.{" "}
            {isRect
              ? "Until then this template's drill sheets cannot print."
              : "Until then this template's drill sheets print on the generated layout."}
          </p>
        ) : !selectedSheetPdfId ? (
          <p
            role="status"
            className={
              isRect
                ? "mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                : "mt-2 text-xs text-slate-500"
            }
          >
            {isRect
              ? "No Sheet PDF is picked. This template's drill sheets cannot print until one is."
              : "No Sheet PDF is picked: this template's drill sheets print on the generated layout."}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title={isRect ? "Pricing and Other Settings" : "Other Settings"}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isRect ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Wall Price per Vertical Foot ($)
                  {priceListName ? ` — ${priceListName}` : ""}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rectWallPricePerFoot}
                  onChange={(e) => setRectWallPricePerFoot(e.target.value)}
                  placeholder="250.00"
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Minimum Billed Height (ft)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={rectMinPricingHeightFeet}
                  onChange={(e) => setRectMinPricingHeightFeet(e.target.value)}
                  placeholder="4"
                  className={structureInputClassName}
                />
              </div>
            </>
          ) : null}
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Default Casting
            </label>
            <select
              value={castingProductId}
              onChange={(e) => setCastingProductId(e.target.value)}
              className={structureInputClassName}
            >
              <option value="">— Select —</option>
              {castingOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.heightFeet != null ? ` (${c.heightFeet}')` : ""}
                </option>
              ))}
            </select>
          </div>
          {!isRect ? (
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Connection Type
              </label>
              <select
                value={connectionType}
                onChange={(e) =>
                  setConnectionType(
                    e.target.value as StructureTemplateFormValue["connectionType"],
                  )
                }
                className={structureInputClassName}
              >
                <option value="KOR_N_SEAL">Kor-N-Seal Boot</option>
                <option value="CAST_IN">Cast-In</option>
                <option value="GROUTED">Grouted</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Minimum Brick (in)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minimumBrickInches}
              onChange={(e) => setMinimumBrickInches(e.target.value)}
              className={structureInputClassName}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Sump Mode
            </label>
            <select
              value={sumpMode}
              onChange={(e) =>
                setSumpMode(e.target.value as "DEFAULT" | "FIXED")
              }
              className={structureInputClassName}
            >
              <option value="DEFAULT">Default (centered in hole)</option>
              <option value="FIXED">Fixed distance</option>
            </select>
          </div>
          {sumpMode === "FIXED" ? (
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Fixed Sump (in)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sumpFixedInches}
                onChange={(e) => setSumpFixedInches(e.target.value)}
                className={structureInputClassName}
              />
            </div>
          ) : null}
          {!isRect ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Opening-to-Joint Min Top (in)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingToJointMinTopInches}
                  onChange={(e) =>
                    setOpeningToJointMinTopInches(e.target.value)
                  }
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Opening-to-Joint Min Bottom (in)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingToJointMinBottomInches}
                  onChange={(e) =>
                    setOpeningToJointMinBottomInches(e.target.value)
                  }
                  className={structureInputClassName}
                />
              </div>
            </>
          ) : null}
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-medium text-slate-700">
              Notes
            </label>
            <textarea
              rows={1}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={structureInputClassName}
            />
          </div>
        </div>
      </SectionCard>

      {saveError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {saveError}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
