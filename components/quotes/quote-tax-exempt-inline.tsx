"use client";

import { useState, useTransition } from "react";
import { setQuoteTaxExempt } from "@/app/quotes/actions";
import { reloadAfterAction } from "@/lib/reload-after-action";

/**
 * Inline sales-tax toggle for the quote detail page. Works at any quote
 * status — the tax exempt certificate usually arrives after the quote is
 * won and locked, so this bypasses the full-edit lock (same pattern as
 * the customer PO). Two-step confirm; totals recompute on save.
 */
export function QuoteTaxExemptInline({
  quoteId,
  taxRatePercent,
  defaultTaxRatePercent,
}: {
  quoteId: string;
  taxRatePercent: number;
  defaultTaxRatePercent: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExempt = taxRatePercent <= 0;

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await setQuoteTaxExempt(quoteId, !isExempt);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      reloadAfterAction();
    });
  }

  if (!confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {isExempt ? (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
            Tax Exempt
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-[11px] font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          {isExempt
            ? `Apply ${defaultTaxRatePercent}% tax`
            : "Make tax exempt"}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[11px] text-slate-600">
        {isExempt
          ? `Re-apply ${defaultTaxRatePercent}% sales tax and recalculate the total?`
          : `Remove the ${taxRatePercent}% sales tax and recalculate the total?`}
      </span>
      <button
        type="button"
        onClick={apply}
        disabled={pending}
        className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
      >
        Cancel
      </button>
      {error ? (
        <span className="text-[11px] font-medium text-red-600">{error}</span>
      ) : null}
    </span>
  );
}
