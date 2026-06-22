"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  structureInputClassName,
  structureTableInputClassName,
} from "@/components/structures/structure-utils";

type SectionRole = "BASE" | "RISER";

type SectionField = {
  id: string;
  role: SectionRole;
  heightFeet: string;
  label: string;
};

type DiameterField = {
  id: string;
  insideDiameterFeet: string;
  moldMaxHeightFeet: string;
  topSlabHeightWithKeyFeet: string;
  topSlabHeightNoKeyFeet: string;
  sections: SectionField[];
};

type BootField = {
  id: string;
  pipeDiameterInches: string;
  holeDiameterInches: string;
};

export type StructureTemplateFormValue = {
  name: string;
  agencyStandard: string;
  shape: "CIRCULAR" | "RECTANGULAR";
  minimumBrickFeet: string;
  keyClearanceFeet: string;
  status: "ACTIVE" | "INACTIVE";
  notes: string;
  diameters: DiameterField[];
  bootSizes: BootField[];
};

type StructureTemplateFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  submitLabel: string;
  defaultValue?: StructureTemplateFormValue;
};

function uid() {
  return crypto.randomUUID();
}

function createSection(role: SectionRole): SectionField {
  return { id: uid(), role, heightFeet: "", label: "" };
}

function createDiameter(): DiameterField {
  return {
    id: uid(),
    insideDiameterFeet: "",
    moldMaxHeightFeet: "",
    topSlabHeightWithKeyFeet: "",
    topSlabHeightNoKeyFeet: "",
    sections: [createSection("BASE"), createSection("RISER")],
  };
}

function createBoot(): BootField {
  return { id: uid(), pipeDiameterInches: "", holeDiameterInches: "" };
}

const defaultFormValue: StructureTemplateFormValue = {
  name: "",
  agencyStandard: "",
  shape: "CIRCULAR",
  minimumBrickFeet: "0.3333",
  keyClearanceFeet: "0.3333",
  status: "ACTIVE",
  notes: "",
  diameters: [createDiameter()],
  bootSizes: [createBoot()],
};

