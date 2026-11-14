"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { openProductSubmittalsFolder } from "@/app/products/actions";
import { unwrapAction } from "@/lib/action-result";
import { tableActionButtonClassName } from "@/lib/table-styles";

type InventorySubmittalsCellProps = {
  productId: string;
  submittalCount: number;
};

export function InventorySubmittalsCell({
  productId,
  submittalCount,
}: InventorySubmittalsCellProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleOpen() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await unwrapAction(openProductSubmittalsFolder(productId));
        setMessage(result.path);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not open folder.",
        );
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={submittalCount > 0 ? "font-medium text-slate-900" : "text-slate-400"}>
          {submittalCount > 0 ? `${submittalCount} on file` : "None"}
        </span>
        <Link
          href={`/products/${productId}`}
          className={tableActionButtonClassName}
        >
          Docs
        </Link>
        {submittalCount > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleOpen}
            className="rounded-md border border-slate-200 px-2 py-0.5 text-3xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "Opening…" : "Open"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="max-w-xs truncate text-3xs text-slate-500" title={message}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
