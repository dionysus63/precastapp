import { tableCellBordersClassName } from "@/lib/table-styles";

/**
 * Shared looks for the grids on the job Overview. Each grid scrolls inside
 * its own card past this height, so one long list (sixty structures) does
 * not push the other grids off the screen.
 */
export const overviewTableWrapperClassName = "max-h-[26rem] overflow-auto";

/** The one cell of a grid that has no rows yet. */
export const overviewEmptyCellClassName = `${tableCellBordersClassName} px-3 py-4 text-slate-500`;

/** A button in a grid card's header (New Ticket, Plan Loads…). */
export const overviewHeaderButtonClassName =
  "inline-flex items-center justify-center rounded-lg btn-plain px-3 py-1.5 text-2xs font-semibold";
