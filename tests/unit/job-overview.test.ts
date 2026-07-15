import { describe, expect, it } from "vitest";
import { buildJobOverview } from "@/lib/job-detail-mapper";

const updatedAt = new Date("2026-07-14T12:00:00Z");

function structure(
  id: string,
  status:
    | "NOT_SUBMITTED"
    | "SUBMITTED"
    | "APPROVED"
    | "IN_PRODUCTION"
    | "MADE"
    | "SHIPPED",
) {
  return {
    id,
    structureNumber: id.toUpperCase(),
    status,
    needsSubmittal: true,
    updatedAt,
  };
}

describe("job overview submittal attention", () => {
  it("does not flag submitted or approved structures as needing a submittal", () => {
    const overview = buildJobOverview("job-1", "C:\\Jobs\\26-001", {
      quotes: [],
      deliveryTickets: [],
      invoices: [],
      structures: [
        structure("submitted", "SUBMITTED"),
        structure("approved", "APPROVED"),
        structure("production", "IN_PRODUCTION"),
        structure("made", "MADE"),
        structure("shipped", "SHIPPED"),
      ],
    });

    expect(overview.attentionItems).toEqual([]);
  });

  it("continues to flag required submittals that are not submitted", () => {
    const overview = buildJobOverview("job-1", "C:\\Jobs\\26-001", {
      quotes: [],
      deliveryTickets: [],
      invoices: [],
      structures: [
        structure("outstanding", "NOT_SUBMITTED"),
        structure("approved", "APPROVED"),
      ],
    });

    expect(overview.attentionItems).toContainEqual({
      key: "submittals",
      label: "1 structure needs a submittal",
      tab: "production",
      tone: "warning",
    });
  });
});
