"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  bulkDeleteJobStructures,
  bulkSetJobStructureStatuses,
  type BulkStructureStatus,
} from "@/app/operations/actions";
import { printPdfUrl } from "@/lib/print-pdf-url";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DrillSheetPdfLink } from "@/components/drill-sheets/drill-sheet-pdf-link";
import { JobStructureSubmittalActions } from "@/components/jobs/job-structure-submittal-actions";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";
import type { JobRelatedStructure } from "@/components/jobs/job-utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { reloadAfterAction } from "@/lib/reload-after-action";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellWrapClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const BULK_STATUS_OPTIONS: { value: BulkStructureStatus; label: string }[] = [
  { value: "IN_PRODUCTION", label: "In Production" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "MADE", label: "Made" },
];

/**
 * Structures table on the job production tab, with checkbox selection and a
 * bulk "set status" bar for detailing-style jobs where dozens of structures
 * move through the workflow together.
 */
export function JobStructuresProductionTable({
  jobId,
  folderPath,
  structures,
  jobStatusValue,
}: {
  jobId: string;
  folderPath: string | null;
  structures: JobRelatedStructure[];
  jobStatusValue: string;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<BulkStructureStatus>("IN_PRODUCTION");
  const [error, setError] = useState<string | null>(null);
  // Detailing/quoting jobs whose structures head into production usually
  // become Active at the same time; pre-check the nudge for those.
  const jobNotActive = ["QUOTING", "DETAILING", "AWARDED"].includes(jobStatusValue);
  const [setJobActive, setSetJobActive] = useState(jobNotActive);

  const allSelected =
    structures.length > 0 && structures.every((row) => selected.has(row.id));

  function toggleAll() {
    setSelected(
      allSelected ? new Set() : new Set(structures.map((row) => row.id)),
    );
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedRows = structures.filter((row) => selected.has(row.id));
  const selectedSheetIds = selectedRows
    .filter((row) => row.drillSheetId)
    .map((row) => row.id);

  function printSelectedSheets() {
    setError(null);
    printPdfUrl(
      `/api/jobs/${jobId}/drill-sheets?structureIds=${selectedSheetIds.join(",")}`,
    );
  }

  async function deleteSelected() {
    setError(null);
    const names = selectedRows
      .map((row) => row.structureNumber || "(unnumbered)")
      .join(", ");
    const accepted = await confirm({
      title: `Delete ${selected.size} structure${selected.size === 1 ? "" : "s"}?`,
      message:
        `Permanently deletes ${names} with their drill sheets, documents, and production history. ` +
        "Linked quote lines stay on the quote but lose their structure link. " +
        "Structures already on delivery tickets cannot be deleted.",
      confirmLabel: "Delete",
      cancelLabel: "Go back",
    });
    if (!accepted) {
      return;
    }
    startTransition(async () => {
      const result = await bulkDeleteJobStructures(jobId, [...selected]);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      reloadAfterAction();
    });
  }

  async function applyBulkStatus() {
    setError(null);
    const label =
      BULK_STATUS_OPTIONS.find((option) => option.value === bulkStatus)?.label ??
      bulkStatus;
    const jobNote =
      setJobActive && jobNotActive ? " The job will also be set to Active." : "";
    const accepted = await confirm({
      title: `Set ${selected.size} structure${selected.size === 1 ? "" : "s"} to ${label}?`,
      message:
        `This sets the status directly, skipping the normal submittal and approval steps.${jobNote}`,
      confirmLabel: `Set to ${label}`,
      cancelLabel: "Go back",
    });
    if (!accepted) {
      return;
    }
    startTransition(async () => {
      const result = await bulkSetJobStructureStatuses(
        jobId,
        [...selected],
        bulkStatus,
        setJobActive && jobNotActive,
      );
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      reloadAfterAction();
    });
  }

  return (
    <div className={tableFlushWrapperClassName}>
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 bg-sky-50 px-4 py-2">
          <span className="text-[11px] font-semibold text-sky-800">
            {selected.size} selected
          </span>
          <label className="text-[11px] font-medium text-sky-800" htmlFor="bulk-structure-status">
            Set status:
          </label>
          <select
            id="bulk-structure-status"
            value={bulkStatus}
            disabled={pending}
            onChange={(event) =>
              setBulkStatus(event.target.value as BulkStructureStatus)
            }
            className="rounded-md border border-sky-200 bg-white px-2 py-1 text-[11px] text-slate-900"
          >
            {BULK_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() => void applyBulkStatus()}
            className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
          <span className="h-4 w-px bg-sky-200" aria-hidden />
          <button
            type="button"
            disabled={pending || selectedSheetIds.length === 0}
            onClick={printSelectedSheets}
            title={
              selectedSheetIds.length === 0
                ? "None of the selected structures have drill sheets."
                : undefined
            }
            className="rounded-md border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
          >
            Print sheets ({selectedSheetIds.length})
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void deleteSelected()}
            className="rounded-md border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {pending ? "Working…" : "Delete"}
          </button>
          {jobNotActive ? (
            <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-800">
              <input
                type="checkbox"
                checked={setJobActive}
                onChange={(event) => setSetJobActive(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Also set job to Active
            </label>
          ) : null}
          {error ? (
            <span className="w-full text-[11px] font-medium text-red-600">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}
      <table className={tableClassName}>
        <thead>
          <tr>
            <th className={`${tableHeaderCellWrapClassName} w-8`}>
              <input
                type="checkbox"
                aria-label="Select all structures"
                checked={allSelected}
                onChange={toggleAll}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
            </th>
            <th className={tableHeaderCellWrapClassName}>Structure</th>
            <th className={tableHeaderCellWrapClassName}>Description</th>
            <th className={tableHeaderCellWrapClassName}>Type</th>
            <th className={tableHeaderCellWrapClassName}>Qty</th>
            <th className={tableHeaderCellWrapClassName}>Docs</th>
            <th className={tableHeaderCellWrapClassName}>Status</th>
            <th className={tableHeaderCellWrapClassName}>Submitted</th>
            <th className={tableHeaderCellWrapClassName}>Made</th>
            <th className={tableHeaderCellWrapClassName}>Shipped</th>
            <th className={tableHeaderCellWrapClassName}>Actions</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {structures.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className={`${tableCellClassName} text-center text-slate-500`}
              >
                No structures yet. They are created from a won quote (Link
                structures / Create Drill Sheets on the quote page) or manually
                with New Custom Structure.
              </td>
            </tr>
          ) : (
            structures.map((structure) => (
              <tr key={structure.id} className={tableRowClassName}>
                <td className={tableCellClassName}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${structure.structureNumber}`}
                    checked={selected.has(structure.id)}
                    onChange={() => toggleOne(structure.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                </td>
                <td className={`${tableCellClassName} font-medium text-slate-900`}>
                  <StructureManageLink jobId={jobId} structureId={structure.id}>
                    {structure.structureNumber}
                  </StructureManageLink>
                </td>
                <td className={`${tableCellClassName} text-slate-700`}>
                  {structure.description}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {structure.typeLabel}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {structure.quantity}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {structure.documentCount}
                </td>
                <td className={tableCellClassName}>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <StatusBadge
                      label={structure.statusLabel}
                      variant={structure.statusVariant}
                    />
                    {structure.needsDrillSheet ? (
                      <StatusBadge label="Needs drill sheet" variant="warning" />
                    ) : null}
                  </span>
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {structure.submittedDate}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {structure.madeProgress ? (
                    <span className="font-medium text-slate-800">
                      {structure.madeProgress}
                    </span>
                  ) : (
                    structure.madeDate
                  )}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {structure.shippedDate}
                </td>
                <td className={tableCellClassName}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {structure.createDrillSheetHref ? (
                      <Link
                        href={structure.createDrillSheetHref}
                        className="inline-flex w-fit rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
                      >
                        Create Drill Sheet
                      </Link>
                    ) : null}
                    {structure.drillSheetId ? (
                      <>
                        <DrillSheetPdfLink
                          drillSheetId={structure.drillSheetId}
                          label="PDF"
                        />
                        <Link
                          href={`/drill-sheets/${structure.drillSheetId}`}
                          className="inline-flex w-fit rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Drill Sheet
                        </Link>
                      </>
                    ) : null}
                    <JobStructureSubmittalActions
                      jobId={jobId}
                      jobStructureId={structure.id}
                      status={structure.status}
                      needsSubmittal={structure.needsSubmittal}
                      folderPath={folderPath}
                    />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
