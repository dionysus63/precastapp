"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadJobFileAction } from "@/app/files/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { FileUploadDropzone } from "@/components/files/file-upload-dropzone";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import { TAX_EXEMPT_CERT_CATEGORY } from "@/lib/job-folder-constants";

export type TaxExemptCert = {
  id: string;
  fileName: string;
  updatedAt: string;
};

type JobTaxExemptCertPanelProps = {
  jobId: string;
  jobNumber: string;
  folderPath: string | null;
  cert: TaxExemptCert | null;
};

const PREVIEWABLE_EXTENSIONS = /\.(pdf|png|jpe?g|gif|webp)$/i;

export function JobTaxExemptCertPanel({
  jobId,
  jobNumber,
  folderPath,
  cert,
}: JobTaxExemptCertPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const certUrl = cert ? `/api/job-files/${cert.id}/content` : null;
  const previewable = cert ? PREVIEWABLE_EXTENSIONS.test(cert.fileName) : false;

  // Dropping a file saves it immediately — no separate upload button.
  function handleFilesChange(files: File[]) {
    const file = files[0];
    if (!file || pending) {
      return;
    }
    setError(null);
    setProgress("Saving certificate…");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("jobId", jobId);
        formData.set("folderCategory", TAX_EXEMPT_CERT_CATEGORY);
        formData.set("file", file);
        await uploadJobFileAction(formData);
        setProgress(null);
        router.refresh();
      } catch (err) {
        setProgress(null);
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  function handlePrint() {
    if (!certUrl) {
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
    window.open(certUrl, "_blank");
  }

  if (!folderPath) {
    return (
      <SectionCard title="Job folder required">
        <p className="mb-3 text-sm text-slate-600">
          {jobNumber} does not have a job folder yet — create one to store the
          tax exempt certificate.
        </p>
        <CreateJobFolderButton jobId={jobId} />
      </SectionCard>
    );
  }

  if (!cert) {
    return (
      <SectionCard
        title="Tax Exempt Certificate"
        description="Drop the customer's certificate here — it saves straight into the job folder."
      >
        <FileUploadDropzone
          files={[]}
          onFilesChange={handleFilesChange}
          disabled={pending}
          multiple={false}
          accept=".pdf,image/*"
          label="Drag the tax exempt certificate here"
          description="PDF or image. It is saved to the 10 Tax Exempt Cert folder on this job."
          inputId={`tax-exempt-cert-upload-${jobId}`}
        />
        {progress ? <p className="mt-3 text-xs text-slate-600">{progress}</p> : null}
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Tax Exempt Certificate"
        description={`${cert.fileName} · updated ${cert.updatedAt}`}
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
            href={certUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open in new tab
          </a>
        </div>
        {previewable && certUrl ? (
          <iframe
            ref={previewFrameRef}
            src={certUrl}
            title={`Tax exempt certificate — ${cert.fileName}`}
            className="h-[70vh] w-full rounded-b-xl bg-slate-100"
          />
        ) : (
          <p className="px-4 py-6 text-sm text-slate-500">
            {cert.fileName} can&apos;t be previewed here — use “Open in new
            tab” to view it.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Replace certificate"
        description="Drop a newer file to replace the one shown above. The old file stays in the job folder."
      >
        <FileUploadDropzone
          files={[]}
          onFilesChange={handleFilesChange}
          disabled={pending}
          multiple={false}
          accept=".pdf,image/*"
          label="Drag a new certificate here"
          description="PDF or image."
          inputId={`tax-exempt-cert-replace-${jobId}`}
        />
        {progress ? <p className="mt-3 text-xs text-slate-600">{progress}</p> : null}
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      </SectionCard>
    </div>
  );
}
