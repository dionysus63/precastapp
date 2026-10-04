/**
 * Date-only values ("2026-10-04", no time of day). The schema stores them two
 * ways, and mixing the two is what made dates show a day early:
 *
 * 1. DAY values in ordinary timestamp columns (deliveryDate, quoteDate,
 *    invoiceDate, dueDate, effectiveDate, bidDueDate, ...): the office's
 *    LOCAL midnight. Build with `parseLocalDay`, read back with
 *    `toLocalDayInput` / `formatDateShort` (local time).
 *
 * 2. CALENDAR values in `@db.Date` columns (DailyProductionEntry.productionDate,
 *    PurchaseReceipt.receiptDate, PurchaseOrder.orderDate / expectedDate,
 *    DailyReconciliation.reconciliationDate): Prisma reads and writes the UTC
 *    date part, so they must be UTC midnight. Build with `parseCalendarDate` /
 *    `calendarDateFromLocalDay`, read back with `toCalendarDateInput` /
 *    `formatCalendarDateShort`.
 *
 * "Today" is always the office's local calendar day: never derive it from
 * `toISOString()`, which is already tomorrow after 8pm Eastern.
 *
 * Safe to import from both server and client modules.
 */

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseYmd(
  value: string,
): { year: number; monthIndex: number; day: number } | null {
  const match = YMD_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  // Reject impossible days ("2026-02-31") instead of letting Date roll over.
  const probe = new Date(Date.UTC(year, monthIndex, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== monthIndex ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, monthIndex, day };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// 1. Day values (timestamp columns, local midnight)
// ---------------------------------------------------------------------------

/** "yyyy-mm-dd" -> local midnight of that day, or null if not a real date. */
export function parseLocalDay(value: string): Date | null {
  const parts = parseYmd(value);
  return parts ? new Date(parts.year, parts.monthIndex, parts.day) : null;
}

/** A day value (or any instant) -> its local "yyyy-mm-dd" (for <input type="date">). */
export function toLocalDayInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of the day containing `date` (default: now). */
export function startOfLocalDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Today as "yyyy-mm-dd" in the office's local time zone. */
export function localTodayInput(): string {
  return toLocalDayInput(new Date());
}

/** `days` calendar days after `date`'s local day, at local midnight. */
export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// ---------------------------------------------------------------------------
// 2. Calendar values (@db.Date columns, UTC midnight)
// ---------------------------------------------------------------------------

/** "yyyy-mm-dd" -> UTC midnight of that day, or null if not a real date. */
export function parseCalendarDate(value: string): Date | null {
  const parts = parseYmd(value);
  return parts
    ? new Date(Date.UTC(parts.year, parts.monthIndex, parts.day))
    : null;
}

/** A @db.Date value -> "yyyy-mm-dd" (its UTC date part). */
export function toCalendarDateInput(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The local calendar day of `date` (default: today) as a @db.Date value. */
export function calendarDateFromLocalDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** A @db.Date value as local noon of the same day, for timestamp columns. */
export function calendarDateToLocalNoon(date: Date): Date {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    12,
  );
}

/** "Oct 4, 2026" for a @db.Date value (formatDateShort would show Oct 3). */
export function formatCalendarDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
