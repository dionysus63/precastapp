"use client";

import { useState, useTransition } from "react";
import { scanAllProductSubmittalsAction } from "@/app/products/actions";

export function ScanSubmittalsButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    error?: string;
    success?: string;
  }>({});

  function handleScan() {
    setMessage({});
    startTransition(async () => {
      try {
        const result = await scanAllProductSubmittalsAction();
        setMessage({
          success: `Matched ${result.productsWithFiles} product${result.productsWithFiles === 1 ? "" : "s"}: ${result.added} added, ${result.removed} removed.`,
        });
      } catch (error) {
        setMessage({
          error:
            error instanceof Error
              ? error.message
              : "Could not scan the submittals folder.",
        });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleScan}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Scanning…" : "Scan Submittals Folder"}
      </button>
      {message.error ? (
        <span className="text-[10px] text-red-600">{message.error}</span>
      ) : null}
      {message.success ? (
        <span className="text-[10px] text-green-700">{message.success}</span>
      ) : null}
    </div>
  );
}
