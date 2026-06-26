"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reviseQuote } from "@/app/quotes/actions";

export function ReviseQuoteButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
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
          router.push(`/quotes/${result.newQuoteId}`);
          router.refresh();
        })
      }
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "Revising…" : "Revise Quote"}
    </button>
  );
}
