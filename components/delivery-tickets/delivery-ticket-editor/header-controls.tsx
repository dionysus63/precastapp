"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

type TicketTypeToggleProps = {
  ticketType: "JOB" | "WALK_IN";
  onChange: (next: "JOB" | "WALK_IN") => void;
};

/** Job ticket / Walk-in segmented switch at the left of the sticky bar. */
export function TicketTypeToggle({ ticketType, onChange }: TicketTypeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Ticket type"
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-slate-300 bg-white text-xs font-medium shadow-sm"
    >
      <button
        type="button"
        aria-pressed={ticketType === "JOB"}
        onClick={() => onChange("JOB")}
        className={
          ticketType === "JOB"
            ? "bg-slate-900 px-3 py-1.5 text-white"
            : "px-3 py-1.5 text-slate-600 hover:bg-slate-50"
        }
      >
        Job ticket
      </button>
      <button
        type="button"
        aria-pressed={ticketType === "WALK_IN"}
        onClick={() => onChange("WALK_IN")}
        className={
          ticketType === "WALK_IN"
            ? "bg-slate-900 px-3 py-1.5 text-white"
            : "border-l border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
        }
      >
        Walk-in
      </button>
    </div>
  );
}

type EditorActionButtonsProps = {
  ticketType: "JOB" | "WALK_IN";
  isPickup: boolean;
  pending: boolean;
  cancelHref: string;
  onCancelClick: (event: MouseEvent, href: string) => void;
  onSaveDraft: () => void;
  onSaveAndPreview: () => void;
  onSchedule: () => void;
};

/** Cancel / Save Draft / Save & Preview (walk-in) or Schedule (job). */
export function EditorActionButtons({
  ticketType,
  isPickup,
  pending,
  cancelHref,
  onCancelClick,
  onSaveDraft,
  onSaveAndPreview,
  onSchedule,
}: EditorActionButtonsProps) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Link
        href={cancelHref}
        onClick={(event) => onCancelClick(event, cancelHref)}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Cancel
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={onSaveDraft}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save Draft"}
      </button>
      {ticketType === "WALK_IN" ? (
        <button
          type="button"
          disabled={pending}
          onClick={onSaveAndPreview}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save & Preview"}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={onSchedule}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {pending
            ? "Saving..."
            : isPickup
              ? "Schedule Pickup"
              : "Schedule Delivery"}
        </button>
      )}
    </div>
  );
}
