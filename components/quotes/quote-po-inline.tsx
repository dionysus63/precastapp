"use client";

import { useState, useTransition } from "react";
import { updateQuoteCustomerPo } from "@/app/quotes/actions";
import { reloadAfterAction } from "@/lib/reload-after-action";

/**
 * Inline editor for the quote's customer PO number. Works at any quote
 * status — the PO usually arrives after the quote is won and locked, so
 * this bypasses the full-edit lock while touching nothing else.
 */
export function QuotePoInline({
  quoteId,
  customerPo,
}: {
  quoteId: string;
  customerPo: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(customerPo);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateQuoteCustomerPo(quoteId, value);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      reloadAfterAction();
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex items-baseline gap-1">
        {customerPo ? <span>PO {customerPo}</span> : null}
        <button
          type="button"
          onClick={() => {
            setValue(customerPo);
            setEditing(true);
          }}
          className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          {customerPo ? "edit" : "+ Add PO"}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-slate-600">PO</span>
      <input
        type="text"
        autoFocus
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            setEditing(false);
          }
        }}
        placeholder="PO number"
        className="w-36 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-900"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
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
