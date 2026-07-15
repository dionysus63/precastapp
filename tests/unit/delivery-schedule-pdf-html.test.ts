import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-settings", () => ({
  getAppSettings: vi.fn(async () => ({
    companyName: "Long Island Precast",
    companyAddress: "20 Stiriz Road",
    companyPhone: "631-555-0100",
    companyEmail: "office@example.com",
  })),
}));

vi.mock("@/lib/company-logo", () => ({
  getCompanyLogoDataUri: vi.fn(async () => null),
}));

import { buildDeliverySchedulePdfHtml } from "@/lib/delivery-schedule-pdf-html";
import type { JobDeliverySchedule } from "@/lib/delivery-schedule-data";

function schedule(): JobDeliverySchedule {
  return {
    job: {
      id: "job-1",
      jobNumber: "26-001",
      projectName: "Sample Project",
      customerName: "Sample Customer",
      projectAddress: "10 Main Street",
      city: "Brookhaven",
      state: "NY",
      zip: "11719",
      folderPath: null,
    },
    tickets: [
      {
        id: "ticket-1",
        ticketNumber: "DT-1001",
        status: "SCHEDULED",
        loadSequence: "Load 1",
        deliveryDate: new Date(2026, 6, 14),
        deliveryTime: "08:00",
        trailer: "Lowboy",
        driver: "Mike",
        totalItems: 1,
        totalWeight: 1_000 as never,
        createdAt: new Date(2026, 6, 1),
        updatedAt: new Date(2026, 6, 1),
        lineItems: [
          {
            itemCode: "RA-E12",
            description: `12" Extension`,
            quantity: 1 as never,
          },
        ],
      },
    ],
  };
}

describe("delivery schedule PDF", () => {
  it("shows driver and trailer without a truck column on the internal copy", async () => {
    const html = await buildDeliverySchedulePdfHtml(schedule(), "internal");

    expect(html).toContain("<th>Trailer</th><th>Driver</th><th>Status</th>");
    expect(html).not.toContain("<th>Truck</th>");
    expect(html).toContain("<td>Lowboy</td>");
    expect(html).toContain("<td>Mike</td>");
    expect(html).toContain('<td colspan="3"></td>');
  });
});
