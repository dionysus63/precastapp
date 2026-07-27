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

export type RectOpeningRow = {
  id: string;
  /** Combined material/type description, e.g. "PVC SDR35". */
  pipeMaterial: string;
  pipeSizeInches: string;
  openingWidthInches: string;
  openingHeightInches: string;
  pipeWallThicknessInches: string;
  pricePerOpening: string;
};

type RectOpeningSizesFormProps = {
  action: (formData: FormData) => Promise<void>;
  defaultRows: RectOpeningRow[];
  /** Price/Opening reads and writes this list's entries; blank = no entry. */
  priceListId: string;
  priceListName: string;
};

function uid() {
  return randomId();
}

function createRow(): RectOpeningRow {
  return {
    id: uid(),
    pipeMaterial: "",
    pipeSizeInches: "",
    openingWidthInches: "",
    openingHeightInches: "",
    pipeWallThicknessInches: "",
    pricePerOpening: "",
  };
}

export function RectOpeningSizesForm({
  action,
  defaultRows,
  priceListId,
  priceListName,
}: RectOpeningSizesFormProps) {
  const [rows, setRows] = useState<RectOpeningRow[]>(
    defaultRows.length > 0 ? defaultRows : [createRow()],
  );

  const payloadJson = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          pipeMaterial: row.pipeMaterial,
          pipeSizeInches: row.pipeSizeInches,
          openingWidthInches: row.openingWidthInches,
          openingHeightInches: row.openingHeightInches,
          pipeWallThicknessInches: row.pipeWallThicknessInches || null,
          pricePerOpening: row.pricePerOpening || null,
        })),
      ),
    [rows],
  );

  function updateRow(
    id: string,
    field: keyof Omit<RectOpeningRow, "id">,
    value: string,
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
        title="Rect Structure Opening Catalog"
        description="Material/type + pipe size maps to the block-out opening width and height. Skewed pipes widen the opening manually on the sheet. Pipe wall sets the outside top of pipe (invert + size + wall) for wall-height checks."
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
                <th className={tableHeaderCellClassName}>Pipe Size (in)</th>
                <th className={tableHeaderCellClassName}>Opening Width (in)</th>
                <th className={tableHeaderCellClassName}>Opening Height (in)</th>
                <th
                  className={tableHeaderCellClassName}
                  title={
                    "Pipe wall thickness. Drives the outside top of pipe (invert + size + wall), used to check the pipe clears the wall height."
                  }
                >
                  Pipe Wall Thk (in)
                </th>
                <th
                  className={tableHeaderCellClassName}
                  title={`Prices on the "${priceListName}" price list. Blank = no entry — quotes on this list fall back to the default list's price.`}
                >
                  Price/Opening ({priceListName})
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
                      placeholder="12"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={row.openingWidthInches}
                      onChange={(e) =>
                        updateRow(row.id, "openingWidthInches", e.target.value)
                      }
                      placeholder="18"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={row.openingHeightInches}
                      onChange={(e) =>
                        updateRow(row.id, "openingHeightInches", e.target.value)
                      }
                      placeholder="16"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="number"
                      min="0"
                      step="0.05"
                      value={row.pipeWallThicknessInches}
                      onChange={(e) =>
                        updateRow(
                          row.id,
                          "pipeWallThicknessInches",
                          e.target.value,
                        )
                      }
                      placeholder="2.5"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.pricePerOpening}
                      onChange={(e) =>
                        updateRow(row.id, "pricePerOpening", e.target.value)
                      }
                      placeholder="50.00"
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
