import { describe, expect, it } from "vitest";
import {
  buildJobMoney,
  buildPaperwork,
  buildStockItemsOwed,
  CONSTRUCTION_PLANS_CATEGORY,
  formatLoadDate,
  signedCopyState,
  sortStructuresForOverview,
  summarizeLoadItems,
} from "@/lib/job-overview";
import {
  PURCHASE_ORDERS_CATEGORY,
  TAX_EXEMPT_CERT_CATEGORY,
} from "@/lib/job-folder-constants";

describe("formatLoadDate", () => {
  const now = new Date(2026, 10, 15);

  it("writes the weekday, month and day for a date this year", () => {
    expect(formatLoadDate(new Date(2026, 10, 16), now)).toBe("Mon, Nov 16");
  });

  it("adds the year when it is not this year", () => {
    expect(formatLoadDate(new Date(2025, 11, 30), now)).toBe(
      "Tue, Dec 30, 2025",
    );
  });

  it("shows a dash for a planned load with no date", () => {
    expect(formatLoadDate(null, now)).toBe("—");
  });
});

describe("summarizeLoadItems", () => {
  const line = (
    itemCode: string,
    description: string | null,
    quantity: number,
    jobStructureId: string | null = null,
  ) => ({ itemCode, description, quantity, jobStructureId });

  it("names structures by their number and other lines by description", () => {
    expect(
      summarizeLoadItems([
        line("DMH-3", "4' Dia Manhole", 1, "s1"),
        line("RING-84", "8' x 4' Drain Ring", 6),
      ]),
    ).toBe("DMH-3, (6) 8' x 4' Drain Ring");
  });

  it("cuts a long load off after four lines", () => {
    expect(
      summarizeLoadItems(
        ["A", "B", "C", "D", "E", "F"].map((code) => line(code, null, 1, code)),
      ),
    ).toBe("A, B, C, D +2 more");
  });

  it("shows a dash for a load with nothing on it", () => {
    expect(summarizeLoadItems([])).toBe("—");
  });
});

describe("signedCopyState", () => {
  const ticket = (
    status: string,
    hasSignedFile = false,
    closedWithoutSignedCopy = false,
  ) => ({ status, hasSignedFile, closedWithoutSignedCopy });

  it("expects no signed copy before the load is delivered", () => {
    expect(signedCopyState(ticket("SCHEDULED"))).toBe("not-due");
    // A copy scanned early still is not asked for.
    expect(signedCopyState(ticket("IN_TRANSIT", true))).toBe("not-due");
  });

  it("tells a scanned copy from a missing one and a closed one", () => {
    expect(signedCopyState(ticket("DELIVERED", true))).toBe("in");
    expect(signedCopyState(ticket("DELIVERED"))).toBe("not-in");
    expect(signedCopyState(ticket("DELIVERED", false, true))).toBe("closed");
  });
});

describe("sortStructuresForOverview", () => {
  it("puts what is furthest behind first, then orders by number", () => {
    const sorted = sortStructuresForOverview([
      { status: "SHIPPED", structureNumber: "CB-1" },
      { status: "NOT_SUBMITTED", structureNumber: "DMH-10" },
      { status: "MADE", structureNumber: "CB-2" },
      { status: "NOT_SUBMITTED", structureNumber: "DMH-2" },
    ]);
    expect(sorted.map((row) => row.structureNumber)).toEqual([
      "DMH-2",
      "DMH-10",
      "CB-2",
      "CB-1",
    ]);
  });
});

describe("buildJobMoney", () => {
  it("adds up won, invoiced and paid, leaving void invoices out", () => {
    expect(
      buildJobMoney(
        [
          { status: "WON", total: "10000" },
          { status: "LOST", total: "9000" },
        ],
        [
          { status: "PAID", total: "2500" },
          { status: "SENT", total: "1500" },
          { status: "VOID", total: "700" },
        ],
      ),
    ).toEqual({
      won: "$10,000.00",
      invoiced: "$4,000.00",
      paid: "$2,500.00",
      leftToInvoice: "$6,000.00",
    });
  });

  it("has no won or left-to-invoice figure for a job without a won quote", () => {
    const money = buildJobMoney([], [{ status: "SENT", total: "1500" }]);
    expect(money.won).toBeNull();
    expect(money.leftToInvoice).toBeNull();
    expect(money.invoiced).toBe("$1,500.00");
  });

  it("never shows a negative amount left to invoice", () => {
    expect(
      buildJobMoney(
        [{ status: "WON", total: "1000" }],
        [{ status: "SENT", total: "1200" }],
      ).leftToInvoice,
    ).toBe("$0.00");
  });
});

describe("buildStockItemsOwed", () => {
  const line = (overrides: Record<string, unknown>) => ({
    quoteLineItemId: "line",
    lineType: "PRODUCT",
    itemCode: "RING-84",
    description: "8' x 4' Drain Ring",
    displayName: "8' x 4' Drain Ring",
    awardedQty: "24",
    shippedQty: "6",
    remainingQty: "18",
    stockLevel: "10",
    jobStructureId: null,
    ...overrides,
  });

  it("lists items with some left to ship and flags short stock", () => {
    const items = buildStockItemsOwed([
      line({ quoteLineItemId: "a" }),
      line({ quoteLineItemId: "b", remainingQty: "0", shippedQty: "24" }),
      line({ quoteLineItemId: "c", stockLevel: "40" }),
    ]);
    expect(items?.map((item) => [item.key, item.left, item.short])).toEqual([
      ["a", "18", true],
      ["c", "18", false],
    ]);
  });

  it("leaves out structures, notes and delivery charges", () => {
    expect(
      buildStockItemsOwed([
        line({ jobStructureId: "s1" }),
        line({ lineType: "NOTE" }),
        line({ lineType: "SERVICE" }),
      ]),
    ).toBeNull();
  });

  it("returns an empty list when every stock item has shipped", () => {
    expect(
      buildStockItemsOwed([line({ remainingQty: "0", shippedQty: "24" })]),
    ).toEqual([]);
  });
});

describe("buildPaperwork", () => {
  const file = (
    id: string,
    folderCategory: string,
    updatedAt: Date,
    fileName = `${id}.pdf`,
  ) => ({ id, fileName, folderCategory, updatedAt });

  it("shows the newest PO and tax cert and counts the other folders", () => {
    const rows = buildPaperwork([
      file("po-old", PURCHASE_ORDERS_CATEGORY, new Date(2026, 9, 1)),
      file("po-new", PURCHASE_ORDERS_CATEGORY, new Date(2026, 10, 1)),
      file("plan-1", CONSTRUCTION_PLANS_CATEGORY, new Date(2026, 9, 5)),
      file("plan-2", CONSTRUCTION_PLANS_CATEGORY, new Date(2026, 9, 6)),
      file("misc", "05 Photos", new Date(2026, 9, 7)),
    ]);
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

    expect(rows.map((row) => row.key)).toEqual([
      "purchase-orders",
      "tax-exempt-cert",
      "construction-plans",
      "files",
    ]);
    expect(byKey["purchase-orders"].newestFile?.id).toBe("po-new");
    expect(byKey["tax-exempt-cert"].folderCategory).toBe(
      TAX_EXEMPT_CERT_CATEGORY,
    );
    expect(byKey["tax-exempt-cert"].newestFile).toBeNull();
    expect(byKey["construction-plans"].fileCount).toBe(2);
    expect(byKey["files"].fileCount).toBe(5);
    expect(byKey["files"].folderCategory).toBeNull();
  });
});
