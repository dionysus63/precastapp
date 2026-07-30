"use client";

import { useMemo, useRef, useState } from "react";
import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import type {
  DrillSheetFormOpening,
  DrillSheetFormValues,
} from "@/lib/drill-sheet-detail";
import type { CircularBulkEditRow } from "@/lib/job-structures-bulk-edit";
import {
  computeDrillSheet,
  type DiameterConfig,
  type DrillSheetInput,
  type DrillSheetResult,
  type PipeConnectionType,
} from "@/lib/drill-sheet";
import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableClassName,
  tableComputedCellClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
  tableRowClassName,
  tableWrapperClassName,
} from "@/lib/table-styles";
import {
  StructureStatusBadge,
  formatBrickInches,
  formatElevation,
  formatFeet,
  formatWeightLb,
  handleGridNavKey,
  isFillDownKey,
} from "@/components/jobs/bulk-edit/bulk-edit-shared";

export type CircularGridOptions = {
  templates: DrillSheetTemplateOption[];
  castings: { id: string; name: string; heightFeet: number | null }[];
  pipeOpeningSizes: {
    pipeMaterial: string;
    pipeSizeInches: number;
    pipeType: string;
    hasBoot: boolean;
    holeDiameterInches: number;
    pipeWallThicknessInches: number;
    bootModel: string | null;
    pricePerBoot: number | null;
  }[];
  diameterConfigs: DiameterConfig[];
};

const CONNECTION_OPTIONS: { value: PipeConnectionType | ""; label: string }[] = [
  { value: "", label: "Template default" },
  { value: "KOR_N_SEAL", label: "Kor-N-Seal" },
  { value: "CAST_IN", label: "Cast in" },
  { value: "GROUTED", label: "Grouted" },
  { value: "OTHER", label: "Other" },
];

