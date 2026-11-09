"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * "You're leaving with unsaved work" for Quick Build. Three ways out: save
 * and go, go without saving, or stay. Escape stays.
 */
export function OneOffLeaveDialog({
  title,
  message,
  saveLabel,
  saveDisabledReason = null,
  saving,
  onSave,
  onDiscard,
  onStay,
}: {
  title: string;
  message: string;
  saveLabel: string;
  /** When set, the save button is disabled and this says why. */
  saveDisabledReason?: string | null;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onStay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onStay]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="one-off-leave-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2 id="one-off-leave-title" className="text-sm font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {saveDisabledReason ? (
          <p className="mt-2 text-xs text-amber-700">{saveDisabledReason}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onStay} disabled={saving}>
            Keep Editing
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard} disabled={saving}>
            Leave Without Saving
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onSave}
            disabled={saving || saveDisabledReason != null}
            autoFocus
          >
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
