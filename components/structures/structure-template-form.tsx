"use client";

import Link from "next/link";
import { randomId } from "@/lib/random-id";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  structureInputClassName,
  structureTableInputClassName,
} from "@/components/structures/structure-utils";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
type DiameterField = {
  id: string;
  insideDiameterFeet: string;
};

type RectSizeField = {
  id: string;
  insideLengthFeet: string;
  insideWidthFeet: string;
};

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
  rectWallPricePerFoot: string;
  rectMinPricingHeightFeet: string;
  rectTopSlabPrice: string;
  rectBaseSlabPrice: string;
  rectPdfSetId: string;
  status: "ACTIVE" | "INACTIVE";
  notes: string;
  diameters: DiameterField[];
  rectSizes: RectSizeField[];
};

export type RectPdfSetOption = {
  id: string;
  name: string;
  shape: "CIRCULAR" | "RECTANGULAR";
};

/** A registered circular mold (Settings → Structure Molds). */
export type TemplateMoldOption = {
  label: string | null;
  insideDiameterFeet: number;
  wallThicknessInches: number | null;
  maxBaseHeightFeet: number;
  maxRiserHeightFeet: number;
};

type StructureTemplateFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  submitLabel: string;
  defaultValue?: StructureTemplateFormValue;
  /** ISO updatedAt of the template when the edit page loaded it — rejects
   * stale saves (optimistic concurrency). */
  expectedUpdatedAt?: string;
  castingOptions: CastingOption[];
  rectPdfSetOptions?: RectPdfSetOption[];
  /** Circular templates can only offer diameters with a registered mold. */
  moldOptions?: TemplateMoldOption[];
  /** Rect wall/slab prices read and write this price list's entry. */
  priceListId?: string | null;
  priceListName?: string | null;
};

function uid() {
  return randomId();
}

function createDiameter(): DiameterField {
  return { id: uid(), insideDiameterFeet: "" };
}

