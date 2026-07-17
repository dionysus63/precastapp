"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobSheetImportCandidate } from "@/app/quotes/job-sheet-import-actions";

type JobSheetImportDialogProps<Row> = {
  /** Loads this workbook's shape of candidates for the quote's job. */
  loadCandidates: () => Promise<JobSheetImportCandidate<Row>[]>;
  /** Structure numbers already present in the workbook (lower-cased). */
  existingNumbers: Set<string>;
  shapeLabel: string;
  onImport: (rows: Row[]) => void;
  onClose: () => void;
};

/**
 * Detailing flow: pull the job's already-built drill sheets into the quote
 * workbook as priceable rows. When the quote is won, adoption links the
 * lines back to these exact structures by number — sheets, documents, and
 * statuses stay put; nothing is duplicated.
 */
export function JobSheetImportDialog<Row>({
  loadCandidates,
  existingNumbers,
  shapeLabel,
  onImport,
  onClose,
}: JobSheetImportDialogProps<Row>) {
  const [candidates, setCandidates] = useState<
    JobSheetImportCandidate<Row>[] | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    loadCandidates()
      .then((loaded) => {
        if (!cancelled) {
          setCandidates(loaded);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load the job's drill sheets.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // The dialog loads once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectable = useMemo(
    () =>
      (candidates ?? []).filter(
        (candidate) =>
          !existingNumbers.has(candidate.structureNumber.toLowerCase()),
      ),
    [candidates, existingNumbers],
  );
  const alreadyInWorkbook = (candidates ?? []).length - selectable.length;
  const selected = selectable.filter(
    (candidate) => !unchecked.has(candidate.structureNumber),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-sheet-import-title"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h3
            id="job-sheet-import-title"
            className="text-sm font-semibold text-slate-900"
          >
            Import from job drill sheets
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {shapeLabel} structures already detailed on the job, priced live by
            the workbook. Winning the quote links the lines to these exact
            structures — sheets and statuses stay put.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loadError ? (
            <p className="text-xs font-medium text-red-600">{loadError}</p>
          ) : candidates === null ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : selectable.length === 0 ? (
            <p className="text-xs text-slate-500">
              No unquoted {shapeLabel.toLowerCase()} drill sheets on this job
              {alreadyInWorkbook > 0
                ? ` — ${alreadyInWorkbook} already in the workbook`
                : ""}
              .
            </p>
          ) : (
            <table className="min-w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.length === selectable.length}
                      onChange={(event) =>
                        setUnchecked(
                          event.target.checked
                            ? new Set()
                            : new Set(
                                selectable.map(
                                  (candidate) => candidate.structureNumber,
                                ),
                              ),
                        )
                      }
                    />
                  </th>
                  <th className="py-1 pr-3">Structure</th>
                  <th className="py-1 pr-3">Template</th>
                  <th className="py-1 pr-3">Openings</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectable.map((candidate) => (
                  <tr key={candidate.structureNumber}>
                    <td className="py-1 pr-2">
                      <input
                        type="checkbox"
                        checked={!unchecked.has(candidate.structureNumber)}
                        onChange={(event) =>
                          setUnchecked((current) => {
                            const next = new Set(current);
                            if (event.target.checked) {
                              next.delete(candidate.structureNumber);
                            } else {
                              next.add(candidate.structureNumber);
                            }
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="py-1 pr-3 font-medium text-slate-900">
                      {candidate.structureNumber || "—"}
                    </td>
                    <td className="py-1 pr-3 text-slate-600">
                      {candidate.templateName}
                    </td>
                    <td className="py-1 pr-3 tabular-nums text-slate-600">
                      {candidate.openingCount}
                    </td>
                    <td className="py-1 text-slate-600">
                      {candidate.statusLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {alreadyInWorkbook > 0 && selectable.length > 0 ? (
            <p className="text-[11px] text-slate-500">
              {alreadyInWorkbook} structure
              {alreadyInWorkbook === 1 ? " is" : "s are"} already in the
              workbook and not listed.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              onImport(selected.map((candidate) => candidate.row));
              onClose();
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Add {selected.length > 0 ? selected.length : ""} structure
            {selected.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
