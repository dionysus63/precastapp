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
  type PipeConnectionType,
} from "@/lib/drill-sheet";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";

export type DrillSheetTemplateOption = {
  id: string;
  name: string;
  agencyStandard: string | null;
  wallThicknessInches: number;
  baseSlabThicknessInches: number;
  topSlabThicknessInches: number;
  minimumBrickInches: number;
  connectionType: PipeConnectionType;
  sumpMode: "DEFAULT" | "FIXED";
  sumpFixedInches: number | null;
  openingToJointMinTopInches: number;
  openingToJointMinBottomInches: number;
  defaultCastingProductId: string | null;
  defaultCastingHeightFeet: number | null;
  diameters: { id: string; insideDiameterFeet: number }[];
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

type PipeOpeningSizeOption = {
  pipeMaterial: string;
  pipeSizeInches: number;
  pipeType: string;
  holeDiameterInches: number;
  bootModel: string | null;
  pricePerBoot: number | null;
};

type DiameterConfigOption = {
  insideDiameterFeet: number;
  maxBaseHeightFeet: number;
  maxRiserHeightFeet: number;
  keyHeightFeet: number;
  wallPricePerFoot: number;
  basePrice: number;
};

type OpeningField = {
  id: string;
  label: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  pipeType: string;
  invertElevation: string;
  angle: string;
  connectionType: PipeConnectionType | "";
};

type DrillSheetFormProps = {
  action: (formData: FormData) => Promise<void>;
  templates: DrillSheetTemplateOption[];
  castings: DrillSheetCastingOption[];
  jobs: DrillSheetJobOption[];
  pipeOpeningSizes: PipeOpeningSizeOption[];
  diameterConfigs: DiameterConfigOption[];
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
    pipeMaterial: "",
    pipeSizeInches: "",
    pipeType: "",
    invertElevation: "",
    angle: "",
    connectionType: "",
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

const connectionOptions: { value: PipeConnectionType | ""; label: string }[] = [
  { value: "", label: "Template default" },
  { value: "KOR_N_SEAL", label: "Kor-N-Seal Boot" },
  { value: "CAST_IN", label: "Cast-In" },
  { value: "GROUTED", label: "Grouted" },
  { value: "OTHER", label: "Other" },
];

export function DrillSheetForm({
  action,
  templates,
  castings,
  jobs,
  pipeOpeningSizes,
  diameterConfigs,
  initialValues,
  cancelHref = "/drill-sheets",
  submitLabel = "Save Drill Sheet",
}: DrillSheetFormProps) {
  const [templateId, setTemplateId] = useState(
    initialValues?.templateId ?? templates[0]?.id ?? "",
  );
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const [diameterId, setDiameterId] = useState(
    initialValues?.diameterId ?? selectedTemplate?.diameters[0]?.id ?? "",
  );
  const [castingId, setCastingId] = useState(
    initialValues?.castingProductId ??
      selectedTemplate?.defaultCastingProductId ??
      "",
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
  const [openings, setOpenings] = useState<OpeningField[]>(() =>
    initialOpenings(initialValues),
  );

  const selectedDiameter = selectedTemplate?.diameters.find(
    (d) => d.id === diameterId,
  );
  const diameterConfig = diameterConfigs.find(
    (config) =>
      selectedDiameter &&
      Math.abs(config.insideDiameterFeet - selectedDiameter.insideDiameterFeet) <
        1e-6,
  );

  const selectedCasting = castings.find((c) => c.id === castingId);
  const castingHeightFeet =
    selectedCasting?.heightFeet ??
    selectedTemplate?.defaultCastingHeightFeet ??
    0;

  function handleTemplateChange(nextId: string) {
    setTemplateId(nextId);
    const nextTemplate = templates.find((t) => t.id === nextId);
    setDiameterId(nextTemplate?.diameters[0]?.id ?? "");
    if (!castingId && nextTemplate?.defaultCastingProductId) {
      setCastingId(nextTemplate.defaultCastingProductId);
    }
  }

  const payloadJson = useMemo(
    () =>
      JSON.stringify({
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
        openings: openings.map((o) => ({
          label: o.label,
          pipeMaterial: o.pipeMaterial,
          pipeSizeInches: o.pipeSizeInches,
          pipeType: o.pipeType,
          invertElevation: o.invertElevation,
          angle: o.angle,
          connectionType: o.connectionType,
        })),
      }),
    [
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
      openings,
    ],
  );

  const previewResult = useMemo(() => {
    if (!selectedTemplate || !selectedDiameter || !diameterConfig) {
      return null;
    }
    const input: DrillSheetInput = {
      rimElevation: parseNum(rimElevation),
      castingHeightFeet,
      diameter: diameterConfig,
      template: {
        wallThicknessInches: selectedTemplate.wallThicknessInches,
        baseSlabThicknessInches: selectedTemplate.baseSlabThicknessInches,
        topSlabThicknessInches: selectedTemplate.topSlabThicknessInches,
        minimumBrickInches: selectedTemplate.minimumBrickInches,
        connectionType: selectedTemplate.connectionType,
        sumpMode: selectedTemplate.sumpMode,
        sumpFixedInches: selectedTemplate.sumpFixedInches,
        openingToJointMinTopInches: selectedTemplate.openingToJointMinTopInches,
        openingToJointMinBottomInches:
          selectedTemplate.openingToJointMinBottomInches,
      },
      pipeOpeningSizes,
      openings: openings.map((o) => ({
        label: o.label,
        pipeMaterial: o.pipeMaterial,
        pipeSizeInches: parseNum(o.pipeSizeInches),
        pipeType: o.pipeType,
        invertElevation: parseNum(o.invertElevation),
        angleDegrees: parseNum(o.angle),
        connectionType: o.connectionType || null,
      })),
    };
    return computeDrillSheet(input);
  }, [
    selectedTemplate,
    selectedDiameter,
    diameterConfig,
    rimElevation,
    castingHeightFeet,
    pipeOpeningSizes,
    openings,
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
    value: string,
  ) {
    setOpenings((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  const materialOptions = [
    ...new Set(pipeOpeningSizes.map((e) => e.pipeMaterial)),
  ];
  const typeOptions = [...new Set(pipeOpeningSizes.map((e) => e.pipeType))];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payloadJson} />

      <SectionCard title="Structure Setup">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Template *
            </label>
            <select
              required
              value={templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className={structureInputClassName}
            >
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
              required
              value={diameterId}
              onChange={(e) => setDiameterId(e.target.value)}
              className={structureInputClassName}
            >
              {selectedTemplate?.diameters.map((diameter) => (
                <option key={diameter.id} value={diameter.id}>
                  {diameter.insideDiameterFeet}&apos; ID
                </option>
              ))}
            </select>
            {!diameterConfig ? (
              <p className="mt-1 text-[11px] text-amber-700">
                No diameter config in Settings for this size.
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Casting
            </label>
            <select
              value={castingId}
              onChange={(e) => setCastingId(e.target.value)}
              className={structureInputClassName}
            >
              <option value="">— Select —</option>
              {castings.map((casting) => (
                <option key={casting.id} value={casting.id}>
                  {casting.name}
                  {casting.heightFeet != null ? ` (${casting.heightFeet}')` : ""}
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
              onChange={(e) => setJobId(e.target.value)}
              className={structureInputClassName}
            >
              <option value="">— None —</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.label}
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
              value={manholeNumber}
              onChange={(e) => setManholeNumber(e.target.value)}
              className={structureInputClassName}
            />
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
        </div>
      </SectionCard>

      <SectionCard title="Project Info">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={structureInputClassName}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={hasSteps}
                onChange={(e) => setHasSteps(e.target.checked)}
              />
              Has steps
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Pipe Penetrations"
        description="Enter invert elevation, pipe size, material, type, and angle for each opening."
        action={
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
            Add Opening
          </button>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">Label</th>
                <th className="px-3 py-2 font-semibold">Invert</th>
                <th className="px-3 py-2 font-semibold">Size (in)</th>
                <th className="px-3 py-2 font-semibold">Material</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Angle</th>
                <th className="px-3 py-2 font-semibold">Connection</th>
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
                      onChange={(e) =>
                        updateOpening(opening.id, "label", e.target.value)
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={opening.invertElevation}
                      onChange={(e) =>
                        updateOpening(opening.id, "invertElevation", e.target.value)
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={opening.pipeSizeInches}
                      onChange={(e) =>
                        updateOpening(opening.id, "pipeSizeInches", e.target.value)
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      list="pipe-materials"
                      value={opening.pipeMaterial}
                      onChange={(e) =>
                        updateOpening(opening.id, "pipeMaterial", e.target.value)
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      list="pipe-types"
                      value={opening.pipeType}
                      onChange={(e) =>
                        updateOpening(opening.id, "pipeType", e.target.value)
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="1"
                      value={opening.angle}
                      onChange={(e) =>
                        updateOpening(opening.id, "angle", e.target.value)
                      }
                      placeholder="90"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={opening.connectionType}
                      onChange={(e) =>
                        updateOpening(
                          opening.id,
                          "connectionType",
                          e.target.value,
                        )
                      }
                      className={structureTableInputClassName}
                    >
                      {connectionOptions.map((opt) => (
                        <option key={opt.value || "default"} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
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
        <datalist id="pipe-materials">
          {materialOptions.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <datalist id="pipe-types">
          {typeOptions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </SectionCard>

      {previewResult ? (
        <SectionCard title="Live Preview">
          <DrillSheetPreview meta={previewMeta} result={previewResult} />
        </SectionCard>
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
          disabled={!diameterConfig}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
