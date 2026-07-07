/**
 * Shared Excel-style table classes used by every data table in the app —
 * read-only lists and editable grids alike. `border-separate border-spacing-0`
 * (not collapse) keeps cell borders attached to the sticky header while it
 * scrolls, and `last:border-r-0` on cells avoids doubling the wrapper's right
 * border, so no per-table "last column" variants are needed.
 */

export const tableWrapperClassName =
  "max-h-[70vh] overflow-auto rounded-lg border border-slate-200";

/**
 * Wrapper for tables inside an already-framed container (e.g. SectionCard
 * with noPadding) — scroll + sticky-header behavior without a second border.
 */
export const tableFlushWrapperClassName = "max-h-[70vh] overflow-auto";

export const tableClassName =
  "min-w-full border-separate border-spacing-0 text-left text-xs";

const tableHeaderCellBaseClassName =
  "sticky top-0 z-10 border-b-2 border-r border-b-slate-300 border-r-slate-300 bg-slate-100 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0";

export const tableHeaderCellClassName = `${tableHeaderCellBaseClassName} whitespace-nowrap`;

/** Header cell whose label wraps instead of widening the column. */
export const tableHeaderCellWrapClassName = tableHeaderCellBaseClassName;

/** Gridline borders only — compose with custom padding when needed. */
export const tableCellBordersClassName =
  "border-b border-r border-slate-300 last:border-r-0";

/** Read-only cell: gridline borders plus normal padding. */
export const tableCellClassName = `${tableCellBordersClassName} px-2 py-1.5`;

/** Cell that holds a fill-the-cell input — no padding, the control provides it. */
export const tableGridCellClassName = `${tableCellBordersClassName} p-0`;

export const tableNumericCellClassName = `${tableCellClassName} text-right tabular-nums`;

/** Computed/read-only numeric cell (totals), shaded like a locked spreadsheet cell. */
export const tableComputedCellClassName = `${tableNumericCellClassName} whitespace-nowrap bg-slate-50/60 font-medium text-slate-900`;

/** Excel-style row-number column. */
export const tableRowNumberCellClassName = `${tableCellClassName} w-10 select-none whitespace-nowrap bg-slate-50 text-center text-slate-500`;

export const tableRowClassName = "align-top hover:bg-slate-50/60";

export const tableBodyClassName = "bg-white";

/** Borderless input filling a tableGridCell, with Excel-style inset focus ring. */
export const tableCellInputClassName =
  "block w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";

export const tableNumericCellInputClassName = `${tableCellInputClassName} text-right tabular-nums`;

/**
 * Flat input for editable grids whose cells keep their own padding (unlike
 * tableGridCell): invisible at rest so the gridlines frame it, hints a border
 * on hover, and shows the Excel-style inset ring when focused. Carries no
 * width — compose with w-*\/min-w-* at the call site.
 */
export const tableInlineInputClassName =
  "rounded-sm border border-transparent bg-transparent px-1.5 py-0.5 text-xs text-slate-900 placeholder:text-slate-300 hover:border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";

export const tableCellTextareaClassName =
  "block w-full min-w-[18rem] resize-none whitespace-pre-wrap border-0 bg-transparent px-2 py-1.5 text-sm leading-snug text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";
