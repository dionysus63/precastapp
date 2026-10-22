"use client";

import { useState, useTransition } from "react";
import { updateTicketCustomLine } from "@/app/delivery-tickets/actions";
import { CUSTOM_LINE_MAX_LENGTH } from "@/lib/delivery-ticket-custom-line";
import { reloadAfterAction } from "@/lib/reload-after-action";

/**
 * Dispatch quick-edit for the ticket's custom line ("1st", "2nd", "12").
 * Saves on blur or Enter; Escape reverts. On error it reverts and explains.
 */
export function CustomLineInput({
  ticketId,
  customLine,
}: {
  ticketId: string;
  customLine: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(customLine ?? "");
  const [value, setValue] = useState(customLine ?? "");

  // Adopt server refreshes (e.g. edits from another screen) during render.
  const [prevCustomLine, setPrevCustomLine] = useState(customLine);
  if (customLine !== prevCustomLine) {
    setPrevCustomLine(customLine);
    setSaved(customLine ?? "");
    setValue(customLine ?? "");
  }

  function save() {
    const next = value.trim();
    if (next === saved) {
      setValue(saved);
      return;
    }
    const previous = saved;
    setSaved(next);
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await updateTicketCustomLine(ticketId, next || null);
      if ("error" in result) {
        setError(result.error);
        setSaved(previous);
        setValue(previous);
        return;
      }
      reloadAfterAction();
    });
  }

  return (
    <div>
      <input
        value={value}
        maxLength={CUSTOM_LINE_MAX_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setValue(saved);
          }
        }}
        placeholder="e.g. 1st"
        aria-label="Custom line"
        title="Prints in the upper right of the ticket"
        className={`block w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm ${
          pending ? "opacity-60" : ""
        }`}
      />
      {error ? (
        <p className="mt-1 max-w-[12rem] text-[10px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
