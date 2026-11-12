/**
 * How wide a page's content may grow inside the dashboard shell.
 *
 * - "standard": the centered 1280px column every list and form was laid out
 *   for.
 * - "full": the whole window beside the sidebar, for work screens that show a
 *   live document preview next to the fields being edited.
 */
export type PageWidth = "standard" | "full";

/** The standard centered column. Also used by full-width pages for the parts
 *  that should stay put (e.g. the job header above a full-width tab). */
export const standardPageWidthClassName = "mx-auto w-full max-w-7xl";

export function pageWidthClassName(width: PageWidth): string {
  return width === "full" ? "w-full" : standardPageWidthClassName;
}
