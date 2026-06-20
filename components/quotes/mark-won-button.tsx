"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateQuoteStatus } from "@/app/quotes/actions";

export function MarkWonButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await updateQuoteStatus(quoteId, "WON");
          if (!result.error) {
            router.refresh();
          }
        })
      }
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
    >
      Mark Won
    </button>
  );
}