function moldOptionLabel(mold: TemplateMoldOption): string {
  const parts = [
    `${mold.insideDiameterFeet}' ID`,
    mold.wallThicknessInches != null
      ? `${mold.wallThicknessInches}" wall`
      : null,
    `base ≤ ${mold.maxBaseHeightFeet}'`,
    `riser ≤ ${mold.maxRiserHeightFeet}'`,
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
  rectWallPricePerFoot: "",
  rectMinPricingHeightFeet: "",
  rectTopSlabPrice: "",
  rectBaseSlabPrice: "",
  rectPdfSetId: "",
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
  rectPdfSetOptions = [],
  moldOptions = [],
  priceListId = null,
  priceListName = null,
}: StructureTemplateFormProps) {
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
  const [rectPdfSetId, setRectPdfSetId] = useState(initial.rectPdfSetId);
  const [status, setStatus] = useState(initial.status);
  const [notes, setNotes] = useState(initial.notes);
  const [diameters, setDiameters] = useState<DiameterField[]>(
    initial.diameters.length > 0 ? initial.diameters : [createDiameter()],
  );
  // A rectangular template is one mold/form: exactly one inside footprint.
  // Legacy templates with several preset rows seed from the first.
  const [rectLengthFeet, setRectLengthFeet] = useState(
    initial.rectSizes[0]?.insideLengthFeet ?? "",
  );
  const [rectWidthFeet, setRectWidthFeet] = useState(
    initial.rectSizes[0]?.insideWidthFeet ?? "",
  );

  const isRect = shape === "RECTANGULAR";
  // Sets are shape-specific: only offer the matching ones.
  const shapePdfSetOptions = rectPdfSetOptions.filter(
    (option) => option.shape === shape,
  );

  const payloadJson = useMemo(() => {
    return JSON.stringify({
      name,
      agencyStandard,
      shape,
      wallThicknessInches,
      baseSlabThicknessInches,
      topSlabThicknessInches,
      castingProductId: castingProductId || null,
      minimumBrickInches,
      connectionType,
      sumpMode,
      sumpFixedInches: sumpMode === "FIXED" ? sumpFixedInches : null,
      openingToJointMinTopInches,
      openingToJointMinBottomInches,
      rectWallPricePerFoot: rectWallPricePerFoot || null,
      rectMinPricingHeightFeet: rectMinPricingHeightFeet || null,
      rectTopSlabPrice: rectTopSlabPrice || null,
      rectBaseSlabPrice: rectBaseSlabPrice || null,
      rectPdfSetId: rectPdfSetId || null,
      status,
      notes,
      diameters: diameters.map((d) => ({
        insideDiameterFeet: d.insideDiameterFeet,
      })),
      rectSizes: [
        {
          insideLengthFeet: rectLengthFeet,
          insideWidthFeet: rectWidthFeet,
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
    rectWallPricePerFoot,
    rectMinPricingHeightFeet,
    rectTopSlabPrice,
    rectBaseSlabPrice,
    rectPdfSetId,
    status,
    notes,
    diameters,
    rectLengthFeet,
    rectWidthFeet,
  ]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="payload" value={payloadJson} />
      {priceListId ? (
        <input type="hidden" name="priceListId" value={priceListId} />
      ) : null}
      {expectedUpdatedAt ? (
        <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      ) : null}

      <SectionCard title="Template Details">
        {/* One flowing grid: conditional field groups use `contents` so
            everything packs into full four-field rows. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="contents">
            <div className="lg:col-span-2">
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
          </div>

          <div className="contents">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Shape
              </label>
              <select
                value={shape}
                onChange={(e) => {
                  const nextShape = e.target.value as
                    | "CIRCULAR"
                    | "RECTANGULAR";
                  setShape(nextShape);
                  // The selected set belongs to the previous shape.
                  if (
                    rectPdfSetId &&
                    !rectPdfSetOptions.some(
                      (option) =>
                        option.id === rectPdfSetId &&
                        option.shape === nextShape,
                    )
                  ) {
                    setRectPdfSetId("");
                  }
                }}
                className={structureInputClassName}
              >
                <option value="CIRCULAR">Circular</option>
                <option value="RECTANGULAR">Rectangular</option>
              </select>
            </div>
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

          <div className="contents">
            {isRect ? (
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
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Wall Thickness
                </label>
                <p className="mt-2 text-[11px] text-slate-500">
                  Comes from each mold — set per diameter in Settings →
                  Structure Molds.
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Base Slab Thickness (in)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={baseSlabThicknessInches}
                onChange={(e) => setBaseSlabThicknessInches(e.target.value)}
                className={structureInputClassName}
              />
              {isRect ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  0 or blank = no base slab (open bottom)
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                {isRect
                  ? "Top Slab Thickness (in)"
                  : "Top Slab Thickness (in, incl. key)"}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={topSlabThicknessInches}
                onChange={(e) => setTopSlabThicknessInches(e.target.value)}
                className={structureInputClassName}
              />
              {isRect ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  0 or blank = no top slab
                </p>
              ) : null}
            </div>
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
          </div>

          <div className="contents">
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
          </div>

          {isRect ? (
            <div className="contents">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Inside Length (ft) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  required={isRect}
                  value={rectLengthFeet}
                  onChange={(e) => setRectLengthFeet(e.target.value)}
                  placeholder="4"
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Inside Width (ft) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  required={isRect}
                  value={rectWidthFeet}
                  onChange={(e) => setRectWidthFeet(e.target.value)}
                  placeholder="4"
                  className={structureInputClassName}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  One size per template — sheets and quotes only pick height.
                </p>
              </div>
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
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Top Slab Price ($){priceListName ? ` — ${priceListName}` : ""}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rectTopSlabPrice}
                  onChange={(e) => setRectTopSlabPrice(e.target.value)}
                  placeholder="300.00"
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Base Slab Price ($){priceListName ? ` — ${priceListName}` : ""}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rectBaseSlabPrice}
                  onChange={(e) => setRectBaseSlabPrice(e.target.value)}
                  placeholder="200.00"
                  className={structureInputClassName}
                />
              </div>
            </div>
          ) : null}

          <div className="contents">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Sheet PDF Set
              </label>
              <select
                value={rectPdfSetId}
                onChange={(e) => setRectPdfSetId(e.target.value)}
                className={structureInputClassName}
              >
                <option value="">— None —</option>
                {shapePdfSetOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Manage sets under Structures → Sheet PDF Sets.
              </p>
            </div>
            <div className="lg:col-span-3">
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
        </div>
      </SectionCard>

      {isRect ? null : (
      <SectionCard
        title="Offered Diameters"
        description="Pick from the mold registry — wall thickness and max pour heights are constants of each mold (Settings → Structure Molds)."
        action={
          <button
            type="button"
            onClick={() => setDiameters((rows) => [...rows, createDiameter()])}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add Diameter
          </button>
        }
        noPadding
      >
        {moldOptions.length === 0 ? (
          <p className="border-b border-slate-100 px-4 py-2 text-[11px] text-amber-700">
            No molds configured yet — add them in Settings → Structure Molds
            before offering diameters here.
          </p>
        ) : null}
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Mold</th>
                <th className={tableHeaderCellClassName}></th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {diameters.map((diameter, index) => {
                const value = diameter.insideDiameterFeet;
                const matchesMold = moldOptions.some(
                  (mold) =>
                    Math.abs(mold.insideDiameterFeet - Number(value)) < 1e-6,
                );
                const takenElsewhere = new Set(
                  diameters
                    .filter((row) => row.id !== diameter.id)
                    .map((row) => row.insideDiameterFeet),
                );
                return (
                <tr key={diameter.id}>
                  <td className={tableCellClassName}>
                    <select
                      value={value}
                      onChange={(e) =>
                        setDiameters((rows) =>
                          rows.map((row) =>
                            row.id === diameter.id
                              ? { ...row, insideDiameterFeet: e.target.value }
                              : row,
                          ),
                        )
                      }
                      className={`${structureTableInputClassName} min-w-[280px]`}
                    >
                      <option value="">— Select mold —</option>
                      {moldOptions.map((mold) => (
                        <option
                          key={mold.insideDiameterFeet}
                          value={String(mold.insideDiameterFeet)}
                          disabled={takenElsewhere.has(
                            String(mold.insideDiameterFeet),
                          )}
                        >
                          {moldOptionLabel(mold)}
                        </option>
                      ))}
                      {value !== "" && !matchesMold ? (
                        <option value={value}>
                          {value}&apos; ID — no mold configured
                        </option>
                      ) : null}
                    </select>
                    {value !== "" && !matchesMold ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        No mold registered for {value}&apos; — add it in
                        Settings → Structure Molds or pick another size.
                      </p>
                    ) : null}
                  </td>
                  <td className={`${tableCellClassName} py-1.5 text-right`}>
                    {diameters.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDiameters((rows) =>
                            rows.filter((row) => row.id !== diameter.id),
                          )
                        }
                        className="text-[11px] font-medium text-rose-600 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        #{index + 1}
                      </span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
      )}

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
