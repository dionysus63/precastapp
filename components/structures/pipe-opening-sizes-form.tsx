"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  structureInputClassName,
  structureTableInputClassName,
} from "@/components/structures/structure-utils";

export type PipeOpeningRow = {
  id: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  pipeType: string;
  holeDiameterInches: string;
  bootModel: string;
  pricePerBoot: string;
};

type PipeOpeningSizesFormProps = {
  action: (formData: FormData) => Promise<void>;
  defaultRows: PipeOpeningRow[];
};

function uid() {
  return crypto.randomUUID();
}

function createRow(): PipeOpeningRow {
  return {
    id: uid(),
    pipeMaterial: "",
    pipeSizeInches: "",
    pipeType: "",
    holeDiameterInches: "",
    bootModel: "",
    pricePerBoot: "",
  };
}

export function PipeOpeningSizesForm({
  action,
  defaultRows,
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
          pipeType: row.pipeType,
          holeDiameterInches: row.holeDiameterInches,
          bootModel: row.bootModel || null,
          pricePerBoot: row.pricePerBoot || null,
        })),
      ),
    [rows],
  );

  function updateRow(
    id: string,
    field: keyof Omit<PipeOpeningRow, "id">,
    value: string,
  ) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payloadJson} />

      <SectionCard
        title="Pipe Opening Size Catalog"
        description="Material + size + type maps to hole diameter, boot model, and price per boot."
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">Material</th>
                <th className="px-3 py-2 font-semibold">Size (in)</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Hole (in)</th>
                <th className="px-3 py-2 font-semibold">Boot Model</th>
                <th className="px-3 py-2 font-semibold">Price/Boot</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={row.pipeMaterial}
                      onChange={(e) =>
                        updateRow(row.id, "pipeMaterial", e.target.value)
                      }
                      placeholder="PVC"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.pipeSizeInches}
                      onChange={(e) =>
                        updateRow(row.id, "pipeSizeInches", e.target.value)
                      }
                      placeholder="8"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={row.pipeType}
                      onChange={(e) =>
                        updateRow(row.id, "pipeType", e.target.value)
                      }
                      placeholder="SDR35"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.holeDiameterInches}
                      onChange={(e) =>
                        updateRow(row.id, "holeDiameterInches", e.target.value)
                      }
                      placeholder="12"
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-3 py-1.5">
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
                  <td className="px-3 py-1.5">
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