function parseNum(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function computeCircularPreview(
  values: DrillSheetFormValues,
  options: CircularGridOptions,
): DrillSheetResult | null {
  const template = options.templates.find(
    (entry) => entry.id === values.templateId,
  );
  const diameter = template?.diameters.find(
    (entry) => entry.id === values.diameterId,
  );
  if (!template || !diameter) {
    return null;
  }
  const diameterConfig = options.diameterConfigs.find(
    (config) =>
      Math.abs(config.insideDiameterFeet - diameter.insideDiameterFeet) < 1e-6,
  );
  if (!diameterConfig) {
    return null;
  }

  const castingId = values.castingProductId || template.defaultCastingProductId;
  const casting = castingId
    ? options.castings.find((entry) => entry.id === castingId)
    : null;
  const castingHeightFeet =
    casting?.heightFeet ??
    (values.castingProductId ? 0 : (template.defaultCastingHeightFeet ?? 0));

  const input: DrillSheetInput = {
    rimElevation: parseNum(values.rimElevation),
    castingHeightFeet: castingHeightFeet ?? 0,
    diameter: diameterConfig,
    template: {
      wallThicknessInches: template.wallThicknessInches,
      baseSlabThicknessInches: template.baseSlabThicknessInches,
      topSlabThicknessInches: template.topSlabThicknessInches,
      minimumBrickInches: template.minimumBrickInches,
      connectionType: template.connectionType,
      sumpMode: template.sumpMode,
      sumpFixedInches: template.sumpFixedInches,
      openingToJointMinTopInches: template.openingToJointMinTopInches,
      openingToJointMinBottomInches: template.openingToJointMinBottomInches,
    },
    pipeOpeningSizes: options.pipeOpeningSizes,
    openings: values.openings.map((opening) => ({
      label: opening.label,
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: parseNum(opening.pipeSizeInches),
      invertElevation: parseNum(opening.invertElevation),
      angleDegrees: parseNum(opening.angle),
      connectionType: opening.connectionType || null,
    })),
  };

  return computeDrillSheet(input);
}

type CircularBulkGridProps = {
  rows: CircularBulkEditRow[];
  options: CircularGridOptions;
  dirtyIds: Set<string>;
  rowErrors: Map<string, string>;
  onValuesChange: (structureId: string, values: DrillSheetFormValues) => void;
};

export function CircularBulkGrid({
  rows,
  options,
  dirtyIds,
  rowErrors,
  onValuesChange,
}: CircularBulkGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // "Set all" header inputs for Date / Inspection: typing applies to every
  // row immediately (the parent batches the per-row updates).
  const [setAllDate, setSetAllDate] = useState("");
  const [setAllInspection, setSetAllInspection] = useState("");

  const applyToAll = (patch: Partial<DrillSheetFormValues>) => {
    for (const row of rows) {
      onValuesChange(row.structureId, { ...row.values, ...patch });
    }
  };

  const materialOptions = useMemo(
    () => [
      ...new Set(
        options.pipeOpeningSizes.map((entry) =>
          [entry.pipeMaterial, entry.pipeType]
            .map((part) => part.trim())
            .filter(Boolean)
            .join(" "),
        ),
      ),
    ],
    [options.pipeOpeningSizes],
  );

  const patchValues = (
    row: CircularBulkEditRow,
    patch: Partial<DrillSheetFormValues>,
  ) => {
    onValuesChange(row.structureId, { ...row.values, ...patch });
  };

  const patchOpening = (
    row: CircularBulkEditRow,
    index: number,
    patch: Partial<DrillSheetFormOpening>,
  ) => {
    const openings = row.values.openings.map((opening, i) =>
      i === index ? { ...opening, ...patch } : opening,
    );
    patchValues(row, { openings });
  };

  const toggleExpanded = (structureId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(structureId)) {
        next.delete(structureId);
      } else {
        next.add(structureId);
      }
      return next;
    });
  };

  /** Ctrl+D: fill this cell from the row above (Excel fill-down). */
  const fillFromAbove = (
    rowIndex: number,
    read: (values: DrillSheetFormValues) => string | boolean,
    apply: (row: CircularBulkEditRow, value: string | boolean) => void,
  ) => {
    if (rowIndex === 0) {
      return;
    }
    apply(rows[rowIndex], read(rows[rowIndex - 1].values));
  };

  const cellInput = (
    row: CircularBulkEditRow,
    rowIndex: number,
    col: number,
    field: keyof Pick<
      DrillSheetFormValues,
      | "manholeNumber"
      | "rimElevation"
      | "brickAdjustment"
      | "useBase"
      | "useRiser"
      | "inspection"
    >,
    widthClass: string,
    numeric = false,
  ) => (
    <input
      type="text"
      data-r={rowIndex}
      data-c={col}
      value={row.values[field]}
      onChange={(event) => patchValues(row, { [field]: event.target.value })}
      onKeyDown={(event) => {
        if (isFillDownKey(event)) {
          event.preventDefault();
          fillFromAbove(
            rowIndex,
            (values) => values[field],
            (target, value) =>
              patchValues(target, { [field]: value as string }),
          );
          return;
        }
        if (handleGridNavKey(event, tableRef)) {
          event.preventDefault();
        }
      }}
      className={`${tableInlineInputClassName} ${widthClass} ${numeric ? "text-right tabular-nums" : ""}`}
    />
  );

  return (
    <div className={tableWrapperClassName}>
      <table ref={tableRef} className={tableClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellClassName}>Str #</th>
            <th className={tableHeaderCellClassName}>Template</th>
            <th className={tableHeaderCellClassName}>Dia</th>
            <th className={tableHeaderCellClassName}>Casting</th>
            <th className={tableHeaderCellClassName}>Rim elev</th>
            <th className={tableHeaderCellClassName}>Brick adj</th>
            <th className={tableHeaderCellClassName}>Use base</th>
            <th className={tableHeaderCellClassName}>Use riser</th>
            <th className={tableHeaderCellClassName}>Steps</th>
            <th className={tableHeaderCellClassName}>Date</th>
            <th className={tableHeaderCellClassName}>Inspection</th>
            <th className={tableHeaderCellClassName}>Openings</th>
            <th className={tableHeaderCellClassName}>Low inv</th>
            <th className={tableHeaderCellClassName}>Brick</th>
            <th className={tableHeaderCellClassName}>Wall ht</th>
            <th className={tableHeaderCellClassName}>Total ht</th>
            <th className={tableHeaderCellClassName}>Weight</th>
            <th className={tableHeaderCellClassName}>Status</th>
          </tr>
          <tr>
            <th
              colSpan={9}
              className={`${tableHeaderCellClassName} text-right font-normal normal-case tracking-normal text-slate-400`}
            >
              Set every structure →
            </th>
            <th className={`${tableHeaderCellClassName} font-normal`}>
              <input
                type="date"
                value={setAllDate}
                onChange={(event) => {
                  setSetAllDate(event.target.value);
                  applyToAll({ date: event.target.value });
                }}
                className={`${tableInlineInputClassName} w-32`}
                title="Sets the date on every structure below"
              />
            </th>
            <th className={`${tableHeaderCellClassName} font-normal`}>
              <input
                type="text"
                value={setAllInspection}
                placeholder="Set all…"
                onChange={(event) => {
                  setSetAllInspection(event.target.value);
                  applyToAll({ inspection: event.target.value });
                }}
                className={`${tableInlineInputClassName} w-24`}
                title="Sets the inspection on every structure below"
              />
            </th>
            <th colSpan={7} className={tableHeaderCellClassName} />
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {rows.map((row, rowIndex) => {
            const template = options.templates.find(
              (entry) => entry.id === row.values.templateId,
            );
            const preview = computeCircularPreview(row.values, options);
            const isDirty = dirtyIds.has(row.structureId);
            const error = rowErrors.get(row.structureId);
            const isExpanded = expandedIds.has(row.structureId);
            const previewError = preview?.errorMessage ?? null;

            return (
              <FragmentRow key={row.structureId}>
                <tr
                  className={`${tableRowClassName} ${isDirty ? "bg-sky-50/70" : ""}`}
                >
                  <td className={tableGridCellClassName}>
                    {cellInput(row, rowIndex, 0, "manholeNumber", "w-20")}
                  </td>
                  <td className={tableGridCellClassName}>
                    <select
                      data-r={rowIndex}
                      data-c={1}
                      value={row.values.templateId}
                      onChange={(event) => {
                        const nextTemplate = options.templates.find(
                          (entry) => entry.id === event.target.value,
                        );
                        patchValues(row, {
                          templateId: event.target.value,
                          diameterId: nextTemplate?.diameters[0]?.id ?? "",
                        });
                      }}
                      onKeyDown={(event) => {
                        if (handleGridNavKey(event, tableRef)) {
                          event.preventDefault();
                        }
                      }}
                      className={`${tableInlineInputClassName} w-40`}
                    >
                      {options.templates.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={tableGridCellClassName}>
                    <select
                      data-r={rowIndex}
                      data-c={2}
                      value={row.values.diameterId}
                      onChange={(event) =>
                        patchValues(row, { diameterId: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (handleGridNavKey(event, tableRef)) {
                          event.preventDefault();
                        }
                      }}
                      className={`${tableInlineInputClassName} w-16`}
                    >
                      {(template?.diameters ?? []).map((diameter) => (
                        <option key={diameter.id} value={diameter.id}>
                          {diameter.insideDiameterFeet}&apos;
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={tableGridCellClassName}>
                    <select
                      data-r={rowIndex}
                      data-c={3}
                      value={row.values.castingProductId}
                      onChange={(event) =>
                        patchValues(row, {
                          castingProductId: event.target.value,
                        })
                      }
                      onKeyDown={(event) => {
                        if (handleGridNavKey(event, tableRef)) {
                          event.preventDefault();
                        }
                      }}
                      className={`${tableInlineInputClassName} w-36`}
                    >
                      <option value="">Template default</option>
                      {options.castings.map((casting) => (
                        <option key={casting.id} value={casting.id}>
                          {casting.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={tableGridCellClassName}>
                    {cellInput(row, rowIndex, 4, "rimElevation", "w-20", true)}
                  </td>
                  <td className={tableGridCellClassName}>
                    {cellInput(
                      row,
                      rowIndex,
                      5,
                      "brickAdjustment",
                      "w-20",
                      true,
                    )}
                  </td>
                  <td className={tableGridCellClassName}>
                    {cellInput(row, rowIndex, 6, "useBase", "w-16")}
                  </td>
                  <td className={tableGridCellClassName}>
                    {cellInput(row, rowIndex, 7, "useRiser", "w-16")}
                  </td>
                  <td
                    className={`${tableCellBordersClassName} px-2 py-1.5 text-center`}
                  >
                    <input
                      type="checkbox"
                      data-r={rowIndex}
                      data-c={8}
                      checked={row.values.hasSteps}
                      onChange={(event) =>
                        patchValues(row, { hasSteps: event.target.checked })
                      }
                      onKeyDown={(event) => {
                        if (handleGridNavKey(event, tableRef)) {
                          event.preventDefault();
                        }
                      }}
                    />
                  </td>
                  <td className={tableGridCellClassName}>
                    <input
                      type="date"
                      data-r={rowIndex}
                      data-c={9}
                      value={row.values.date}
                      onChange={(event) =>
                        patchValues(row, { date: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (isFillDownKey(event)) {
                          event.preventDefault();
                          fillFromAbove(
                            rowIndex,
                            (values) => values.date,
                            (target, value) =>
                              patchValues(target, { date: value as string }),
                          );
                          return;
                        }
                        if (handleGridNavKey(event, tableRef)) {
                          event.preventDefault();
                        }
                      }}
                      className={`${tableInlineInputClassName} w-32`}
                    />
                  </td>
                  <td className={tableGridCellClassName}>
                    {cellInput(row, rowIndex, 10, "inspection", "w-24")}
                  </td>
                  <td
                    className={`${tableCellBordersClassName} px-2 py-1 whitespace-nowrap`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.structureId)}
                      className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {row.values.openings.length}{" "}
                      {isExpanded ? "▴" : "▾"}
                    </button>
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatElevation(preview?.lowInvertElevation)}
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatBrickInches(preview?.brickFeet)}
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatFeet(preview?.wallHeightFeet)}
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatFeet(preview?.totalHeightFeet)}
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatWeightLb(preview?.totalWeightLb)}
                  </td>
                  <td
                    className={`${tableCellBordersClassName} px-2 py-1.5 whitespace-nowrap`}
                  >
                    <StructureStatusBadge
                      status={row.status}
                      isProduced={row.isProduced}
                    />
                  </td>
                </tr>
                {error || previewError ? (
                  <tr>
                    <td
                      colSpan={18}
                      className={`${tableCellBordersClassName} bg-rose-50 px-3 py-1 text-[11px] text-rose-700`}
                    >
                      {error ?? previewError}
                    </td>
                  </tr>
                ) : null}
                {isExpanded ? (
                  <tr>
                    <td
                      colSpan={18}
                      className={`${tableCellBordersClassName} bg-slate-50/70 px-4 py-2`}
                    >
                      <div className="space-y-1">
                        {row.values.openings.map((opening, openingIndex) => (
                          <div
                            key={openingIndex}
                            className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600"
                          >
                            <input
                              type="text"
                              value={opening.label}
                              onChange={(event) =>
                                patchOpening(row, openingIndex, {
                                  label: event.target.value,
                                })
                              }
                              className={`${tableInlineInputClassName} w-10 border-slate-200`}
                              placeholder="A"
                            />
                            <select
                              value={opening.pipeMaterial}
                              onChange={(event) =>
                                patchOpening(row, openingIndex, {
                                  pipeMaterial: event.target.value,
                                })
                              }
                              className={`${tableInlineInputClassName} w-32 border-slate-200`}
                            >
                              <option value="">Material…</option>
                              {materialOptions.map((material) => (
                                <option key={material} value={material}>
                                  {material}
                                </option>
                              ))}
                              {opening.pipeMaterial &&
                              !materialOptions.includes(
                                opening.pipeMaterial,
                              ) ? (
                                <option value={opening.pipeMaterial}>
                                  {opening.pipeMaterial}
                                </option>
                              ) : null}
                            </select>
                            <label className="flex items-center gap-1">
                              size
                              <input
                                type="text"
                                value={opening.pipeSizeInches}
                                onChange={(event) =>
                                  patchOpening(row, openingIndex, {
                                    pipeSizeInches: event.target.value,
                                  })
                                }
                                className={`${tableInlineInputClassName} w-12 border-slate-200 text-right tabular-nums`}
                              />
                              &quot;
                            </label>
                            <label className="flex items-center gap-1">
                              inv
                              <input
                                type="text"
                                value={opening.invertElevation}
                                onChange={(event) =>
                                  patchOpening(row, openingIndex, {
                                    invertElevation: event.target.value,
                                  })
                                }
                                className={`${tableInlineInputClassName} w-20 border-slate-200 text-right tabular-nums`}
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              angle
                              <input
                                type="text"
                                value={opening.angle}
                                onChange={(event) =>
                                  patchOpening(row, openingIndex, {
                                    angle: event.target.value,
                                  })
                                }
                                className={`${tableInlineInputClassName} w-14 border-slate-200 text-right tabular-nums`}
                              />
                              °
                            </label>
                            <select
                              value={opening.connectionType}
                              onChange={(event) =>
                                patchOpening(row, openingIndex, {
                                  connectionType: event.target
                                    .value as PipeConnectionType | "",
                                })
                              }
                              className={`${tableInlineInputClassName} w-32 border-slate-200`}
                            >
                              {CONNECTION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                patchValues(row, {
                                  openings: row.values.openings.filter(
                                    (_, i) => i !== openingIndex,
                                  ),
                                })
                              }
                              className="text-rose-500 hover:text-rose-700"
                              title="Remove opening"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            patchValues(row, {
                              openings: [
                                ...row.values.openings,
                                {
                                  label: String.fromCharCode(
                                    65 + row.values.openings.length,
                                  ),
                                  pipeMaterial: "",
                                  pipeSizeInches: "",
                                  invertElevation: "",
                                  angle: "",
                                  connectionType: "",
                                },
                              ],
                            })
                          }
                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          + Add opening
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </FragmentRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Keyed fragment so a row plus its expander rows stay grouped. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
