"use client";

import { useMemo, useRef, useState } from "react";
import type {
  RectOpeningField,
  RectSheetFormValues,
  RectSheetOpeningSizeOption,
  RectSheetTemplateOption,
} from "@/components/drill-sheets/rect-sheet-form";
import type { RectBulkEditRow } from "@/lib/job-structures-bulk-edit";
import { randomId } from "@/lib/random-id";
import {
  computeRectStructure,
  type RectOpeningPlacement,
  type RectStructureInput,
  type RectStructureResult,
  type RectWall,
} from "@/lib/rect-structure";
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
  formatElevation,
  formatFeet,
  formatWeightLb,
  handleGridNavKey,
  isFillDownKey,
} from "@/components/jobs/bulk-edit/bulk-edit-shared";

export type RectGridOptions = {
  templates: RectSheetTemplateOption[];
  castings: { id: string; name: string; heightFeet: number | null }[];
  openingSizes: RectSheetOpeningSizeOption[];
};

const WALL_OPTIONS: { value: RectWall; label: string }[] = [
  { value: "UP", label: "Up" },
  { value: "DOWN", label: "Down" },
  { value: "LEFT", label: "Left" },
  { value: "RIGHT", label: "Right" },
];

const PLACEMENT_OPTIONS: { value: RectOpeningPlacement; label: string }[] = [
  { value: "CENTERED", label: "Centered" },
  { value: "FROM_LEFT", label: "From left" },
  { value: "FROM_RIGHT", label: "From right" },
  { value: "TOUCH_LEFT", label: "Touch left" },
  { value: "TOUCH_RIGHT", label: "Touch right" },
];

