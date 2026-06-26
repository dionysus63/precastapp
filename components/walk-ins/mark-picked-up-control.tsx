"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deliverTicket } from "@/app/operations/actions";

type MarkPickedUpControlProps = {
  ticketId: string;
  ticketNumber: string;
};

export function MarkPickedUpControl({
  ticketId,
  ticketNumber,
}: MarkPickedUpControlProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleConfirm() {
    setShowConfirm(false);
    setMessage(null);
    startTransition(async () => {
      const result = await deliverTicket(ticketId);
      if ("error" in result && result.error) {
        setMessage(result.error);
        return;
      }
      if ("warning" in result && result.warning) {
        setMessage(result.warning);
      }
      router.refresh();
    });
  }

  return (
    <>
      <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={false}
          disabled={pending}
          onChange={() => setShowConfirm(true)}
          className="rounded border-slate-300"
        />
        <span className="font-medium">Mark as picked up</span>
      </label>

      {message ? (
        <p className="mt-2 text-[10px] text-amber-700">{message}</p>
      ) : null}

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-pickup-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h3
              id="confirm-pickup-title"
              className="text-sm font-semibold text-slate-900"
            >
              Confirm pickup
            </h3>
            <p className="mt-2 text-xs text-slate-600">
              Are you sure ticket {ticketNumber} has been picked up?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleConfirm}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Yes, mark picked up"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
