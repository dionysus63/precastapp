"use client";

import { useState, useTransition } from "react";
import { generateDeliveryTicketPdf } from "@/app/delivery-tickets/pdf-actions";

type TicketPdfButtonProps = {
  ticketId: string;
};

export function TicketPdfButton({ ticketId }: TicketPdfButtonProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await generateDeliveryTicketPdf(ticketId);
            if (result.success) {
              setMessage(`Saved: ${result.filePath}`);
              return;
            }
            setMessage(result.error);
          });
        }}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Preview/Print PDF"}
      </button>
      {message ? (
        <p className="max-w-xs text-right text-[10px] text-slate-500">{message}</p>
      ) : null}
    </div>
  );
}
