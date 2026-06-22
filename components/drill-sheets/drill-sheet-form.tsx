"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  structureInputClassName,
  structureTableInputClassName,
} from "@/components/structures/structure-utils";
import {
  DrillSheetPreview,
  type DrillSheetPreviewMeta,
} from "@/components/drill-sheets/drill-sheet-preview";
import {
  computeDrillSheet,
  type DrillSheetInput,
} from "@/lib/drill-sheet";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";

export type DrillSheetTemplateOption = {
  id: string;
  name: string;
  agencyStandard: string | null;
  minimumBrickFeet: number;
  keyClearanceFeet: number;
  bootSizes: { pipeDiameterInches: number; holeDiameterInches: number }[];
  diameters: {
    id: string;
    insideDiameterFeet: number;
    moldMaxHeightFeet: number;
    topSlabHeightWithKeyFeet: number | null;
    topSlabHeightNoKeyFeet: number | null;
    sections: {
      role: "BASE" | "RISER";
      heightFeet: number;
      label: string | null;
    }[];
  }[];
};

export type DrillSheetCastingOption = {
  id: string;
  name: string;
  heightFeet: number | null;
};

export type DrillSheetJobOption = {
  id: string;
  label: string;
};

type OpeningField = {
  id: string;
  label: string;
  pipeType: string;
  pipeDiameterInches: string;
  invertElevation: string;
  hasBoot: boolean;
  angle: string;
};

type DrillSheetFormProps = {
  action: (formData: FormData) => Promise<void>;
  templates: DrillSheetTemplateOption[];
  castings: DrillSheetCastingOption[];
  jobs: DrillSheetJobOption[];
  initialValues?: DrillSheetFormValues;
  cancelHref?: string;
  submitLabel?: string;
};

function uid() {
  return crypto.randomUUID();
}

