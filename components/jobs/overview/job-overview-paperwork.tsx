"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { uploadJobFileAction } from "@/app/files/actions";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import {
  overviewEmptyCellClassName,
  overviewTableWrapperClassName,
} from "@/components/jobs/overview/overview-styles";
import { unwrapAction } from "@/lib/action-result";
import type { JobOverviewPaper } from "@/lib/job-overview";
import { reloadAfterAction } from "@/lib/reload-after-action";
import {
  tableActionButtonClassName,
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const COLUMN_COUNT = 3;

/** The PO and the tax cert are one document each; the other rows are folders. */
function isSingleDocument(paper: JobOverviewPaper): boolean {
  return paper.key === "purchase-orders" || paper.key === "tax-exempt-cert";
}

function OnFileCell({ paper }: { paper: JobOverviewPaper }) {
  if (isSingleDocument(paper)) {
    return paper.newestFile ? (
      <span className="break-words text-slate-900">{paper.newestFile.fileName}</span>
    ) : (
      <StatusBadge label="Not on file" variant="warning" />
    );
  }
  return paper.fileCount > 0 ? (
    <span className="text-slate-900">
      {paper.fileCount.toLocaleString()} file{paper.fileCount === 1 ? "" : "s"}
    </span>
  ) : (
    <span className="text-slate-500">None</span>
  );
}

/**
 * The job's paperwork on the Overview: whether the customer's PO and tax
 * cert are on file, and a button to add or replace each without opening its
 * tab.
 */
export function JobOverviewPaperwork({
  jobId,
  hasFolder,
  paperwork,
  canManageFiles,
}: {
  jobId: string;
  /** Files are saved into the job folder, so nothing can be added without one. */
  hasFolder: boolean;
  paperwork: JobOverviewPaper[];
  /** Add or replace a file, create the folder. */
  canManageFiles: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The row whose button opened the file picker.
  const targetRef = useRef<JobOverviewPaper | null>(null);

  function pickFile(paper: JobOverviewPaper) {
    targetRef.current = paper;
    setError(null);
    inputRef.current?.click();
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    const paper = targetRef.current;
    // Clear the input so picking the same file again still fires a change.
    event.currentTarget.value = "";
    if (!file || !paper?.folderCategory) {
      return;
    }
    const folderCategory = paper.folderCategory;
    setSavingKey(paper.key);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("jobId", jobId);
        formData.set("folderCategory", folderCategory);
        formData.set("file", file);
        await unwrapAction(uploadJobFileAction(formData));
        reloadAfterAction({
          type: "success",
          text: `${file.name} saved to ${paper.label}.`,
        });
      } catch (caught) {
        setSavingKey(null);
        setError(
          caught instanceof Error ? caught.message : "Could not save the file.",
        );
      }
    });
  }

  return (
    <div>
      <div className={overviewTableWrapperClassName}>
        <table className={tableCompactClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Paper</th>
              <th className={tableHeaderCellClassName}>On File</th>
              <th className={tableHeaderCellClassName}>Actions</th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {!hasFolder ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className={overviewEmptyCellClassName}>
                  <p className="mb-2">
                    This job has no folder yet, so there is nowhere to keep its
                    paperwork.
                  </p>
                  {canManageFiles ? <CreateJobFolderButton jobId={jobId} /> : null}
                </td>
              </tr>
            ) : (
              paperwork.map((paper) => {
                const single = isSingleDocument(paper);
                const saving = pending && savingKey === paper.key;
                return (
                  <tr key={paper.key} className={tableRowClassName}>
                    <td
                      className={`${tableCellClassName} whitespace-nowrap font-medium text-slate-900`}
                    >
                      <Link
                        href={`/jobs/${jobId}?tab=${paper.key}`}
                        className="hover:underline"
                      >
                        {paper.label}
                      </Link>
                    </td>
                    <td className={`${tableCellClassName} max-w-[16rem]`}>
                      <OnFileCell paper={paper} />
                    </td>
                    <td className={tableCellClassName}>
                      <div className="flex flex-wrap gap-1.5">
                        {single && paper.newestFile ? (
                          <a
                            href={`/api/job-files/${paper.newestFile.id}/content`}
                            target="_blank"
                            rel="noreferrer"
                            className={tableActionButtonClassName}
                          >
                            View
                          </a>
                        ) : null}
                        {!single ? (
                          <Link
                            href={`/jobs/${jobId}?tab=${paper.key}`}
                            className={tableActionButtonClassName}
                          >
                            Open
                          </Link>
                        ) : null}
                        {canManageFiles && paper.folderCategory ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => pickFile(paper)}
                            className={tableActionButtonClassName}
                          >
                            {saving
                              ? "Saving…"
                              : single && paper.newestFile
                                ? "Replace"
                                : "Add File"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFile}
      />
      {error ? (
        <p className="px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
