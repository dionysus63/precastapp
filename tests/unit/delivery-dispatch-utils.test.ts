import { describe, expect, it } from "vitest";
import { getTodaysScheduledLoads } from "@/lib/delivery-dispatch-utils";
import type { DeliveryTicketRow } from "@/components/delivery-tickets/delivery-ticket-utils";

function row(overrides: Partial<DeliveryTicketRow>): DeliveryTicketRow {
  return {
    id: "t1",
    ticketNumber: "DT1",
    jobId: null,
    jobNumber: "26-001",
    projectName: "Project",
    customer: "Customer",
    deliveryDate: "07/15/2026",
    deliveryDateIso: "2026-07-15",
    deliveryTime: null,
    driver: "—",
    trailer: "—",
    status: "SCHEDULED",
    statusVariant: "info",
    items: 1,
    totalWeight: "—",
    ...overrides,
  };
}

describe("getTodaysScheduledLoads", () => {
  const reference = new Date(2026, 6, 15);

  it("keeps delivered loads for the day, pinned above open loads", () => {
    const loads = getTodaysScheduledLoads(
      [
        row({ id: "a", ticketNumber: "DT2", status: "SCHEDULED" }),
        row({ id: "b", ticketNumber: "DT1", status: "DELIVERED" }),
        row({ id: "c", ticketNumber: "DT3", status: "IN_TRANSIT" }),
      ],
      reference,
    );
    expect(loads.map((load) => load.ticketNumber)).toEqual([
      "DT1",
      "DT2",
      "DT3",
    ]);
  });

  it("excludes drafts, cancelled, and other days", () => {
    const loads = getTodaysScheduledLoads(
      [
        row({ id: "a", status: "DRAFT" }),
        row({ id: "b", status: "CANCELLED" }),
        row({ id: "c", status: "DELIVERED", deliveryDateIso: "2026-07-14" }),
        row({ id: "d", status: "SCHEDULED", deliveryDateIso: null }),
      ],
      reference,
    );
    expect(loads).toEqual([]);
  });
});
