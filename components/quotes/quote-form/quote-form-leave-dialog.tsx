"use client";

/** Back-pill guard shown when leaving the quote form with unsaved changes. */
export function QuoteFormLeaveDialog({
  isPending,
  onKeepEditing,
  onDiscard,
  onSave,
}: {
  isPending: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900">
          Save your changes?
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          This quote has unsaved changes. Save them before leaving, or
          discard them?
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onKeepEditing}
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isPending}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
