"use client";

import Link from "next/link";
import { randomId } from "@/lib/random-id";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  RectSheetPreview,
  type RectSheetPreviewMeta,
} from "@/components/drill-sheets/rect-sheet-preview";
import type { DrillSheetJobOption } from "@/components/drill-sheets/drill-sheet-form";
import {
  structureInputClassName,
  structureTableInputClassName,
} from "@/components/structures/structure-utils";
import {
  computeRectStructure,
  formatPounds,
  RECT_OPENING_TABLE_ROWS,
  RECT_WALL_LABELS,
  type RectOpeningPlacement,
  type RectStructureInput,
  type RectWall,
} from "@/lib/rect-structure";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";

export type RectSheetTemplateOption = {
  id: string;
  name: string;
  agencyStandard: string | null;
  wallThicknessInches: number;
  baseSlabThicknessInches: number;
  topSlabThicknessInches: number;
  minimumBrickInches: number;
  sumpMode: "DEFAULT" | "FIXED";
  sumpFixedInches: number | null;
  wallPricePerFoot: number;
  minPricingHeightFeet: number;
  topSlabPrice: number;
  baseSlabPrice: number;
  defaultCastingProductId: string | null;
  defaultCastingHeightFeet: number | null;
  presetSizes: {
    id: string;
    insideLengthFeet: number;
    insideWidthFeet: number;
  }[];
};

export type RectSheetCastingOption = {
  id: string;
  name: string;
  heightFeet: number | null;
};

export type RectSheetOpeningSizeOption = {
  pipeMaterial: string;
  pipeSizeInches: number;
  openingWidthInches: number;
  openingHeightInches: number;
  pricePerOpening: number | null;
};

export type RectOpeningField = {
  id: string;
  label: string;
  wall: RectWall | "";
  pipeMaterial: string;
  pipeSizeInches: string;
  invertElevation: string;
  angle: string;
  placement: RectOpeningPlacement;
  offsetInches: string;
  widthOverrideInches: string;
};

export type RectSectionField = {
  id: string;
  heightFeet: string;
  /** Key at the joint ABOVE this section (ignored on the top section). */
  topKey: boolean;
};

export type RectSheetFormValues = {
  templateId: string;
  castingProductId: string;
  jobId: string;
  structureNumber: string;
  contractor: string;
  project: string;
  date: string;
  inspection: string;
  approvedBy: string;
  rimElevation: string;
  insideLengthFeet: string;
  insideWidthFeet: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  baseAttached: boolean;
  topSlabOpeningLengthInches: string;
  topSlabOpeningWidthInches: string;
  topSlabOpeningSide: RectWall;
  maxPickWeightLbs: string;
  sections: RectSectionField[];
  openings: RectOpeningField[];
};

type RectSheetFormProps = {
  action: (formData: FormData) => Promise<void>;
  templates: RectSheetTemplateOption[];
  castings: RectSheetCastingOption[];
  jobs: DrillSheetJobOption[];
  openingSizes: RectSheetOpeningSizeOption[];
  defaultValues?: RectSheetFormValues;
  /** Preselect the job (e.g. arriving from a job's Production tab). */
  defaultJobId?: string;
  expectedUpdatedAt?: string;
  submitLabel?: string;
};

const WALL_OPTIONS: RectWall[] = ["UP", "DOWN", "LEFT", "RIGHT"];

function uid() {
  return randomId();
}

