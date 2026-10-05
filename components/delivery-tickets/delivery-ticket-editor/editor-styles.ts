import {
  tableCellClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
} from "@/lib/table-styles";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const compactInputClass =
  "block h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

export const compactLabelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export const loadQuantityInputClass =
  "h-8 rounded-md border border-slate-400 bg-white px-2 text-right text-xs font-semibold text-slate-900 shadow-sm outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

export const inlineTableInputClass = tableInlineInputClassName;

export const quoteTableHeaderCellClassName = `${tableHeaderCellClassName} !z-[8] !px-1.5 !whitespace-normal`;
export const quoteLineTableCellClassName = `${tableCellClassName} !px-1.5`;

export const WALK_IN_RESULT_LIMIT = 50;
export const DASHBOARD_HEADER_HEIGHT = 74;
