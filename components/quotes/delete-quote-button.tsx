"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteQuote } from "@/app/quotes/actions";

export function DeleteQuoteButton({
  quoteId,
  quoteNumber,
  disabled,
  disabledReason,
}: {
  quoteId: string;
  quoteNumber: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className="w-full rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
      >
        Delete Quote
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Delete quote ${quoteNumber}? This permanently removes the quote and its line items. This cannot be undone.`,
          )
        ) {
          return;
        }
        startTransition(async () => {
          const result = await deleteQuote(quoteId);
          if ("error" in result) {
            window.alert(result.error);
            return;
          }
          router.push("/quotes");
          router.refresh();
        });
      }}
      className="w-full rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete Quote"}
    </button>
  );
}
