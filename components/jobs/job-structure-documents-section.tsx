"use client";

import { useRef, useState, useTransition } from "react";
import {
  deleteJobStructureDocumentAction,
  openJobStructureDocument,
  openJobStructureSubmittalsFolder,
  uploadJobStructureDocumentAction,
} from "@/app/jobs/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import type { JobStructureDocumentRow } from "@/lib/job-structure-detail-mapper";

const documentTypeOptions = [
  { value: "JOB_SPECIFIC_SUBMITTAL", label: "Job-Specific Submittal" },
  { value: "APPROVED_SUBMITTAL", label: "Approved Submittal" },
  { value: "CUT_SHEET", label: "Cut Sheet" },
  { value: "PRODUCTION_DRAWING", label: "Production Drawing" },
  { value: "FIELD_SKETCH", label: "Field Sketch" },
  { value: "OTHER", label: "Other" },
];

type JobStructureDocumentsSectionProps = {
  jobId: string;
  jobStructureId: string;
  structureNumber: string;
  folderPath: string | null;
  documents: JobStructureDocumentRow[];
};

export function JobStructureDocumentsSection({
  jobId,
  jobStructureId,
  structureNumber,
  folderPath,
  documents,
}: JobStructureDocumentsSectionProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const [rowMessages, setRowMessages] = useState<
    Record<string, { error?: string; success?: string }>
  >({});

  function handleUpload(formData: FormData) {
    setMessage({});
    startTransition(async () => {
      try {
        await uploadJobStructureDocumentAction(formData);
        formRef.current?.reset();
        setMessage({ success: "Document uploaded." });
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not upload document.",
        });
      }
    });
  }

  function handleOpenFolder() {
    setMessage({});
    startTransition(async () => {
      try {
        const result = await openJobStructureSubmittalsFolder(jobStructureId);
        setMessage({ success: `Opened in Explorer: ${result.path}` });
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not open folder.",
        });
      }
    });
  }

  function handleOpenDocument(documentId: string) {
    setRowMessages((current) => ({ ...current, [documentId]: {} }));
    startTransition(async () => {
      try {
        const result = await openJobStructureDocument(documentId);
        setRowMessages((current) => ({
          ...current,
          [documentId]: { success: `Opened: ${result.documentName}` },
        }));
      } catch (error) {
        setRowMessages((current) => ({
          ...current,
          [documentId]: {
            error:
              error instanceof Error ? error.message : "Could not open file.",
          },
        }));
      }
    });
  }

  function handleDelete(documentId: string) {
    if (!window.confirm("Delete this document from disk and the catalog?")) {
      return;
    }

    setMessage({});
    startTransition(async () => {
      try {
        await deleteJobStructureDocumentAction(documentId);
        setMessage({ success: "Document deleted." });
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not delete document.",
        });
      }
    });
  }

  return (
    <div id="submittals">
      <SectionCard
        title="Submittal Documents"
        description={`Files for ${structureNumber} are stored under the job folder in 03 Submittals.`}
      >
      <div className="space-y-5">
        {!folderPath ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <p className="font-medium">Job folder required</p>
            <p className="mt-1 text-amber-800">
              Create a job folder before uploading submittal documents.
            </p>
            <div className="mt-2">
              <CreateJobFolderButton jobId={jobId} />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={handleOpenFolder}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Open submittals folder
            </button>
          </div>
        )}

        <form
          ref={formRef}
          action={handleUpload}
          className="grid gap-4 lg:grid-cols-[1fr_220px_auto]"
        >
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="jobStructureId" value={jobStructureId} />
          <div>
            <label
              htmlFor="structureDocumentFile"
              className="block text-xs font-medium text-slate-700"
            >
              Upload file
            </label>
            <input
              id="structureDocumentFile"
              name="file"
              type="file"
              required
              disabled={pending || !folderPath}
              className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="structureDocumentType"
              className="block text-xs font-medium text-slate-700"
            >
              Document type
            </label>
            <select
              id="structureDocumentType"
              name="documentType"
              disabled={pending || !folderPath}
              defaultValue="JOB_SPECIFIC_SUBMITTAL"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 disabled:opacity-50"
            >
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending || !folderPath}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>

        {message.error ? (
          <p className="text-xs text-red-600">{message.error}</p>
        ) : null}
        {message.success ? (
          <p className="text-xs text-green-700">{message.success}</p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Document Name</th>
                <th className="px-4 py-2.5 font-semibold">Document Type</th>
                <th className="px-4 py-2.5 font-semibold">Uploaded Date</th>
                <th className="px-4 py-2.5 font-semibold">File Size</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No documents yet. Upload a job-specific submittal to begin.
                  </td>
                </tr>
              ) : (
                documents.map((document) => (
                  <tr key={document.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {document.documentName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {document.documentTypeLabel}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {document.uploadedDate}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {document.fileSize}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleOpenDocument(document.id)}
                            className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleDelete(document.id)}
                            className="inline-flex rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                        {rowMessages[document.id]?.error ? (
                          <span className="text-[10px] text-red-600">
                            {rowMessages[document.id]?.error}
                          </span>
                        ) : null}
                        {rowMessages[document.id]?.success ? (
                          <span className="text-[10px] text-green-700">
                            {rowMessages[document.id]?.success}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
    </div>
  );
}
