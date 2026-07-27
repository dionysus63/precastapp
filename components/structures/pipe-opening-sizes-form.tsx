"use client";

import Link from "next/link";
import { randomId } from "@/lib/random-id";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { structureTableInputClassName } from "@/components/structures/structure-utils";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
export type PipeOpeningRow = {
  id: string;
  /** Combined material/type description, e.g. "PVC SDR35". */
  pipeMaterial: string;
  pipeSizeInches: string;
  hasBoot: boolean;
  holeDiameterInches: string;
  pipeWallThicknessInches: string;
  bootModel: string;
  pricePerBoot: string;
};

type PipeOpeningSizesFormProps = {
  action: (formData: FormData) => Promise<void>;
  defaultRows: PipeOpeningRow[];
  /** Price/Boot reads and writes this list's entries; blank = no entry. */
  priceListId: string;
  priceListName: string;
};

function uid() {
  return randomId();
}

function createRow(): PipeOpeningRow {
  return {
    id: uid(),
    pipeMaterial: "",
    pipeSizeInches: "",
    hasBoot: true,
    holeDiameterInches: "",
    pipeWallThicknessInches: "",
    bootModel: "",
    pricePerBoot: "",
  };
}

export function PipeOpeningSizesForm({
  action,
  defaultRows,
  priceListId,
  priceListName,
}: PipeOpeningSizesFormProps) {
  const [rows, setRows] = useState<PipeOpeningRow[]>(
    defaultRows.length > 0 ? defaultRows : [createRow()],
  );

  const payloadJson = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          pipeMaterial: row.pipeMaterial,
          pipeSizeInches: row.pipeSizeInches,
          hasBoot: row.hasBoot,
          holeDiameterInches: row.holeDiameterInches,
          pipeWallThicknessInches: row.pipeWallThicknessInches,
          bootModel: row.bootModel || null,
          pricePerBoot: row.pricePerBoot || null,
        })),
      ),
    [rows],
  );

  function updateRow(
    id: string,
    field: keyof Omit<PipeOpeningRow, "id">,
    value: string | boolean,
  ) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payloadJson} />
      <input type="hidden" name="priceListId" value={priceListId} />

      <SectionCard
        title="Round Structure Opening Catalog"
        description="Material/type + size + boot maps to hole diameter, pipe wall, boot model, and price per boot. Pipe wall sets the pipe's outside: top-of-pipe on the sheet is invert + size + wall, and grouted holes must clear OD = size + 2 × wall."
        action={
          <button
            type="button"
            onClick={() => setRows((current) => [...current, createRow()])}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add Row
          </button>
        }
        noPadding
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Material / Type</th>
                <th className={tableHeaderCellClassName}>Size (in)</th>
                <th className={tableHeaderCellClassName}>Boot?</th>
                <th className={tableHeaderCellClassName}>Hole (in)</th>
                <th
                  className={tableHeaderCellClassName}
                  title={
                    "Pipe wall thickness. Drives the top-of-pipe elevation on the sheet (invert + size + wall) and the joint clearance for grouted/cast-in holes (pipe OD = size + 2 × wall)."
                  }
                >
                  Pipe Wall (in)
                </th>
                <th className={tableHeaderCellClassName}>Boot Model</th>
                <th
                  className={tableHeaderCellClassName}
                  title={`Prices on the "${priceListName}" price list. Blank = no entry — quotes on this list fall back to the default list's price.`}
                >
                  Price/Boot ({priceListName})
                </th>
                <th className={tableHeaderCellClassName}></th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={tableCellClassName}>
                    <input
                      type="text"
                      value={row.pipeMaterial}
                      onChange={(e) =>
                        updateRow(row.id, "pipeMaterial", e.target.value)
                      }
                      placeholder="PVC SDR35"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={row.pipeSizeInches}
                      onChange={(e) =>
                        updateRow(
                          row.id,
                          "pipeSizeInches",
                          e.target.value.replace(/[^0-9]/g, ""),
                        )
                      }
                      placeholder="8"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <select
                      value={row.hasBoot ? "yes" : "no"}
                      onChange={(e) =>
                        updateRow(row.id, "hasBoot", e.target.value === "yes")
                      }
                      className={structureTableInputClassName}
                    >
                      <option value="yes">Boot</option>
                      <option value="no">No Boot</option>
                    </select>
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={row.holeDiameterInches}
                      onChange={(e) =>
                        updateRow(
                          row.id,
                          "holeDiameterInches",
                          e.target.value.replace(/[^0-9]/g, ""),
                        )
                      }
                      placeholder="12"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.pipeWallThicknessInches}
                      onChange={(e) =>
                        updateRow(
                          row.id,
                          "pipeWallThicknessInches",
                          e.target.value,
                        )
                      }
                      placeholder="0.5"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="text"
                      value={row.bootModel}
                      onChange={(e) =>
                        updateRow(row.id, "bootModel", e.target.value)
                      }
                      placeholder="106-008"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.pricePerBoot}
                      onChange={(e) =>
                        updateRow(row.id, "pricePerBoot", e.target.value)
                      }
                      placeholder="45.00"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={`${tableCellClassName} py-1.5 text-right`}>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setRows((current) =>
                            current.filter((r) => r.id !== row.id),
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
          href="/structures"
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Save Catalog
        </button>
      </div>
    </form>
  );
}
