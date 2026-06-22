"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { uploadJobStructureDocumentAction } from "@/app/jobs/actions";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import type { StructureStatus } from "@/components/structures/structure-utils";

type JobStructureSubmittalActionsProps = {
  jobId: string;
  jobStructureId: string;
  status: StructureStatus | string;
  needsSubmittal: boolean;
  folderPath: string | null;
};

export function JobStructureSubmittalActions({
  jobId,
  jobStructureId,
  status,
  needsSubmittal,
  folderPath,
}: JobStructureSubmittalActionsProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const needsSubmittalUpload =
    needsSubmittal && status === "NOT_SUBMITTED";
  const detailHash = needsSubmittalUpload ? "#submittals" : "";
  const detailHref = `/jobs/${jobId}/structures/${jobStructureId}${detailHash}`;

  function handleUpload(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await uploadJobStructureDocumentAction(formData);
        formRef.current?.reset();
        setMessage("Uploaded.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not upload.",
        );
      }
    });
  }

  return (
    <div className="flex min-w-[180px] flex-col gap-2">
      {needsSubmittalUpload ? (
        !folderPath ? (
          <CreateJobFolderButton jobId={jobId} />
        ) : (
          <form
            ref={formRef}
            action={handleUpload}
            className="flex flex-wrap items-center gap-1"
          >
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="jobStructureId" value={jobStructureId} />
            <input
              type="hidden"
              name="documentType"
              value="JOB_SPECIFIC_SUBMITTAL"
            />
            <input
              name="file"
              type="file"
              required
              disabled={pending}
              className="max-w-[140px] text-[10px] text-slate-600 file:mr-1 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-[10px] file:font-medium disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {pending ? "…" : "Upload"}
            </button>
          </form>
        )
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {needsSubmittalUpload ? (
          <Link
            href={detailHref}
            className="text-[11px] font-medium text-slate-700 hover:underline"
          >
            Add submittal
          </Link>
        ) : null}
        <Link
          href={detailHref}
          className="text-[11px] font-medium text-slate-900 hover:underline"
        >
          Manage
        </Link>
      </div>

      {message ? (
        <span
          className={`text-[10px] ${
            message === "Uploaded." ? "text-green-700" : "text-red-600"
          }`}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