function parseNum(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function createOpening(label: string): OpeningField {
  return {
    id: uid(),
    label,
    pipeType: "",
    pipeDiameterInches: "",
    invertElevation: "",
    hasBoot: true,
    angle: "",
  };
}

function initialOpenings(
  initialValues: DrillSheetFormValues | undefined,
): OpeningField[] {
  if (initialValues && initialValues.openings.length > 0) {
    return initialValues.openings.map((opening) => ({ id: uid(), ...opening }));
  }
  return [createOpening("A"), createOpening("B")];
}

export function DrillSheetForm({
  action,
  templates,
  castings,
  jobs,
  initialValues,
  cancelHref = "/drill-sheets",
  submitLabel = "Save Drill Sheet",
}: DrillSheetFormProps) {
  const [templateId, setTemplateId] = useState(
    initialValues?.templateId ?? templates[0]?.id ?? "",
  );
  const selectedTemplate = templates.find(
    (template) => template.id === templateId,
  );
  const [diameterId, setDiameterId] = useState(
    initialValues?.diameterId ?? selectedTemplate?.diameters[0]?.id ?? "",
  );
  const [castingId, setCastingId] = useState(
    initialValues?.castingProductId ?? "",
  );
  const [jobId, setJobId] = useState(initialValues?.jobId ?? "");
  const [manholeNumber, setManholeNumber] = useState(
    initialValues?.manholeNumber ?? "",
  );
  const [contractor, setContractor] = useState(initialValues?.contractor ?? "");
  const [project, setProject] = useState(initialValues?.project ?? "");
  const [date, setDate] = useState(initialValues?.date ?? "");
  const [hasSteps, setHasSteps] = useState(initialValues?.hasSteps ?? false);
  const [rimElevation, setRimElevation] = useState(
    initialValues?.rimElevation ?? "",
  );
  const [hasKeyOverride, setHasKeyOverride] = useState<"auto" | "yes" | "no">(
    initialValues?.hasKeyOverride ?? "auto",
  );
  const [brickOverride, setBrickOverride] = useState(
    initialValues?.brickOverride ?? "",
  );
  const [openings, setOpenings] = useState<OpeningField[]>(() =>
    initialOpenings(initialValues),
  );

  function handleTemplateChange(nextId: string) {
    setTemplateId(nextId);
    const nextTemplate = templates.find((template) => template.id === nextId);
    setDiameterId(nextTemplate?.diameters[0]?.id ?? "");
  }

  const selectedDiameter = selectedTemplate?.diameters.find(
    (diameter) => diameter.id === diameterId,
  );
  const selectedCasting = castings.find((casting) => casting.id === castingId);

  const lowInvertId = useMemo(() => {
    let id: string | null = null;
    let low: number | null = null;
    for (const opening of openings) {
      const invert = parseNum(opening.invertElevation);
      if (invert != null && (low === null || invert < low)) {
        low = invert;
        id = opening.id;
      }
    }
    return id;
  }, [openings]);

  const result = useMemo(() => {
    if (!selectedTemplate || !selectedDiameter) {
      return null;
    }
    const input: DrillSheetInput = {
      rimElevation: parseNum(rimElevation),
      castingHeightFeet: selectedCasting?.heightFeet ?? 0,
      diameter: {
        insideDiameterFeet: selectedDiameter.insideDiameterFeet,
        moldMaxHeightFeet: selectedDiameter.moldMaxHeightFeet,
        topSlabHeightWithKeyFeet: selectedDiameter.topSlabHeightWithKeyFeet,
        topSlabHeightNoKeyFeet: selectedDiameter.topSlabHeightNoKeyFeet,
        sections: selectedDiameter.sections,
      },
      template: {
        minimumBrickFeet: selectedTemplate.minimumBrickFeet,
        keyClearanceFeet: selectedTemplate.keyClearanceFeet,
        bootSizes: selectedTemplate.bootSizes,
      },
      openings: openings.map((opening) => ({
        label: opening.label,
        pipeType: opening.pipeType,
        pipeDiameterInches: parseNum(opening.pipeDiameterInches),
        invertElevation: parseNum(opening.invertElevation),
        hasBoot: opening.hasBoot,
        angleDegrees: opening.id === lowInvertId ? 0 : parseNum(opening.angle),
      })),
      hasKeyOverride:
        hasKeyOverride === "auto" ? null : hasKeyOverride === "yes",
      brickAdjustmentOverrideFeet: parseNum(brickOverride),
    };
    return computeDrillSheet(input);
  }, [
    selectedTemplate,
    selectedDiameter,
    selectedCasting,
    rimElevation,
    openings,
    lowInvertId,
    hasKeyOverride,
    brickOverride,
  ]);

  const payloadJson = useMemo(() => {
    return JSON.stringify({
      templateId,
      diameterId,
      castingProductId: castingId || null,
      jobId: jobId || null,
      manholeNumber,
      contractor,
      project,
      date,
      hasSteps,
      rimElevation,
      hasKeyOverride: hasKeyOverride === "auto" ? null : hasKeyOverride === "yes",
      brickAdjustmentOverrideFeet: brickOverride,
      openings: openings.map((opening) => ({
        label: opening.label,
        pipeType: opening.pipeType,
        pipeDiameterInches: opening.pipeDiameterInches,
        invertElevation: opening.invertElevation,
        hasBoot: opening.hasBoot,
        angle: opening.id === lowInvertId ? "0" : opening.angle,
      })),
    });
  }, [
    templateId,
    diameterId,
    castingId,
    jobId,
    manholeNumber,
    contractor,
    project,
    date,
    hasSteps,
    rimElevation,
    hasKeyOverride,
    brickOverride,
    openings,
    lowInvertId,
  ]);

  const previewMeta: DrillSheetPreviewMeta = {
    templateName: selectedTemplate?.name ?? "",
    manholeNumber,
    contractor,
    project,
    date,
    castingName: selectedCasting?.name ?? "",
    insideDiameterFeet: selectedDiameter?.insideDiameterFeet ?? null,
    hasSteps,
  };

  function updateOpening(
    id: string,
    field: keyof Omit<OpeningField, "id">,
    value: string | boolean,
  ) {
    setOpenings((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  const canSubmit = Boolean(templateId && diameterId);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payloadJson} />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <SectionCard title="Sheet Details">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Template *
                  </label>
                  <select
                    value={templateId}
                    onChange={(event) => handleTemplateChange(event.target.value)}
                    className={structureInputClassName}
                  >
                    {templates.length === 0 ? (
                      <option value="">No templates available</option>
                    ) : null}
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Diameter *
                  </label>
                  <select
                    value={diameterId}
                    onChange={(event) => setDiameterId(event.target.value)}
                    className={structureInputClassName}
                  >
                    {(selectedTemplate?.diameters ?? []).map((diameter) => (
                      <option key={diameter.id} value={diameter.id}>
                        {diameter.insideDiameterFeet}&apos; Ø
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Casting
                  </label>
                  <select
                    value={castingId}
                    onChange={(event) => setCastingId(event.target.value)}
                    className={structureInputClassName}
                  >
                    <option value="">None</option>
                    {castings.map((casting) => (
                      <option key={casting.id} value={casting.id}>
                        {casting.name}
                        {casting.heightFeet != null
                          ? ` (${casting.heightFeet}')`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Job (optional)
                  </label>
                  <select
                    value={jobId}
                    onChange={(event) => setJobId(event.target.value)}
                    className={structureInputClassName}
                  >
                    <option value="">Not linked</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Manhole #
                  </label>
                  <input
                    type="text"
                    value={manholeNumber}
                    onChange={(event) => setManholeNumber(event.target.value)}
                    placeholder="SMH-3"
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
                    onChange={(event) => setContractor(event.target.value)}
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
                    onChange={(event) => setDate(event.target.value)}
                    className={structureInputClassName}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Project
                  </label>
                  <input
                    type="text"
                    value={project}
                    onChange={(event) => setProject(event.target.value)}
                    className={structureInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Steps
                  </label>
                  <select
                    value={hasSteps ? "yes" : "no"}
                    onChange={(event) =>
                      setHasSteps(event.target.value === "yes")
                    }
                    className={structureInputClassName}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Rim Elevation
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rimElevation}
                    onChange={(event) => setRimElevation(event.target.value)}
                    placeholder="89.68"
                    className={structureInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Key
                  </label>
                  <select
                    value={hasKeyOverride}
                    onChange={(event) =>
                      setHasKeyOverride(
                        event.target.value as "auto" | "yes" | "no",
                      )
                    }
                    className={structureInputClassName}
                  >
                    <option value="auto">Auto (from clearance)</option>
                    <option value="yes">Force Key</option>
                    <option value="no">Force No Key</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Brick Override (ft)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={brickOverride}
                    onChange={(event) => setBrickOverride(event.target.value)}
                    placeholder="auto"
                    className={structureInputClassName}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Pipe Schedule"
            action={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenings((rows) => [
                      ...rows,
                      createOpening(String.fromCharCode(65 + rows.length)),
                    ])
                  }
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Add Pipe
                </button>
              </div>
            }
            noPadding
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Dia (in)</th>
                    <th className="px-3 py-2 font-semibold">Invert</th>
                    <th className="px-3 py-2 font-semibold">Boot</th>
                    <th className="px-3 py-2 font-semibold">Angle&deg;</th>
                    <th className="px-3 py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openings.map((opening) => (
                    <tr key={opening.id}>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={opening.label}
                          onChange={(event) =>
                            updateOpening(opening.id, "label", event.target.value)
                          }
                          className={`${structureTableInputClassName} max-w-[48px]`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={opening.pipeType}
                          onChange={(event) =>
                            updateOpening(
                              opening.id,
                              "pipeType",
                              event.target.value,
                            )
                          }
                          placeholder="PVC"
                          className={structureTableInputClassName}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={opening.pipeDiameterInches}
                          onChange={(event) =>
                            updateOpening(
                              opening.id,
                              "pipeDiameterInches",
                              event.target.value,
                            )
                          }
                          placeholder="8"
                          className={structureTableInputClassName}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={opening.invertElevation}
                          onChange={(event) =>
                            updateOpening(
                              opening.id,
                              "invertElevation",
                              event.target.value,
                            )
                          }
                          placeholder="76.70"
                          className={structureTableInputClassName}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={opening.hasBoot ? "yes" : "no"}
                          onChange={(event) =>
                            updateOpening(
                              opening.id,
                              "hasBoot",
                              event.target.value === "yes",
                            )
                          }
                          className={structureTableInputClassName}
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        {opening.id === lowInvertId ? (
                          <span
                            className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"
                            title="Lowest invert is always drawn pointing up"
                          >
                            Up (0&deg;)
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="1"
                            value={opening.angle}
                            onChange={(event) =>
                              updateOpening(
                                opening.id,
                                "angle",
                                event.target.value,
                              )
                            }
                            placeholder="90"
                            className={structureTableInputClassName}
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {openings.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenings((rows) =>
                                rows.filter((row) => row.id !== opening.id),
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
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Drill Sheet Preview">
            {result ? (
              <DrillSheetPreview meta={previewMeta} result={result} />
            ) : (
              <p className="text-xs text-slate-500">
                Select a template and diameter to see the calculation.
              </p>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
