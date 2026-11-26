import { Decimal } from "@/lib/decimal";

/**
 * Reading prices the way they are typed or pasted on the Pricing screen.
 * Safe to import from both server and client modules.
 */

export type ParsedPrice =
  /** `value` null = the cell was left blank: no price. */
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/** The largest price a Decimal(12,2) column holds. */
const MAX_PRICE = new Decimal("9999999999.99");

/**
 * A price as typed or as Excel copies it: "$1,450.00", "1450", " 618.5 ".
 * Blank means no price. Returned as a string of dollars and cents so it
 * reaches the database without a float in between.
 */
export function parsePriceInput(raw: string): ParsedPrice {
  const trimmed = raw.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) {
    return { ok: false, error: "Type a price such as 1450 or 618.50." };
  }
  const value = new Decimal(trimmed);
  if (!value.toDecimalPlaces(2).equals(value)) {
    return { ok: false, error: "A price has at most two decimal places." };
  }
  if (value.gt(MAX_PRICE)) {
    return { ok: false, error: "That price is too large." };
  }
  return { ok: true, value: value.toFixed(2) };
}

/**
 * The first column of whatever was copied, one entry per row. Excel puts a
 * tab between columns and a line break between rows, and usually ends with
 * one extra line break; rows left blank in the middle stay as blank entries
 * so the prices under them keep lining up.
 */
export function splitPastedColumn(text: string): string[] {
  const rows = text.replace(/\r\n?/g, "\n").split("\n");
  while (rows.length > 0 && rows[rows.length - 1].trim() === "") {
    rows.pop();
  }
  // A cell that arrives wrapped in double quotes ("1,640.00", as a CSV file
  // writes it) is the same price without them.
  return rows.map((row) => row.split("\t")[0].trim().replace(/^"(.*)"$/, "$1").trim());
}