export function StructureTemplateForm({
  action,
  cancelHref,
  submitLabel,
  defaultValue,
}: StructureTemplateFormProps) {
  const initial = defaultValue ?? defaultFormValue;
  const [name, setName] = useState(initial.name);
  const [agencyStandard, setAgencyStandard] = useState(initial.agencyStandard);
  const [shape, setShape] = useState(initial.shape);
  const [minimumBrickFeet, setMinimumBrickFeet] = useState(
    initial.minimumBrickFeet,
  );
  const [keyClearanceFeet, setKeyClearanceFeet] = useState(
    initial.keyClearanceFeet,
  );
  const [status, setStatus] = useState(initial.status);
  const [notes, setNotes] = useState(initial.notes);
  const [diameters, setDiameters] = useState<DiameterField[]>(
    initial.diameters.length > 0 ? initial.diameters : [createDiameter()],
  );
  const [bootSizes, setBootSizes] = useState<BootField[]>(
    initial.bootSizes.length > 0 ? initial.bootSizes : [createBoot()],
  );

  const payloadJson = useMemo(() => {
    return JSON.stringify({
      name,
      agencyStandard,
      shape,
      minimumBrickFeet,
      keyClearanceFeet,
      status,
      notes,
      diameters: diameters.map((diameter) => ({
        insideDiameterFeet: diameter.insideDiameterFeet,
        moldMaxHeightFeet: diameter.moldMaxHeightFeet,
        topSlabHeightWithKeyFeet: diameter.topSlabHeightWithKeyFeet,
        topSlabHeightNoKeyFeet: diameter.topSlabHeightNoKeyFeet,
        sections: diameter.sections.map((section) => ({
          role: section.role,
          heightFeet: section.heightFeet,
          label: section.label,
        })),
      })),
      bootSizes: bootSizes.map((boot) => ({
        pipeDiameterInches: boot.pipeDiameterInches,
        holeDiameterInches: boot.holeDiameterInches,
      })),
    });
  }, [
    name,
    agencyStandard,
    shape,
    minimumBrickFeet,
    keyClearanceFeet,
    status,
    notes,
    diameters,
    bootSizes,
  ]);

  function updateDiameter(
    id: string,
    field: keyof Omit<DiameterField, "id" | "sections">,
    value: string,
  ) {
    setDiameters((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function updateSection(
    diameterId: string,
    sectionId: string,
    field: keyof Omit<SectionField, "id">,
    value: string,
  ) {
    setDiameters((rows) =>
      rows.map((row) =>
        row.id === diameterId
          ? {
              ...row,
              sections: row.sections.map((section) =>
                section.id === sectionId
                  ? { ...section, [field]: value }
                  : section,
              ),
            }
          : row,
      ),
    );
  }

  function addSection(diameterId: string, role: SectionRole) {
    setDiameters((rows) =>
      rows.map((row) =>
        row.id === diameterId
          ? { ...row, sections: [...row.sections, createSection(role)] }
          : row,
      ),
    );
  }

  function removeSection(diameterId: string, sectionId: string) {
    setDiameters((rows) =>
      rows.map((row) =>
        row.id === diameterId
          ? {
              ...row,
              sections: row.sections.filter(
                (section) => section.id !== sectionId,
              ),
            }
          : row,
      ),
    );
  }

  function updateBoot(id: string, field: keyof Omit<BootField, "id">, value: string) {
    setBootSizes((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payloadJson} />

      <SectionCard title="Template Details">
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
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
                onChange={(event) => setAgencyStandard(event.target.value)}
                placeholder="Suffolk County DPW"
                className={structureInputClassName}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Shape
              </label>
              <select
                value={shape}
                onChange={(event) =>
                  setShape(event.target.value as "CIRCULAR" | "RECTANGULAR")
                }
                className={structureInputClassName}
              >
                <option value="CIRCULAR">Circular</option>
                <option value="RECTANGULAR" disabled>
                  Rectangular (coming soon)
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Minimum Brick (ft)
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={minimumBrickFeet}
                onChange={(event) => setMinimumBrickFeet(event.target.value)}
                className={structureInputClassName}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                4&quot; = 0.3333&apos;
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Key Clearance (ft)
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={keyClearanceFeet}
                onChange={(event) => setKeyClearanceFeet(event.target.value)}
                className={structureInputClassName}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Min from pipe hole to keyway.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Status
              </label>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "ACTIVE" | "INACTIVE")
                }
                className={structureInputClassName}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={structureInputClassName}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Diameters"
        description="Each diameter has a mold max height, top-slab heights, and the standard base/riser pours the workbook can stack."
        action={
          <button
            type="button"
            onClick={() => setDiameters((rows) => [...rows, createDiameter()])}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add Diameter
          </button>
        }
      >
        <div className="space-y-5">
          {diameters.map((diameter, index) => (
            <div
              key={diameter.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-700">
                  Diameter #{index + 1}
                </h4>
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
                ) : null}
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Inside Diameter (ft) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={diameter.insideDiameterFeet}
                    onChange={(event) =>
                      updateDiameter(
                        diameter.id,
                        "insideDiameterFeet",
                        event.target.value,
                      )
                    }
                    placeholder="4.5"
                    className={structureInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Mold Max Height (ft) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={diameter.moldMaxHeightFeet}
                    onChange={(event) =>
                      updateDiameter(
                        diameter.id,
                        "moldMaxHeightFeet",
                        event.target.value,
                      )
                    }
                    placeholder="6"
                    className={structureInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Top Slab w/ Key (ft)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={diameter.topSlabHeightWithKeyFeet}
                    onChange={(event) =>
                      updateDiameter(
                        diameter.id,
                        "topSlabHeightWithKeyFeet",
                        event.target.value,
                      )
                    }
                    placeholder="1.08"
                    className={structureInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Top Slab No Key (ft)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={diameter.topSlabHeightNoKeyFeet}
                    onChange={(event) =>
                      updateDiameter(
                        diameter.id,
                        "topSlabHeightNoKeyFeet",
                        event.target.value,
                      )
                    }
                    placeholder="1.33"
                    className={structureInputClassName}
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Standard Sections
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => addSection(diameter.id, "BASE")}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add Base
                    </button>
                    <button
                      type="button"
                      onClick={() => addSection(diameter.id, "RISER")}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add Riser
                    </button>
                  </div>
                </div>

                <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2 font-semibold">Role</th>
                        <th className="px-3 py-2 font-semibold">Height (ft)</th>
                        <th className="px-3 py-2 font-semibold">Label</th>
                        <th className="px-3 py-2 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {diameter.sections.map((section) => (
                        <tr key={section.id}>
                          <td className="px-3 py-1.5">
                            <select
                              value={section.role}
                              onChange={(event) =>
                                updateSection(
                                  diameter.id,
                                  section.id,
                                  "role",
                                  event.target.value,
                                )
                              }
                              className={structureTableInputClassName}
                            >
                              <option value="BASE">Base</option>
                              <option value="RISER">Riser</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={section.heightFeet}
                              onChange={(event) =>
                                updateSection(
                                  diameter.id,
                                  section.id,
                                  "heightFeet",
                                  event.target.value,
                                )
                              }
                              placeholder="6"
                              className={structureTableInputClassName}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={section.label}
                              onChange={(event) =>
                                updateSection(
                                  diameter.id,
                                  section.id,
                                  "label",
                                  event.target.value,
                                )
                              }
                              placeholder="6'-0&quot; base"
                              className={structureTableInputClassName}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                removeSection(diameter.id, section.id)
                              }
                              className="text-[11px] font-medium text-rose-600 hover:text-rose-800"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Boot / Hole Sizes"
        description="Pipe diameter to boot hole diameter. Drives the sump = (hole - pipe) / 2."
        action={
          <button
            type="button"
            onClick={() => setBootSizes((rows) => [...rows, createBoot()])}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add Boot Size
          </button>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Pipe Diameter (in)</th>
                <th className="px-4 py-2.5 font-semibold">Hole Diameter (in)</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bootSizes.map((boot) => (
                <tr key={boot.id}>
                  <td className="px-4 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={boot.pipeDiameterInches}
                      onChange={(event) =>
                        updateBoot(
                          boot.id,
                          "pipeDiameterInches",
                          event.target.value,
                        )
                      }
                      placeholder="8"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-4 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={boot.holeDiameterInches}
                      onChange={(event) =>
                        updateBoot(
                          boot.id,
                          "holeDiameterInches",
                          event.target.value,
                        )
                      }
                      placeholder="12"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    {bootSizes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setBootSizes((rows) =>
                            rows.filter((row) => row.id !== boot.id),
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
