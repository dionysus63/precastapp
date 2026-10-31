"use client";

import { formatDraftSavedAt } from "@/components/quotes/one-off/one-off-drafts-card";
import { ONE_OFF_DRAFT_NAME_MAX } from "@/lib/quotes/one-off-draft";

export type OneOffDraftRecord = {
  id: string;
  name: string;
  savedBy: string | null;
  savedAt: string;
};

/**
 * "Save for later" strip above the One-Off wizard: name the draft, save it,
 * and see when it was last saved. Shown once there is something to save.
 */
export function OneOffDraftBar({
  draft,
  name,
  onNameChange,
  dirty,
  saving,
  error,
  onSave,
  onDiscard,
}: {
  /** The saved draft this page is working on, if any. */
  draft: OneOffDraftRecord | null;
  name: string;
  onNameChange: (name: string) => void;
  /** Work since the last save (or since the page opened). */
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  /** Deletes the saved draft and clears the page. */
  onDiscard: () => void;
}) {
  const status = saving
    ? "Saving…"
    : draft
      ? dirty
        ? "Changes since the last save."
        : `Saved ${formatDraftSavedAt(draft.savedAt)}${draft.savedBy ? ` by ${draft.savedBy}` : ""}.`
      : "Not saved yet. Save to pick this up later from the One-Off page.";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-2.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <label className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-slate-600">
            Draft name
          </span>
          <input
            type="text"
            value={name}
            maxLength={ONE_OFF_DRAFT_NAME_MAX}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. Main St manholes"
            className="w-56 max-w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
          />
        </label>
        <span
          className={`text-[11px] ${draft && !dirty && !saving ? "text-emerald-700" : "text-slate-500"}`}
          suppressHydrationWarning
        >
          {status}
        </span>
        {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {draft ? (
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Discard Draft
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || (draft != null && !dirty)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : draft ? "Save Changes" : "Save for Later"}
        </button>
      </div>
    </div>
  );
}
