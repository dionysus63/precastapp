/**
 * Dollar amounts in a text box: people type "1185", "$1,185" or "30318.5",
 * and the box shows "1,185.00" / "30,318.50" once they leave it.
 */

/** A typed dollar amount as a number; null when empty or not an amount. */
export function parseMoneyText(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * What the box shows once it is left: thousands commas and two decimals.
 * A price typed with more decimals (pipe by the foot, "0.1275") keeps them,
 * up to `maxDecimals`. Empty stays empty, and anything that is not an amount
 * is left as typed for the person to fix.
 */
export function formatMoneyText(value: string, maxDecimals = 2): string {
  const amount = parseMoneyText(value);
  if (amount == null) {
    return value.trim() ? value : "";
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.max(2, maxDecimals),
  });
}
