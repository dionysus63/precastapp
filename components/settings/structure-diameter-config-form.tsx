"use client";

import { useMemo, useState } from "react";
import { randomId } from "@/lib/random-id";
import { structureTableInputClassName } from "@/components/structures/structure-utils";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
export type DiameterConfigRow = {
  id: string;
  label: string;
  insideDiameterFeet: string;
  wallThicknessInches: string;
  maxBaseHeightFeet: string;
  maxRiserHeightFeet: string;
  keyHeightFeet: string;
  wallPricePerFoot: string;
  basePrice: string;
};

type StructureDiameterConfigFormProps = {
  action: (formData: FormData) => Promise<void>;
  defaultRows: DiameterConfigRow[];
};

function uid() {
  return randomId();
}

function createRow(): DiameterConfigRow {
  return {
    id: uid(),
    label: "",
    insideDiameterFeet: "",
    wallThicknessInches: "",
    maxBaseHeightFeet: "",
    maxRiserHeightFeet: "",
    keyHeightFeet: "",
    wallPricePerFoot: "",
    basePrice: "",
  };
}

/** Outside Ø display: inside Ø + 2 × wall, e.g. sanity-check that a 7.33'
 * ID grease trap mold with 4" walls really is the 8' OD mold. */
function outsideDiameterLabel(row: DiameterConfigRow): string {
  const inside = Number(row.insideDiameterFeet);
  const wall = Number(row.wallThicknessInches);
  if (
    !Number.isFinite(inside) ||
    inside <= 0 ||
    !Number.isFinite(wall) ||
    wall <= 0
  ) {
    return "—";
  }
  const outside = inside + (2 * wall) / 12;
  return `${(Math.round(outside * 100) / 100).toFixed(2)}'`;
}

export function StructureDiameterConfigForm({
  action,
  defaultRows,
}: StructureDiameterConfigFormProps) {
  const [rows, setRows] = useState<DiameterConfigRow[]>(
    defaultRows.length > 0 ? defaultRows : [createRow()],
  );

  const payloadJson = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          label: row.label,
          insideDiameterFeet: row.insideDiameterFeet,
          wallThicknessInches: row.wallThicknessInches,
          maxBaseHeightFeet: row.maxBaseHeightFeet,
          maxRiserHeightFeet: row.maxRiserHeightFeet,
          keyHeightFeet: row.keyHeightFeet,
          wallPricePerFoot: row.wallPricePerFoot,
          basePrice: row.basePrice,
        })),
      ),
    [rows],
  );

  function updateRow(
    id: string,
    field: keyof Omit<DiameterConfigRow, "id">,
    value: string,
  ) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payloadJson} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, createRow()])}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add Diameter
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Mold</th>
              <th className={tableHeaderCellClassName}>Inside Ø (ft)</th>
              <th className={tableHeaderCellClassName}>Wall (in)</th>
              <th className={tableHeaderCellClassName}>Outside Ø</th>
              <th className={tableHeaderCellClassName}>Max Base (ft)</th>
              <th className={tableHeaderCellClassName}>Max Riser (ft)</th>
              <th className={tableHeaderCellClassName}>Key Height (ft)</th>
              <th className={tableHeaderCellClassName}>$/ft Wall</th>
              <th className={tableHeaderCellClassName}>Base Price</th>
              <th className={tableHeaderCellClassName}></th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={tableCellClassName}>
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => updateRow(row.id, "label", e.target.value)}
                    placeholder={`e.g. C478 Manhole, 8' OD Grease Trap`}
                    className={`${structureTableInputClassName} min-w-[160px]`}
                  />
                </td>
                <td className={tableCellClassName}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.insideDiameterFeet}
                    onChange={(e) =>
                      updateRow(row.id, "insideDiameterFeet", e.target.value)
                    }
                    className={structureTableInputClassName}
                  />
                </td>
                <td className={tableCellClassName}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.wallThicknessInches}
                    onChange={(e) =>
                      updateRow(row.id, "wallThicknessInches", e.target.value)
                    }
                    className={structureTableInputClassName}
                  />
                </td>
                <td
                  className={`${tableCellClassName} whitespace-nowrap tabular-nums text-slate-500`}
                >
                  {outsideDiameterLabel(row)}
                </td>
                <td className={tableCellClassName}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.maxBaseHeightFeet}
                    onChange={(e) =>
                      updateRow(row.id, "maxBaseHeightFeet", e.target.value)
                    }
                    className={structureTableInputClassName}
                  />
                </td>
                <td className={tableCellClassName}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.maxRiserHeightFeet}
                    onChange={(e) =>
                      updateRow(row.id, "maxRiserHeightFeet", e.target.value)
                    }
                    className={structureTableInputClassName}
                  />
                </td>
                <td className={tableCellClassName}>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={row.keyHeightFeet}
                    onChange={(e) =>
                      updateRow(row.id, "keyHeightFeet", e.target.value)
                    }
                    className={structureTableInputClassName}
                  />
                </td>
                <td className={tableCellClassName}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.wallPricePerFoot}
                    onChange={(e) =>
                      updateRow(row.id, "wallPricePerFoot", e.target.value)
                    }
                    className={structureTableInputClassName}
                  />
                </td>
                <td className={tableCellClassName}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.basePrice}
                    onChange={(e) =>
                      updateRow(row.id, "basePrice", e.target.value)
                    }
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

      <p className="text-[11px] text-slate-500">
        Wall thickness belongs to the mold — templates and drill sheets pick
        it up per diameter. ASTM C478 minimum wall is inside Ø ÷ 12 (4&apos; →
        4&quot;, 5&apos; → 5&quot;, 6&apos; → 6&quot;). For molds sized by
        outside diameter, enter inside Ø = OD − 2 × wall (an 8&apos; OD mold
        with 4&quot; walls is 7.33&apos; inside) and check the Outside Ø
        column.
      </p>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Save Molds
        </button>
      </div>
    </form>
  );
}
