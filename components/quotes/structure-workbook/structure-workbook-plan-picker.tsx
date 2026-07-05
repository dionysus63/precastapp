"use client";

import { useRef, useState, useTransition } from "react";
import {
  listJobConstructionPlanPdfs,
  selectJobPlanSheet,
  uploadPlanSheet,
  type PlanSheetRecord,
} from "@/app/quotes/plan-sheet-actions";

type StructureWorkbookPlanPickerProps = {
  quoteId?: string;
  jobId?: string | null;
  onPlanSheetReady: (planSheet: PlanSheetRecord) => void;
};

export function StructureWorkbookPlanPicker({
  quoteId,
  jobId,
  onPlanSheetReady,
}: StructureWorkbookPlanPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [jobFiles, setJobFiles] = useState<
    { id: string; fileName: string; filePath: string }[]
  >([]);
  const [loadedJobFiles, setLoadedJobFiles] = useState(false);

  function loadJobFiles() {
    if (!jobId || loadedJobFiles) {
      return;
    }
    startTransition(async () => {
      try {
        const files = await listJobConstructionPlanPdfs(jobId);
        setJobFiles(files);
        setLoadedJobFiles(true);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not list job plan files.",
        );
      }
    });
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);
        if (quoteId) {
          formData.set("quoteId", quoteId);
        }
        if (jobId) {
          formData.set("jobId", jobId);
        }
        const planSheet = await uploadPlanSheet(formData);
        onPlanSheetReady(planSheet);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Upload failed.",
        );
      } finally {
        event.target.value = "";
      }
    });
  }

  function handleSelectJobFile(filePath: string) {
    if (!jobId) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const planSheet = await selectJobPlanSheet(jobId, filePath, quoteId);
        onPlanSheetReady(planSheet);
      } catch (selectError) {
        setError(
          selectError instanceof Error
            ? selectError.message
            : "Could not select plan file.",
        );
      }
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm font-semibold text-slate-900">Plan sheet takeoff</p>
      <p className="mt-1 text-xs text-slate-600">
        Upload a construction plan PDF or pick one from the job folder to place
        structures and draw pipe lines.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Upload plan PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {jobId ? (
        <div className="mt-5 text-left">
          <button
            type="button"
            disabled={isPending}
            onClick={loadJobFiles}
            className="text-xs font-semibold text-sky-700 hover:underline"
          >
            {loadedJobFiles
              ? "Job construction plans"
              : "Browse job construction plans"}
          </button>
          {loadedJobFiles ? (
            jobFiles.length > 0 ? (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                {jobFiles.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSelectJobFile(file.filePath)}
                      className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {file.fileName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                No PDFs indexed in 01 Construction Plans yet.
              </p>
            )
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Link a job on the quote to pick an existing construction plan from the
          job folder.
        </p>
      )}

      {error ? (
        <p className="mt-4 text-xs font-medium text-red-700">{error}</p>
      ) : null}
      {isPending ? (
        <p className="mt-2 text-xs text-slate-500">Working…</p>
      ) : null}
    </div>
  );
}
