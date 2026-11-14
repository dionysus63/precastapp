/**
 * The look of "this one is picked" for everything that is not a tab: filter
 * chips, either/or switches, page pickers and choice cards. A light blue
 * fill with a blue edge, the same family as a selected table row.
 *
 * Black is kept for the main button on a screen (and the sidebar), so a
 * picked filter never reads as a button. Grey is not used either: grey fill
 * is what a switched-off button looks like.
 *
 * Tabs have their own look: components/ui/tabs.tsx.
 */

/** Fill and text, for a segment inside a bordered group (no edge of its own). */
export const selectedFillClassName = "bg-sky-100 text-sky-950";

/** Edge colour only, for an element that already has `border`. */
export const selectedBorderClassName = "border-sky-500";

/** Fill, text and edge colour, for an element that already has `border`. */
export const selectedClassName = `${selectedBorderClassName} ${selectedFillClassName}`;

/** The same for an element whose unselected look brings its own `border`. */
export const selectedWithBorderClassName = `border ${selectedClassName}`;

/** Smaller grey-ish text inside a selected element (a count, a second line). */
export const selectedMutedTextClassName = "text-sky-800";
