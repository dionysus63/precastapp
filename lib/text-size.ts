/**
 * Per-user Text Size: how big the app's screen text is for one sign-in
 * (stored on `User.textSize`, set under Settings → My Preferences or My
 * Profile). Only the letters grow: spacing, column widths, the sidebar and
 * PDF previews keep their size, and printed PDFs never change. The root
 * layout puts the choice on `<html data-text-size>`, and globals.css turns
 * it into `--text-scale`, which every text size utility multiplies by.
 */
export const TEXT_SIZE_VALUES = ["NORMAL", "LARGE", "EXTRA_LARGE"] as const;

export type TextSizeValue = (typeof TEXT_SIZE_VALUES)[number];

export const DEFAULT_TEXT_SIZE: TextSizeValue = "NORMAL";

/**
 * Multiplier for each choice. Keep in step with the `--text-scale` rules in
 * app/globals.css. 120% is the ceiling: beyond it the fixed-width grids
 * (Quick Build's 64px structure columns) start cutting text off.
 */
export const TEXT_SIZE_SCALE: Record<TextSizeValue, number> = {
  NORMAL: 1,
  LARGE: 1.1,
  EXTRA_LARGE: 1.2,
};

export const TEXT_SIZE_OPTIONS: ReadonlyArray<{
  value: TextSizeValue;
  label: string;
  hint: string;
}> = [
  { value: "NORMAL", label: "Normal", hint: "The standard size." },
  { value: "LARGE", label: "Large", hint: "About 10% bigger." },
  { value: "EXTRA_LARGE", label: "Extra Large", hint: "About 20% bigger." },
];

export function isTextSize(value: unknown): value is TextSizeValue {
  return (
    typeof value === "string" &&
    (TEXT_SIZE_VALUES as readonly string[]).includes(value)
  );
}

/** The `data-text-size` value for `<html>`; unknown or missing means Normal. */
export function resolveTextSize(value: unknown): TextSizeValue {
  return isTextSize(value) ? value : DEFAULT_TEXT_SIZE;
}
