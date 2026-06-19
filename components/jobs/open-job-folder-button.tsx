"use client";

import { useState } from "react";
import { openJobFolder } from "@/app/jobs/actions";

type OpenJobFolderButtonProps = {
  jobId: string;
  folderPath: string;
};

export function OpenJobFolderButton({
  jobId,
  folderPath,
}: OpenJobFolderButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setError(null);
    setPending(true);

    try {
      await openJobFolder(jobId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open job folder.",
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
        {pending ? "Opening..." : "Open Folder"}
      </button>
      <p
        className="truncate font-mono text-[10px] text-slate-500"
        title={folderPath}
      >
        {folderPath}
      </p>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
}
