"use client";

import { useState, useTransition } from "react";
import { generateDrillSheetPdf } from "@/app/drill-sheets/pdf-actions";

type DrillSheetPdfButtonProps = {
  drillSheetId: string;
};

export function DrillSheetPdfButton({ drillSheetId }: DrillSheetPdfButtonProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await generateDrillSheetPdf(drillSheetId);
            if (result.success) {
              setMessage(`Saved: ${result.filePath}`);
              return;
            }
            setMessage(result.error);
          });
        }}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate PDF"}
      </button>
      {message ? (
        <p className="max-w-xs text-right text-[10px] text-slate-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}
