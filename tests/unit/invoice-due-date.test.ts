import { describe, expect, it } from "vitest";
import { invoiceDueDateFromDelivery } from "@/lib/invoicing-service";

describe("invoiceDueDateFromDelivery", () => {
  it("is one calendar month after the delivery date", () => {
    const due = invoiceDueDateFromDelivery(
      new Date(2026, 6, 14), // Jul 14
      new Date(2026, 6, 21),
    );
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(7); // Aug
    expect(due.getDate()).toBe(14);
  });

  it("clamps to the last day of shorter months", () => {
    const due = invoiceDueDateFromDelivery(
      new Date(2026, 0, 31), // Jan 31
      new Date(2026, 0, 31),
    );
    expect(due.getMonth()).toBe(1); // Feb
    expect(due.getDate()).toBe(28);
  });

  it("rolls across year end", () => {
    const due = invoiceDueDateFromDelivery(
      new Date(2026, 11, 15), // Dec 15
      new Date(2026, 11, 15),
    );
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(0); // Jan
    expect(due.getDate()).toBe(15);
  });

  it("falls back to the given date when no delivery date exists", () => {
    const due = invoiceDueDateFromDelivery(null, new Date(2026, 6, 21));
    expect(due.getMonth()).toBe(7); // Aug
    expect(due.getDate()).toBe(21);
  });
});
