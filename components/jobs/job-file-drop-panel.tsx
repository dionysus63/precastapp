"use client";

import { useRef, useState, useTransition } from "react";
import { uploadJobFileAction } from "@/app/files/actions";
import { printPdfUrl } from "@/lib/print-pdf-url";
import { reloadAfterAction } from "@/lib/reload-after-action";
import { SectionCard } from "@/components/dashboard/section-card";
import { FileUploadDropzone } from "@/components/files/file-upload-dropzone";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";

export type JobDropFile = {
  id: string;
  fileName: string;
  updatedAt: string;
};

type JobFileDropPanelProps = {
  jobId: string;
  jobNumber: string;
  folderPath: string | null;
  /** Newest file in the category, or null when none exists yet. */
  file: JobDropFile | null;
  /** Job subfolder the drop saves into (e.g. "10 Tax Exempt Cert"). */
  folderCategory: string;
  /** Card title, e.g. "Tax Exempt Certificate". */
  title: string;
  /** Lowercase noun for sentences, e.g. "tax exempt certificate". */
  noun: string;
  /** Stable per-tab prefix for the file input ids. */
  inputIdPrefix: string;
};

const PREVIEWABLE_EXTENSIONS = /\.(pdf|png|jpe?g|gif|webp)$/i;

/**
 * Single-document job tab: drop a file to save it into one job subfolder,
 * preview/print the newest one, drop again to replace. Used by the Tax
 * Exempt Cert and Purchase Orders tabs.
 */
export function JobFileDropPanel({
  jobId,
  jobNumber,
  folderPath,
  file,
  folderCategory,
  title,
  noun,
  inputIdPrefix,
}: JobFileDropPanelProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const fileUrl = file ? `/api/job-files/${file.id}/content` : null;
  const previewable = file ? PREVIEWABLE_EXTENSIONS.test(file.fileName) : false;

  // Dropping a file saves it immediately — no separate upload button.
  function handleFilesChange(files: File[]) {
    const dropped = files[0];
    if (!dropped || pending) {
      return;
    }
    setError(null);
    setProgress("Saving…");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("jobId", jobId);
        formData.set("folderCategory", folderCategory);
        formData.set("file", dropped);
        await uploadJobFileAction(formData);
        setProgress(null);
        reloadAfterAction();
      } catch (err) {
        setProgress(null);
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  function handlePrint() {
    if (!fileUrl) {
      return;
    }
    // PDFs go through printPdfUrl: frame print() on a PDF viewer is a silent
    // no-op in the desktop shell, and the viewer's own print control hangs it.
    if (file && /\.pdf$/i.test(file.fileName)) {
      printPdfUrl(fileUrl);
      return;
    }
    const frameWindow = previewFrameRef.current?.contentWindow;
    if (previewable && frameWindow) {
      try {
        frameWindow.focus();
        frameWindow.print();
        return;
      } catch {
        // Fall through to opening in a new tab.
      }
    }
    window.open(fileUrl, "_blank");
  }

  if (!folderPath) {
    return (
      <SectionCard title="Job folder required">
        <p className="mb-3 text-sm text-slate-600">
          {jobNumber} does not have a job folder yet — create one to store the{" "}
          {noun}.
        </p>
        <CreateJobFolderButton jobId={jobId} />
      </SectionCard>
    );
  }

  if (!file) {
    return (
      <SectionCard
        title={title}
        description={`Drop the customer's ${noun} here — it saves straight into the job folder.`}
      >
        <FileUploadDropzone
          files={[]}
          onFilesChange={handleFilesChange}
          disabled={pending}
          multiple={false}
          accept=".pdf,image/*"
          label={`Drag the ${noun} here`}
          description={`PDF or image. It is saved to the ${folderCategory} folder on this job.`}
          inputId={`${inputIdPrefix}-upload-${jobId}`}
        />
        {progress ? <p className="mt-3 text-xs text-slate-600">{progress}</p> : null}
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={title}
        description={`${file.fileName} · updated ${file.updatedAt}`}
        noPadding
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Print
          </button>
          <a
            href={fileUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open in new tab
          </a>
        </div>
        {previewable && fileUrl ? (
          <iframe
            ref={previewFrameRef}
            src={fileUrl}
            title={`${title} — ${file.fileName}`}
            className="h-[70vh] w-full rounded-b-xl bg-slate-100"
          />
        ) : (
          <p className="px-4 py-6 text-sm text-slate-500">
            {file.fileName} can&apos;t be previewed here — use “Open in new
            tab” to view it.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title={`Replace ${noun}`}
        description="Drop a newer file to replace the one shown above. The old file stays in the job folder."
      >
        <FileUploadDropzone
          files={[]}
          onFilesChange={handleFilesChange}
          disabled={pending}
          multiple={false}
          accept=".pdf,image/*"
          label={`Drag a new ${noun} here`}
          description="PDF or image."
          inputId={`${inputIdPrefix}-replace-${jobId}`}
        />
        {progress ? <p className="mt-3 text-xs text-slate-600">{progress}</p> : null}
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      </SectionCard>
    </div>
  );
}
