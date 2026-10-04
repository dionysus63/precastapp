import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import { formatJobDateInput } from "@/components/jobs/job-utils";
import { parseProductionDate } from "@/lib/daily-production-service";
import { parseCalendarDate } from "@/lib/date-only";
import { mapPurchaseOrderListRow, mapPurchaseOrderDetail } from "@/lib/purchase-order-mapper";
import {
  formatReceiptDate,
  formatRelativeDeliveryDate,
  getDeliveryStaleness,
  receiptDaysAgo,
} from "@/lib/receiving-utils";
import { getOptionalDate } from "@/lib/server/form-data";

// 9:30pm local on Oct 4 — toISOString() already says Oct 5 in Eastern time.
const EVENING = new Date(2026, 9, 4, 21, 30);

afterEach(() => {
  vi.useRealTimers();
});

describe("receipt dates (@db.Date receiptDate)", () => {
  const receivedToday = parseCalendarDate("2026-10-04")!;

  it("counts a receipt dated today as today, not yesterday", () => {
    expect(receiptDaysAgo(receivedToday, EVENING)).toBe(0);
    expect(receiptDaysAgo(parseCalendarDate("2026-10-01")!, EVENING)).toBe(3);

    vi.useFakeTimers();
    vi.setSystemTime(EVENING);
    expect(formatRelativeDeliveryDate(receivedToday)).toBe("Today");
    expect(getDeliveryStaleness(receivedToday)).toBe("fresh");
  });

  it("formats the stored calendar day, not the local day before it", () => {
    expect(formatReceiptDate(receivedToday)).toBe("Sun, Oct 4, 2026");
  });
});

describe("purchase order dates (@db.Date orderDate / expectedDate)", () => {
  it("labels the stored calendar day", () => {
    const po = {
      id: "po1",
      poNumber: "PO-1",
      orderDate: parseCalendarDate("2026-10-04")!,
      expectedDate: parseCalendarDate("2026-10-12")!,
      category: null,
      status: "ISSUED" as const,
      total: new Prisma.Decimal(0),
      vendor: { name: "Vendor" },
    };
    expect(mapPurchaseOrderListRow(po).orderDateLabel).toBe("Oct 4, 2026");
    expect(mapPurchaseOrderDetail(po).expectedDateLabel).toBe("Oct 12, 2026");
  });
});

describe("parseProductionDate (@db.Date productionDate)", () => {
  it("parses yyyy-mm-dd to UTC midnight", () => {
    expect(parseProductionDate("2026-10-04").toISOString()).toBe(
      "2026-10-04T00:00:00.000Z",
    );
  });

  it("falls back to the office's local today, even in the evening", () => {
    vi.useFakeTimers();
    vi.setSystemTime(EVENING);
    expect(parseProductionDate(undefined).toISOString()).toBe(
      "2026-10-04T00:00:00.000Z",
    );
    expect(parseProductionDate("not-a-date").toISOString()).toBe(
      "2026-10-04T00:00:00.000Z",
    );
  });
});

describe("day-value form helpers", () => {
  it("getOptionalDate parses to local midnight and rejects bad dates", () => {
    const form = new FormData();
    form.set("bidDate", "2026-10-04");
    form.set("bad", "2026-02-31");
    const date = getOptionalDate(form, "bidDate")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 9, 4, 0,
    ]);
    expect(getOptionalDate(form, "missing")).toBeNull();
    expect(() => getOptionalDate(form, "bad", "bid date")).toThrow(
      "Invalid bid date.",
    );
  });

  it("formatJobDateInput keeps an evening award stamp on its local day", () => {
    expect(formatJobDateInput(EVENING)).toBe("2026-10-04");
    expect(formatJobDateInput(null)).toBe("");
  });
});
