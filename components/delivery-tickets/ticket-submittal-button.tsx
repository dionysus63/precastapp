"use client";

import { useState, useTransition } from "react";
import { generateDeliveryTicketSubmittalPackage } from "@/app/delivery-tickets/actions";

export function TicketSubmittalButton({ ticketId }: { ticketId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { type: "success"; filePath: string; missing: string[]; skipped: string[] }
    | { type: "error"; message: string }
    | null
  >(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const response =
              await generateDeliveryTicketSubmittalPackage(ticketId);
            if (!response.success) {
              setResult({ type: "error", message: response.error });
              return;
            }
            setResult({
              type: "success",
              filePath: response.filePath,
              missing: response.missing,
              skipped: response.skipped,
            });
          })
        }
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Building…" : "Print Submittals"}
      </button>

      {result?.type === "success" ? (
        <div className="max-w-xs text-right text-[10px] text-green-700">
          <p>Saved: {result.filePath}</p>
          {result.missing.length > 0 ? (
            <p className="text-amber-700">
              Missing: {result.missing.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {result?.type === "error" ? (
        <p className="max-w-xs text-right text-[10px] text-red-600">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
