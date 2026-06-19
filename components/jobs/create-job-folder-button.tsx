"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createJobFolder } from "@/app/jobs/actions";

type CreateJobFolderButtonProps = {
  jobId: string;
};

export function CreateJobFolderButton({ jobId }: CreateJobFolderButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setError(null);
    setPending(true);

    try {
      await createJobFolder(jobId);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create job folder.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create Folder"}
      </button>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
}
