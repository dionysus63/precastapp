"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteOneOffDraft } from "@/app/quotes/one-off-draft-actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { describeActionFailure, isActionError } from "@/lib/action-result";
import {
  describeDraftShape,
  type OneOffDraftSummary,
} from "@/lib/quotes/one-off-draft";

/** "Oct 31, 2:15 PM" in the viewer's locale. */
export function formatDraftSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * One-Off grids saved to finish later. Resume reopens one in the wizard;
 * Delete throws it away (the sheets were never created, so nothing else
 * changes). The list is kept locally so a delete shows at once without a
 * router refresh, which is unreliable on the office LAN.
 */
export function OneOffDraftsCard({
  drafts: initialDrafts,
}: {
  drafts: OneOffDraftSummary[];
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startDeleting] = useTransition();

  if (drafts.length === 0) {
    return null;
  }

  function remove(draftId: string) {
    setError(null);
    setDeletingId(draftId);
    startDeleting(async () => {
      try {
        const response = await deleteOneOffDraft(draftId);
        if (isActionError(response)) {
          setError(response.error);
          return;
        }
        setConfirmingId(null);
        setDrafts((current) => current.filter((draft) => draft.id !== draftId));
      } catch (caught) {
        setError(describeActionFailure(caught, "Could not delete the draft."));
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <SectionCard
      title="Saved for Later"
      description="One-Offs you started and saved. Resume one to keep going, or start a new one below."
      noPadding
    >
      <ul className="divide-y divide-slate-100">
        {drafts.map((draft) => {
          const confirming = confirmingId === draft.id;
          const deleting = deletingId === draft.id;
          const rows = `${draft.rowCount} row${draft.rowCount === 1 ? "" : "s"}`;
          return (
            <li
              key={draft.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {draft.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {draft.jobLabel ? (
                    <span className={draft.jobMissing ? "text-amber-700" : undefined}>
                      {draft.jobLabel}
                    </span>
                  ) : (
                    "No job picked yet"
                  )}
                  {" · "}
                  {describeDraftShape(draft.shapeChoice)}
                  {draft.shapeChoice ? ` · ${rows}` : ""}
                </p>
                <p className="text-[11px] text-slate-400">
                  Saved{" "}
                  <span suppressHydrationWarning>{formatDraftSavedAt(draft.savedAt)}</span>
                  {draft.savedBy ? ` by ${draft.savedBy}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {confirming ? (
                  <>
                    <span className="text-xs text-slate-600">Delete this draft?</span>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => remove(draft.id)}
                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmingId(null)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/quotes/one-off?draft=${encodeURIComponent(draft.id)}`}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Resume
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setConfirmingId(draft.id);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <p className="px-4 pb-3 text-xs text-red-600">{error}</p> : null}
    </SectionCard>
  );
}
