/** Longest custom line kept; it prints in a small corner of the ticket. */
export const CUSTOM_LINE_MAX_LENGTH = 40;

/** Trim, cap length, and store blanks as null. */
export function normalizeCustomLine(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, CUSTOM_LINE_MAX_LENGTH);
}
