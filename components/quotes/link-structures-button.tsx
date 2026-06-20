"use client";

import { useState, useTransition } from "react";
import { linkStructuresForWonQuote } from "@/app/operations/actions";

export function LinkStructuresButton({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await linkStructuresForWonQuote(quoteId);
            setMessage(`${result.count} structure(s) linked`);
          })
        }
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Link structures
      </button>
      {message ? (
        <span className="text-[11px] text-emerald-700">{message}</span>
      ) : null}
    </div>
  );
}
