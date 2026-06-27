"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  structureInputClassName,
  structureTableInputClassName,
} from "@/components/structures/structure-utils";

export type DiameterConfigRow = {
  id: string;
  insideDiameterFeet: string;
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
  return crypto.randomUUID();
}

function createRow(): DiameterConfigRow {
  return {
    id: uid(),
    insideDiameterFeet: "",
    maxBaseHeightFeet: "",
    maxRiserHeightFeet: "",
    keyHeightFeet: "",
    wallPricePerFoot: "",
    basePrice: "",
  };
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
          insideDiameterFeet: row.insideDiameterFeet,
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
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-semibold">Inside Ø (ft)</th>
              <th className="px-3 py-2 font-semibold">Max Base (ft)</th>
              <th className="px-3 py-2 font-semibold">Max Riser (ft)</th>
              <th className="px-3 py-2 font-semibold">Key Height (ft)</th>
              <th className="px-3 py-2 font-semibold">$/ft Wall</th>
              <th className="px-3 py-2 font-semibold">Base Price</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-1.5">
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
                <td className="px-3 py-1.5">
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
                <td className="px-3 py-1.5">
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
                <td className="px-3 py-1.5">
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
                <td className="px-3 py-1.5">
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
                <td className="px-3 py-1.5">
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
                <td className="px-3 py-1.5 text-right">
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

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Save Diameter Settings
        </button>
      </div>
    </form>
  );
}
