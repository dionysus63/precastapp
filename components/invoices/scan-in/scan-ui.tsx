import type { ScanInRow } from "@/lib/ticket-scan/view-types";

/** Small button inside a grid cell. */
export const cellButtonClassName =
  "rounded border border-slate-300 bg-white px-2 py-0.5 text-2xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const cellPrimaryButtonClassName =
  "rounded border border-slate-900 bg-slate-900 px-2 py-0.5 text-2xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

export const cellLinkClassName =
  "text-2xs text-sky-700 underline hover:text-sky-900 disabled:opacity-50";

/** A PDF drag chip inside a table cell. */
export const cellChipClassName =
  "whitespace-nowrap rounded border border-slate-300 bg-white px-2 py-0.5 text-2xs font-medium text-slate-700 hover:bg-slate-50";

export const barButtonClassName =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const barPrimaryButtonClassName =
  "rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

/** A scan's cards share one frame, like the app's SectionCard. */
export const scanCardClassName =
  "min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm";

export function ScanCardHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-2.5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {action ? <div className="ml-auto flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export type ScanResultTone = "ok" | "warn" | "bad" | "muted" | "info";

const toneClassNames: Record<ScanResultTone, string> = {
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-300",
  bad: "bg-red-50 text-red-800 ring-red-200",
  muted: "bg-slate-100 text-slate-600 ring-slate-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
};

export function ResultPill({
  label,
  tone,
}: {
  label: string;
  tone: ScanResultTone;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-2xs font-semibold ring-1 ring-inset ${toneClassNames[tone]}`}
    >
      {label}
    </span>
  );
}

/** What the Result column says for a row, and in which colour. */
export function rowResult(row: ScanInRow): { label: string; tone: ScanResultTone } {
  switch (row.kind) {
    case "ready":
      return { label: "Ready", tone: "ok" };
    case "filed":
      return { label: "Filed", tone: "ok" };
    case "reading":
      return { label: "Reading…", tone: "info" };
    case "notRead":
      return { label: "Not read", tone: "warn" };
    case "notHere":
      return { label: "Not on this server", tone: "bad" };
    case "already":
      return { label: "Already signed", tone: "warn" };
    case "missing":
      return { label: row.detail ?? "Page missing", tone: "warn" };
    case "cancelled":
      return { label: "Ticket cancelled", tone: "bad" };
    case "extra":
      return { label: "Second copy", tone: "muted" };
    case "blank":
      return { label: "Blank back dropped", tone: "muted" };
    case "skipped":
      return { label: "Skipped", tone: "muted" };
    case "leftOut":
      return { label: "Left out", tone: "muted" };
  }
}

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** Bands in the order the grid shows them: what needs a person first. */
export const BAND_ORDER = ["needs", "reading", "ready", "filed", "left"] as const;

export function orderRows(rows: ScanInRow[]): ScanInRow[] {
  return BAND_ORDER.flatMap((band) =>
    rows.filter((row) => row.band === band).sort((a, b) => a.seq - b.seq),
  );
}
