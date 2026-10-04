import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  calendarDateFromLocalDay,
  calendarDateToLocalNoon,
  formatCalendarDateShort,
  parseCalendarDate,
  parseLocalDay,
  startOfLocalDay,
  toCalendarDateInput,
  toLocalDayInput,
} from "@/lib/date-only";
import { formatDateShort } from "@/lib/format";

describe("day values (timestamp columns, local midnight)", () => {
  it("parses yyyy-mm-dd to local midnight and reads back the same day", () => {
    const day = parseLocalDay("2026-10-04")!;
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 9, 4]);
    expect(day.getHours()).toBe(0);
    expect(toLocalDayInput(day)).toBe("2026-10-04");
    expect(formatDateShort(day)).toBe("Oct 4, 2026");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseLocalDay("")).toBeNull();
    expect(parseLocalDay("10/04/2026")).toBeNull();
    expect(parseLocalDay("2026-02-31")).toBeNull();
    expect(parseLocalDay("2026-13-01")).toBeNull();
  });

  it("keeps a late-evening instant on its own local day", () => {
    // toISOString().slice(0, 10) reports the next day here in Eastern time.
    const evening = new Date(2026, 9, 4, 21, 30);
    expect(toLocalDayInput(evening)).toBe("2026-10-04");
    expect(startOfLocalDay(evening).getTime()).toBe(new Date(2026, 9, 4).getTime());
  });

  it("adds calendar days across a DST change", () => {
    // Nov 1, 2026 is the fall-back day; still lands on local midnight.
    const next = addLocalDays(new Date(2026, 9, 31), 2);
    expect(toLocalDayInput(next)).toBe("2026-11-02");
    expect(next.getHours()).toBe(0);
  });
});

describe("calendar values (@db.Date columns, UTC midnight)", () => {
  it("parses yyyy-mm-dd to UTC midnight and reads back the same day", () => {
    const date = parseCalendarDate("2026-10-04")!;
    expect(date.toISOString()).toBe("2026-10-04T00:00:00.000Z");
    expect(toCalendarDateInput(date)).toBe("2026-10-04");
    expect(formatCalendarDateShort(date)).toBe("Oct 4, 2026");
    expect(parseCalendarDate("2026-02-30")).toBeNull();
  });

  it("maps the local day (even late evening) to that calendar date", () => {
    const evening = new Date(2026, 9, 4, 21, 30);
    expect(calendarDateFromLocalDay(evening).toISOString()).toBe(
      "2026-10-04T00:00:00.000Z",
    );
  });

  it("converts a calendar date to local noon of the same day", () => {
    const noon = calendarDateToLocalNoon(parseCalendarDate("2026-10-04")!);
    expect(toLocalDayInput(noon)).toBe("2026-10-04");
    expect(noon.getHours()).toBe(12);
  });
});