function createOpening(): RectOpeningField {
  return {
    id: uid(),
    label: "",
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

function createSection(): RectSectionField {
  return { id: uid(), heightFeet: "", topKey: false };
}

function parseNum(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function RectSheetForm({
  action,
  templates,
  castings,
  jobs,
  openingSizes,
  defaultValues,
  defaultJobId,
  expectedUpdatedAt,
  submitLabel = "Save Sheet",
}: RectSheetFormProps) {
  const initialTemplate = defaultValues?.templateId
    ? (templates.find((t) => t.id === defaultValues.templateId) ?? templates[0])
    : templates[0];

  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");
  const [castingProductId, setCastingProductId] = useState(
    defaultValues?.castingProductId ??
      initialTemplate?.defaultCastingProductId ??
      "",
  );
  const [jobId, setJobId] = useState(
    defaultValues?.jobId ?? defaultJobId ?? "",
  );
  const [structureNumber, setStructureNumber] = useState(
    defaultValues?.structureNumber ?? "",
  );
  const [contractor, setContractor] = useState(defaultValues?.contractor ?? "");
  const [project, setProject] = useState(defaultValues?.project ?? "");
  const [date, setDate] = useState(
    defaultValues?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [inspection, setInspection] = useState(defaultValues?.inspection ?? "");
  const [approvedBy, setApprovedBy] = useState(defaultValues?.approvedBy ?? "");
  const [rimElevation, setRimElevation] = useState(
    defaultValues?.rimElevation ?? "",
  );
  const [insideLengthFeet, setInsideLengthFeet] = useState(
    defaultValues?.insideLengthFeet ?? "",
  );
  const [insideWidthFeet, setInsideWidthFeet] = useState(
    defaultValues?.insideWidthFeet ?? "",
  );
  const [hasTopSlab, setHasTopSlab] = useState(
    defaultValues?.hasTopSlab ??
      (initialTemplate ? initialTemplate.topSlabThicknessInches > 0 : true),
  );
  const [hasBaseSlab, setHasBaseSlab] = useState(
    defaultValues?.hasBaseSlab ??
      (initialTemplate ? initialTemplate.baseSlabThicknessInches > 0 : true),
  );
  const [baseAttached, setBaseAttached] = useState(
    defaultValues?.baseAttached ?? true,
  );
  const [topSlabOpeningLengthInches, setTopSlabOpeningLengthInches] = useState(
    defaultValues?.topSlabOpeningLengthInches ?? "",
  );
  const [topSlabOpeningWidthInches, setTopSlabOpeningWidthInches] = useState(
    defaultValues?.topSlabOpeningWidthInches ?? "",
  );
  const [topSlabOpeningSide, setTopSlabOpeningSide] = useState<RectWall>(
    defaultValues?.topSlabOpeningSide ?? "UP",
  );
  const [maxPickWeightLbs, setMaxPickWeightLbs] = useState(
    defaultValues?.maxPickWeightLbs ?? "",
  );
  const [sections, setSections] = useState<RectSectionField[]>(
    defaultValues?.sections?.length ? defaultValues.sections : [],
  );
  const [openings, setOpenings] = useState<RectOpeningField[]>(
    defaultValues?.openings?.length ? defaultValues.openings : [createOpening()],
  );

  const template = templates.find((t) => t.id === templateId) ?? null;
  const casting = castings.find((c) => c.id === castingProductId) ?? null;

  // The template's mold/form defines the footprint — sheets only choose the
  // height. Legacy templates without a size keep the free inputs.
  const templateSize = template?.presetSizes[0] ?? null;
  const effectiveLengthFeet = templateSize
    ? String(templateSize.insideLengthFeet)
    : insideLengthFeet;
  const effectiveWidthFeet = templateSize
    ? String(templateSize.insideWidthFeet)
    : insideWidthFeet;

  const materials = useMemo(
    () => [...new Set(openingSizes.map((entry) => entry.pipeMaterial))],
    [openingSizes],
  );

  function sizesForMaterial(material: string): number[] {
    const wanted = material.trim().toLowerCase();
    return openingSizes
      .filter((entry) => entry.pipeMaterial.trim().toLowerCase() === wanted)
      .map((entry) => entry.pipeSizeInches);
  }

  function applyTemplate(nextId: string) {
    setTemplateId(nextId);
    const next = templates.find((t) => t.id === nextId) ?? null;
    if (next?.defaultCastingProductId) {
      setCastingProductId(next.defaultCastingProductId);
    }
    if (next && next.topSlabThicknessInches <= 0) {
      setHasTopSlab(false);
    }
    if (next && next.baseSlabThicknessInches <= 0) {
      setHasBaseSlab(false);
    }
  }

  const result = useMemo(() => {
    if (!template) {
      return null;
    }
    const input: RectStructureInput = {
      rimElevation: parseNum(rimElevation),
      castingHeightFeet: casting?.heightFeet ?? 0,
      insideLengthFeet: parseNum(effectiveLengthFeet),
      insideWidthFeet: parseNum(effectiveWidthFeet),
      hasTopSlab,
      hasBaseSlab,
      baseAttached,
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
      openingSizes,
      openings: openings.map((opening) => ({
        label: opening.label,
        wall: opening.wall || null,
        pipeMaterial: opening.pipeMaterial,
        pipeSizeInches: parseNum(opening.pipeSizeInches),
        invertElevation: parseNum(opening.invertElevation),
        angleDegrees: parseNum(opening.angle),
        placement: opening.placement,
        offsetInches: parseNum(opening.offsetInches),
        widthOverrideInches: parseNum(opening.widthOverrideInches),
      })),
      sectionHeightsFeet: sections
        .map((section) => parseNum(section.heightFeet))
        .filter((value): value is number => value != null && value > 0),
      jointKeys: sections.slice(0, -1).map((section) => section.topKey),
      topSlabOpening: hasTopSlab
        ? {
            lengthInches: parseNum(topSlabOpeningLengthInches),
            widthInches: parseNum(topSlabOpeningWidthInches),
            side: topSlabOpeningSide,
          }
        : null,
    };
    return computeRectStructure(input);
  }, [
    template,
    casting,
    rimElevation,
    effectiveLengthFeet,
    effectiveWidthFeet,
    hasTopSlab,
    hasBaseSlab,
    baseAttached,
    openingSizes,
    openings,
    sections,
    topSlabOpeningLengthInches,
    topSlabOpeningWidthInches,
    topSlabOpeningSide,
  ]);

  const payloadJson = useMemo(
    () =>
      JSON.stringify({
        templateId,
        castingProductId: castingProductId || null,
        jobId: jobId || null,
        structureNumber,
        contractor,
        project,
        date,
        inspection,
        approvedBy,
        rimElevation,
        insideLengthFeet: effectiveLengthFeet,
        insideWidthFeet: effectiveWidthFeet,
        hasTopSlab,
        hasBaseSlab,
        baseAttached,
        topSlabOpeningLengthInches,
        topSlabOpeningWidthInches,
        topSlabOpeningSide,
        sectionHeightsFeet: sections.map((section) => section.heightFeet),
        jointKeys: sections.slice(0, -1).map((section) => section.topKey),
        openings: openings.map((opening) => ({
          label: opening.label,
          wall: opening.wall,
          pipeMaterial: opening.pipeMaterial,
          pipeSizeInches: opening.pipeSizeInches,
          invertElevation: opening.invertElevation,
          angle: opening.angle,
          placement: opening.placement,
          offsetInches: opening.offsetInches,
          widthOverrideInches: opening.widthOverrideInches,
        })),
      }),
    [
      templateId,
      castingProductId,
      jobId,
      structureNumber,
      contractor,
      project,
      date,
      inspection,
      approvedBy,
      rimElevation,
      effectiveLengthFeet,
      effectiveWidthFeet,
      hasTopSlab,
      hasBaseSlab,
      baseAttached,
      topSlabOpeningLengthInches,
      topSlabOpeningWidthInches,
      topSlabOpeningSide,
      sections,
      openings,
    ],
  );

  const previewMeta: RectSheetPreviewMeta = {
    structureNumber,
    contractor,
    project,
    templateName: template?.name ?? "",
    castingName: casting?.name ?? null,
  };

  const maxPick = parseNum(maxPickWeightLbs);

  function updateOpening(
    id: string,
    patch: Partial<Omit<RectOpeningField, "id">>,
  ) {
    setOpenings((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function updateSection(
    id: string,
    patch: Partial<Omit<RectSectionField, "id">>,
  ) {
    setSections((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payloadJson} />
      {expectedUpdatedAt ? (
        <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Sheet Info">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Template *
                </label>
                <select
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className={structureInputClassName}
                >
                  {templates.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Job
                </label>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className={structureInputClassName}
                >
                  <option value="">— None —</option>
                  {jobs.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Structure #
                </label>
                <input
                  type="text"
                  value={structureNumber}
                  onChange={(e) => setStructureNumber(e.target.value)}
                  placeholder="CB-1"
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Contractor
                </label>
                <input
                  type="text"
                  value={contractor}
                  onChange={(e) => setContractor(e.target.value)}
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Project
                </label>
                <input
                  type="text"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Inspection
                </label>
                <input
                  type="text"
                  value={inspection}
                  onChange={(e) => setInspection(e.target.value)}
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Approved By
                </label>
                <input
                  type="text"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className={structureInputClassName}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Structure">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Inside Length (ft) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={effectiveLengthFeet}
                  disabled={templateSize != null}
                  onChange={(e) => setInsideLengthFeet(e.target.value)}
                  className={structureInputClassName}
                />
                {templateSize ? (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Set by the template.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Inside Width (ft) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={effectiveWidthFeet}
                  disabled={templateSize != null}
                  onChange={(e) => setInsideWidthFeet(e.target.value)}
                  className={structureInputClassName}
                />
                {templateSize ? (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Set by the template.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Rim Elevation *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={rimElevation}
                  onChange={(e) => setRimElevation(e.target.value)}
                  className={structureInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Casting
                </label>
                <select
                  value={castingProductId}
                  onChange={(e) => setCastingProductId(e.target.value)}
                  className={structureInputClassName}
                >
                  <option value="">— None —</option>
                  {castings.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {option.heightFeet != null
                        ? ` (${option.heightFeet}')`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={hasTopSlab}
                    disabled={
                      template != null &&
                      template.topSlabThicknessInches <= 0 &&
                      !hasTopSlab
                    }
                    onChange={(e) => setHasTopSlab(e.target.checked)}
                  />
                  Top slab
                  {template && template.topSlabThicknessInches <= 0 ? (
                    <span className="text-[10px] font-normal text-slate-400">
                      (none on template)
                    </span>
                  ) : null}
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={hasBaseSlab}
                    disabled={
                      template != null &&
                      template.baseSlabThicknessInches <= 0 &&
                      !hasBaseSlab
                    }
                    onChange={(e) => setHasBaseSlab(e.target.checked)}
                  />
                  Base slab
                  {template && template.baseSlabThicknessInches <= 0 ? (
                    <span className="text-[10px] font-normal text-slate-400">
                      (none on template)
                    </span>
                  ) : null}
                </label>
              </div>
              {hasBaseSlab ? (
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={baseAttached}
                      onChange={(e) => setBaseAttached(e.target.checked)}
                    />
                    Base cast attached to bottom section
                  </label>
                </div>
              ) : null}
            </div>

            {hasTopSlab ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Top Slab Opening Length (in)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={topSlabOpeningLengthInches}
                    onChange={(e) =>
                      setTopSlabOpeningLengthInches(e.target.value)
                    }
                    className={structureInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Top Slab Opening Width (in)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={topSlabOpeningWidthInches}
                    onChange={(e) =>
                      setTopSlabOpeningWidthInches(e.target.value)
                    }
                    className={structureInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Opening Touches Wall
                  </label>
                  <select
                    value={topSlabOpeningSide}
                    onChange={(e) =>
                      setTopSlabOpeningSide(e.target.value as RectWall)
                    }
                    className={structureInputClassName}
                  >
                    {WALL_OPTIONS.map((wall) => (
                      <option key={wall} value={wall}>
                        {RECT_WALL_LABELS[wall]} wall
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Pipe Openings"
            action={
              <button
                type="button"
                disabled={openings.length >= RECT_OPENING_TABLE_ROWS}
                title={
                  openings.length >= RECT_OPENING_TABLE_ROWS
                    ? `The printed openings table has ${RECT_OPENING_TABLE_ROWS} rows (A-E).`
                    : undefined
                }
                onClick={() =>
                  setOpenings((current) => [...current, createOpening()])
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Add Opening
              </button>
            }
            noPadding
          >
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>#</th>
                    <th className={tableHeaderCellClassName}>Wall</th>
                    <th className={tableHeaderCellClassName}>Material</th>
                    <th className={tableHeaderCellClassName}>Size (in)</th>
                    <th className={tableHeaderCellClassName}>Invert Elev.</th>
                    <th className={tableHeaderCellClassName}>Placement</th>
                    <th className={tableHeaderCellClassName}>Offset (in)</th>
                    <th className={tableHeaderCellClassName}>Angle</th>
                    <th className={tableHeaderCellClassName}>Width Ovr. (in)</th>
                    <th className={tableHeaderCellClassName}></th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {openings.map((opening, index) => (
                    <tr key={opening.id}>
                      <td className={tableCellClassName}>
                        <input
                          type="text"
                          value={opening.label}
                          onChange={(e) =>
                            updateOpening(opening.id, { label: e.target.value })
                          }
                          placeholder={String.fromCharCode(65 + index)}
                          className={`${structureTableInputClassName} w-10`}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <select
                          value={opening.wall}
                          onChange={(e) =>
                            updateOpening(opening.id, {
                              wall: e.target.value as RectWall | "",
                            })
                          }
                          className={structureTableInputClassName}
                        >
                          {WALL_OPTIONS.map((wall) => (
                            <option key={wall} value={wall}>
                              {RECT_WALL_LABELS[wall]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          type="text"
                          list="rect-opening-materials"
                          value={opening.pipeMaterial}
                          onChange={(e) =>
                            updateOpening(opening.id, {
                              pipeMaterial: e.target.value,
                            })
                          }
                          placeholder="PVC SDR35"
                          className={structureTableInputClassName}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          list={`rect-sizes-${index}`}
                          value={opening.pipeSizeInches}
                          onChange={(e) =>
                            updateOpening(opening.id, {
                              pipeSizeInches: e.target.value,
                            })
                          }
                          className={`${structureTableInputClassName} w-16`}
                        />
                        <datalist id={`rect-sizes-${index}`}>
                          {sizesForMaterial(opening.pipeMaterial).map((size) => (
                            <option key={size} value={size} />
                          ))}
                        </datalist>
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          type="number"
                          step="0.01"
                          value={opening.invertElevation}
                          onChange={(e) =>
                            updateOpening(opening.id, {
                              invertElevation: e.target.value,
                            })
                          }
                          className={`${structureTableInputClassName} w-20`}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <select
                          value={opening.placement}
                          onChange={(e) =>
                            updateOpening(opening.id, {
                              placement: e.target
                                .value as RectOpeningPlacement,
                            })
                          }
                          className={structureTableInputClassName}
                        >
                          <option value="CENTERED">Centered</option>
                          <option value="FROM_LEFT">From left</option>
                          <option value="FROM_RIGHT">From right</option>
                          <option value="TOUCH_LEFT">Touch left</option>
                          <option value="TOUCH_RIGHT">Touch right</option>
                        </select>
                      </td>
                      <td className={tableCellClassName}>
                        {opening.placement === "FROM_LEFT" ||
                        opening.placement === "FROM_RIGHT" ? (
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={opening.offsetInches}
                            onChange={(e) =>
                              updateOpening(opening.id, {
                                offsetInches: e.target.value,
                              })
                            }
                            className={`${structureTableInputClassName} w-16`}
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          type="number"
                          step="1"
                          value={opening.angle}
                          onChange={(e) =>
                            updateOpening(opening.id, { angle: e.target.value })
                          }
                          placeholder="0"
                          className={`${structureTableInputClassName} w-14`}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={opening.widthOverrideInches}
                          onChange={(e) =>
                            updateOpening(opening.id, {
                              widthOverrideInches: e.target.value,
                            })
                          }
                          placeholder="skew"
                          className={`${structureTableInputClassName} w-16`}
                        />
                      </td>
                      <td className={`${tableCellClassName} py-1.5 text-right`}>
                        {openings.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenings((current) =>
                                current.filter((row) => row.id !== opening.id),
                              )
                            }
                            className="text-[11px] font-medium text-rose-600 hover:text-rose-800"
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="rect-opening-materials">
                {materials.map((material) => (
                  <option key={material} value={material} />
                ))}
              </datalist>
            </div>
          </SectionCard>

          <SectionCard
            title="Sections"
            description="Leave empty for a single pour. Enter split heights bottom-to-top (driven by the contractor's max pick weight)."
            action={
              <button
                type="button"
                onClick={() =>
                  setSections((current) =>
                    current.length === 0
                      ? [createSection(), createSection()]
                      : [...current, createSection()],
                  )
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                {sections.length === 0 ? "Split Sections" : "Add Section"}
              </button>
            }
          >
            <div className="mb-3 max-w-[200px]">
              <label className="block text-xs font-medium text-slate-700">
                Max Pick Weight (lbs)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={maxPickWeightLbs}
                onChange={(e) => setMaxPickWeightLbs(e.target.value)}
                placeholder="12000"
                className={structureInputClassName}
              />
            </div>

            {sections.length === 0 ? (
              <p className="text-xs text-slate-500">
                Single pour ({result ? formatPounds(result.weights.sections[0] ?? null) : "—"}
                {result?.weights.heaviestLbs != null &&
                maxPick != null &&
                result.weights.heaviestLbs > maxPick
                  ? " — over the max pick weight, split the structure"
                  : ""}
                ).
              </p>
            ) : (
              <div className="space-y-2">
                {sections.map((section, index) => {
                  const weight = result?.weights.sections[index] ?? null;
                  const over =
                    weight != null && maxPick != null && weight > maxPick;
                  return (
                    <div
                      key={section.id}
                      className="flex flex-wrap items-center gap-3"
                    >
                      <span className="w-20 text-xs font-medium text-slate-600">
                        Section {index + 1}
                        {index === 0 ? " (bottom)" : ""}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={section.heightFeet}
                        onChange={(e) =>
                          updateSection(section.id, {
                            heightFeet: e.target.value,
                          })
                        }
                        placeholder="ft"
                        className={`${structureTableInputClassName} w-24`}
                      />
                      {index < sections.length - 1 ? (
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={section.topKey}
                            onChange={(e) =>
                              updateSection(section.id, {
                                topKey: e.target.checked,
                              })
                            }
                          />
                          Keyed joint above
                        </label>
                      ) : null}
                      <span
                        className={`text-[11px] font-medium ${over ? "text-rose-600" : "text-slate-500"}`}
                      >
                        {formatPounds(weight)}
                        {over ? " — over max pick" : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSections((current) =>
                            current.filter((row) => row.id !== section.id),
                          )
                        }
                        className="text-[11px] font-medium text-rose-600 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                {result && result.wallHeightFeet > 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Wall height to fill: {result.wallHeightFeet.toFixed(2)}&apos;
                  </p>
                ) : null}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          {result ? (
            <RectSheetPreview result={result} meta={previewMeta} />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Select a rectangular template to start.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <Link
          href="/drill-sheets"
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
