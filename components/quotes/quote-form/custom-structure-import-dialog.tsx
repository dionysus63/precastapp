"use client";

import type { Dispatch, SetStateAction } from "react";
import type { CustomStructureImportState } from "@/components/quotes/quote-form/quote-form-utils";

/** "Import custom structures from the job" picker over the custom-structure modal. */
export function CustomStructureImportDialog({
  customImport,
  setCustomImport,
  customStructureNumbersInUse,
  onImport,
}: {
  customImport: CustomStructureImportState;
  setCustomImport: Dispatch<SetStateAction<CustomStructureImportState | null>>;
  customStructureNumbersInUse: () => Set<string>;
  onImport: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-structure-import-title"
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h3
            id="custom-structure-import-title"
            className="text-sm font-semibold text-slate-900"
          >
            Import custom structures from the job
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Structures no quote has picked up yet. Item codes match
            structure numbers, so winning this quote links the lines back
            to these exact structures — statuses and production progress
            stay put.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {customImport.loading ? (
            <p className="py-4 text-xs text-slate-500">Loading…</p>
          ) : customImport.error ? (
            <p className="py-4 text-xs font-medium text-red-600">
              {customImport.error}
            </p>
          ) : customImport.candidates.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">
              No unlinked custom structures on this job.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {customImport.candidates.map((candidate) => {
                const alreadyUsed = customStructureNumbersInUse().has(
                  candidate.structureNumber.toLowerCase(),
                );
                return (
                  <label
                    key={candidate.structureNumber}
                    className={`flex items-center gap-3 py-1.5 text-xs ${
                      alreadyUsed ? "text-slate-400" : "text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={alreadyUsed}
                      checked={
                        !alreadyUsed &&
                        !customImport.unchecked.has(
                          candidate.structureNumber,
                        )
                      }
                      onChange={(event) =>
                        setCustomImport((current) => {
                          if (!current) return current;
                          const unchecked = new Set(current.unchecked);
                          if (event.target.checked) {
                            unchecked.delete(candidate.structureNumber);
                          } else {
                            unchecked.add(candidate.structureNumber);
                          }
                          return { ...current, unchecked };
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span className="w-24 shrink-0 font-semibold text-slate-900">
                      {candidate.structureNumber}
                    </span>
                    <span className="w-14 shrink-0">×{candidate.qty}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">
                      {candidate.description || "—"}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {alreadyUsed ? "already on quote" : candidate.statusLabel}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setCustomImport(null)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={customImport.loading || customImport.candidates.length === 0}
            onClick={onImport}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Add to editor
          </button>
        </div>
      </div>
    </div>
  );
}