function parseNum(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function computeRectPreview(
  values: RectSheetFormValues,
  options: RectGridOptions,
): RectStructureResult | null {
  const template = options.templates.find(
    (entry) => entry.id === values.templateId,
  );
  if (!template) {
    return null;
  }

  const castingId = values.castingProductId || template.defaultCastingProductId;
  const casting = castingId
    ? options.castings.find((entry) => entry.id === castingId)
    : null;
  const castingHeightFeet =
    casting?.heightFeet ??
    (values.castingProductId ? 0 : (template.defaultCastingHeightFeet ?? 0));

  const input: RectStructureInput = {
    rimElevation: parseNum(values.rimElevation),
    castingHeightFeet: castingHeightFeet ?? 0,
    insideLengthFeet: parseNum(values.insideLengthFeet),
    insideWidthFeet: parseNum(values.insideWidthFeet),
    hasTopSlab: values.hasTopSlab,
    hasBaseSlab: values.hasBaseSlab,
    baseAttached: values.baseAttached,
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
    openingSizes: options.openingSizes,
    openings: values.openings.map((opening) => ({
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
    sectionHeightsFeet: values.sections
      .map((section) => parseNum(section.heightFeet))
      .filter((value): value is number => value != null && value > 0),
    jointKeys: values.sections.slice(0, -1).map((section) => section.topKey),
    topSlabOpening: values.hasTopSlab
      ? {
          lengthInches: parseNum(values.topSlabOpeningLengthInches),
          widthInches: parseNum(values.topSlabOpeningWidthInches),
          side: values.topSlabOpeningSide || null,
        }
      : null,
  };

  return computeRectStructure(input);
}

type RectBulkGridProps = {
  rows: RectBulkEditRow[];
  options: RectGridOptions;
  dirtyIds: Set<string>;
  rowErrors: Map<string, string>;
  onValuesChange: (structureId: string, values: RectSheetFormValues) => void;
};

export function RectBulkGrid({
  rows,
  options,
  dirtyIds,
  rowErrors,
  onValuesChange,
}: RectBulkGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const materialOptions = useMemo(
    () => [
      ...new Set(
        options.openingSizes
          .map((entry) => entry.pipeMaterial.trim())
          .filter(Boolean),
      ),
    ],
    [options.openingSizes],
  );

  const patchValues = (
    row: RectBulkEditRow,
    patch: Partial<RectSheetFormValues>,
  ) => {
    onValuesChange(row.structureId, { ...row.values, ...patch });
  };

  const patchOpening = (
    row: RectBulkEditRow,
    index: number,
    patch: Partial<RectOpeningField>,
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

  const fillFromAbove = (
    rowIndex: number,
    read: (values: RectSheetFormValues) => string,
    apply: (row: RectBulkEditRow, value: string) => void,
  ) => {
    if (rowIndex === 0) {
      return;
    }
    apply(rows[rowIndex], read(rows[rowIndex - 1].values));
  };

  const cellInput = (
    row: RectBulkEditRow,
    rowIndex: number,
    col: number,
    field: keyof Pick<
      RectSheetFormValues,
      | "structureNumber"
      | "rimElevation"
      | "insideLengthFeet"
      | "insideWidthFeet"
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
            (target, value) => patchValues(target, { [field]: value }),
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
            <th className={tableHeaderCellClassName}>L</th>
            <th className={tableHeaderCellClassName}>W</th>
            <th className={tableHeaderCellClassName}>Casting</th>
            <th className={tableHeaderCellClassName}>Rim elev</th>
            <th className={tableHeaderCellClassName}>Top slab</th>
            <th className={tableHeaderCellClassName}>Base slab</th>
            <th className={tableHeaderCellClassName}>Openings</th>
            <th className={tableHeaderCellClassName}>Low inv</th>
            <th className={tableHeaderCellClassName}>Wall ht</th>
            <th className={tableHeaderCellClassName}>Total ht</th>
            <th className={tableHeaderCellClassName}>Heaviest pick</th>
            <th className={tableHeaderCellClassName}>Status</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {rows.map((row, rowIndex) => {
            const preview = computeRectPreview(row.values, options);
            const isDirty = dirtyIds.has(row.structureId);
            const error = rowErrors.get(row.structureId);
            const isExpanded = expandedIds.has(row.structureId);
            const previewError = preview?.errorMessage ?? null;
            const pours = row.values.sections
              .map((section) => section.heightFeet)
              .filter(Boolean);

            return (
              <FragmentRow key={row.structureId}>
                <tr
                  className={`${tableRowClassName} ${isDirty ? "bg-sky-50/70" : ""}`}
                >
                  <td className={tableGridCellClassName}>
                    {cellInput(row, rowIndex, 0, "structureNumber", "w-20")}
                  </td>
                  <td className={tableGridCellClassName}>
                    <select
                      data-r={rowIndex}
                      data-c={1}
                      value={row.values.templateId}
                      onChange={(event) =>
                        patchValues(row, { templateId: event.target.value })
                      }
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
                    {cellInput(
                      row,
                      rowIndex,
                      2,
                      "insideLengthFeet",
                      "w-14",
                      true,
                    )}
                  </td>
                  <td className={tableGridCellClassName}>
                    {cellInput(
                      row,
                      rowIndex,
                      3,
                      "insideWidthFeet",
                      "w-14",
                      true,
                    )}
                  </td>
                  <td className={tableGridCellClassName}>
                    <select
                      data-r={rowIndex}
                      data-c={4}
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
                    {cellInput(row, rowIndex, 5, "rimElevation", "w-20", true)}
                  </td>
                  <td
                    className={`${tableCellBordersClassName} px-2 py-1.5 text-center`}
                  >
                    <input
                      type="checkbox"
                      data-r={rowIndex}
                      data-c={6}
                      checked={row.values.hasTopSlab}
                      onChange={(event) =>
                        patchValues(row, { hasTopSlab: event.target.checked })
                      }
                      onKeyDown={(event) => {
                        if (handleGridNavKey(event, tableRef)) {
                          event.preventDefault();
                        }
                      }}
                    />
                  </td>
                  <td
                    className={`${tableCellBordersClassName} px-2 py-1.5 text-center`}
                  >
                    <input
                      type="checkbox"
                      data-r={rowIndex}
                      data-c={7}
                      checked={row.values.hasBaseSlab}
                      onChange={(event) =>
                        patchValues(row, { hasBaseSlab: event.target.checked })
                      }
                      onKeyDown={(event) => {
                        if (handleGridNavKey(event, tableRef)) {
                          event.preventDefault();
                        }
                      }}
                    />
                  </td>
                  <td
                    className={`${tableCellBordersClassName} px-2 py-1 whitespace-nowrap`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.structureId)}
                      className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {row.values.openings.length} {isExpanded ? "▴" : "▾"}
                    </button>
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatElevation(preview?.lowInvertElevation)}
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatFeet(preview?.wallHeightFeet)}
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatFeet(preview?.totalHeightFeet)}
                  </td>
                  <td className={tableComputedCellClassName}>
                    {formatWeightLb(preview?.weights.heaviestLbs)}
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
                      colSpan={14}
                      className={`${tableCellBordersClassName} bg-rose-50 px-3 py-1 text-[11px] text-rose-700`}
                    >
                      {error ?? previewError}
                    </td>
                  </tr>
                ) : null}
                {isExpanded ? (
                  <tr>
                    <td
                      colSpan={14}
                      className={`${tableCellBordersClassName} bg-slate-50/70 px-4 py-2`}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={row.values.baseAttached}
                              onChange={(event) =>
                                patchValues(row, {
                                  baseAttached: event.target.checked,
                                })
                              }
                            />
                            Base attached to bottom pour
                          </label>
                          {row.values.hasTopSlab ? (
                            <span className="flex items-center gap-1.5">
                              Top slab opening
                              <input
                                type="text"
                                value={row.values.topSlabOpeningLengthInches}
                                onChange={(event) =>
                                  patchValues(row, {
                                    topSlabOpeningLengthInches:
                                      event.target.value,
                                  })
                                }
                                className={`${tableInlineInputClassName} w-12 border-slate-200 text-right tabular-nums`}
                              />
                              ×
                              <input
                                type="text"
                                value={row.values.topSlabOpeningWidthInches}
                                onChange={(event) =>
                                  patchValues(row, {
                                    topSlabOpeningWidthInches:
                                      event.target.value,
                                  })
                                }
                                className={`${tableInlineInputClassName} w-12 border-slate-200 text-right tabular-nums`}
                              />
                              &quot; toward
                              <select
                                value={row.values.topSlabOpeningSide}
                                onChange={(event) =>
                                  patchValues(row, {
                                    topSlabOpeningSide: event.target
                                      .value as RectWall,
                                  })
                                }
                                className={`${tableInlineInputClassName} w-20 border-slate-200`}
                              >
                                {WALL_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </span>
                          ) : null}
                          <span className="text-slate-400">
                            {pours.length > 1
                              ? `Pours: ${pours.map((p) => `${p}'`).join(" + ")} (edit splits in the sheet editor)`
                              : "Single pour"}
                          </span>
                        </div>
                        {row.values.openings.map((opening, openingIndex) => (
                          <div
                            key={opening.id}
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
                              value={opening.wall}
                              onChange={(event) =>
                                patchOpening(row, openingIndex, {
                                  wall: event.target.value as RectWall | "",
                                })
                              }
                              className={`${tableInlineInputClassName} w-20 border-slate-200`}
                            >
                              <option value="">Wall…</option>
                              {WALL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={opening.pipeMaterial}
                              onChange={(event) =>
                                patchOpening(row, openingIndex, {
                                  pipeMaterial: event.target.value,
                                })
                              }
                              className={`${tableInlineInputClassName} w-28 border-slate-200`}
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
                            <select
                              value={opening.placement}
                              onChange={(event) =>
                                patchOpening(row, openingIndex, {
                                  placement: event.target
                                    .value as RectOpeningPlacement,
                                })
                              }
                              className={`${tableInlineInputClassName} w-28 border-slate-200`}
                            >
                              {PLACEMENT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {opening.placement !== "CENTERED" ? (
                              <label className="flex items-center gap-1">
                                offset
                                <input
                                  type="text"
                                  value={opening.offsetInches}
                                  onChange={(event) =>
                                    patchOpening(row, openingIndex, {
                                      offsetInches: event.target.value,
                                    })
                                  }
                                  className={`${tableInlineInputClassName} w-12 border-slate-200 text-right tabular-nums`}
                                />
                                &quot;
                              </label>
                            ) : null}
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
                                  id: randomId(),
                                  label: String.fromCharCode(
                                    65 + row.values.openings.length,
                                  ),
                                  wall: "",
                                  pipeMaterial: "",
                                  pipeSizeInches: "",
                                  invertElevation: "",
                                  angle: "",
                                  placement: "CENTERED",
                                  offsetInches: "",
                                  widthOverrideInches: "",
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

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
