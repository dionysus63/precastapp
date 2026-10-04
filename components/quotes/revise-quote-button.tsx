"use client";

import { useTransition } from "react";
import { reviseQuote } from "@/app/quotes/actions";
import { navigateAfterAction } from "@/lib/reload-after-action";

export function ReviseQuoteButton({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reviseQuote(quoteId);
          if ("error" in result) {
            window.alert(result.error);
            return;
          }
          navigateAfterAction(`/quotes/${result.newQuoteId}`);
        })
      }
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "Revising…" : "Revise Quote"}
    </button>
  );
}
