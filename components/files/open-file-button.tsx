"use client";

import { useState } from "react";
import { openJobFile } from "@/app/files/actions";

type OpenFileButtonProps = {
  fileId: string;
  fileName: string;
};

export function OpenFileButton({ fileId, fileName }: OpenFileButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setSuccess(null);
    setPending(true);

    try {
      const result = await openJobFile(fileId);
      setSuccess(`Opened in Explorer: ${result.fileName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open file.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title={fileName}
        className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Opening…" : "Open"}
      </button>
      {error ? <span className="text-[10px] text-red-600">{error}</span> : null}
      {success ? (
        <span className="text-[10px] text-green-700" title={success}>
          {success}
        </span>
      ) : null}
    </div>
  );
}
