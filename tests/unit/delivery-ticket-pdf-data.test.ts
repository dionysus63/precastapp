import { describe, expect, it } from "vitest";
import {
  buildDeliveryTicketFormData,
  mapDbDeliveryTicketToPdfView,
  mapLineItemsForPdf,
  type DbDeliveryTicketForPdf,
} from "@/lib/delivery-ticket-pdf-data";
import { generateDeliveryTicketCopyPdfBytes } from "@/lib/delivery-ticket-pdf-fill";
import { toPickupCopyTitles } from "@/lib/delivery-ticket-pdf-pickup";

const fillOptions = {
  copyTitles: ["Customer Copy", "Office Copy", "Driver Copy"] as [
    string,
    string,
    string,
  ],
};

function ticket(
  overrides: Partial<DbDeliveryTicketForPdf> = {},
): DbDeliveryTicketForPdf {
  return {
    ticketNumber: "DT10001",
    customerName: "Sample Contractor",
    projectName: "Sample Project",
    deliveryAddress: "10 Ticket Lane\nTicket Town, NY 11700",
    siteContactName: "Site Contact",
    siteContactPhone: "631-555-0100",
    jobNumber: "26-001",
    deliveryDate: new Date(2026, 6, 14),
    driver: "Driver 1",
    trailer: "Trailer 1",
    customerNotes: null,
    siteInstructions: "Use the south gate",
    totalItems: 0,
    totalWeight: null,
    customer: null,
    job: {
      projectAddress: "20 Job Road",
      city: "Job Town",
      state: "NY",
      zip: "11701",
    },
    quoteNumber: "Q-26-001-R3",
    quote: {
      customerPO: "PO-100",
      termsAndConditions: "Net 30",
      projectAddress: "30 Quote Street\nQuote Town, NY 11702",
    },
    lineItems: [],
    ...overrides,
  };
}

describe("delivery ticket PDF form data", () => {
  it("uses the ticket address and quote terms without a quote revision field", () => {
    const data = buildDeliveryTicketFormData(ticket(), 1, fillOptions);

    expect(data["Delivery Address 1"]).toBe("10 Ticket Lane");
    expect(data["Delivery Address 2"]).toBe("Ticket Town, NY 11700");
    expect(data.Terms).toBe("Net 30");
    expect(data["Driver/Truck"]).toBe("Driver 1");
    expect(data).not.toHaveProperty("Quote Number");
  });

  it("ignores a legacy truck value and populates only the driver", () => {
    const legacyTicket = {
      ...ticket(),
      truck: "Legacy Truck 1",
    };

    expect(
      buildDeliveryTicketFormData(legacyTicket, 1, fillOptions)[
        "Driver/Truck"
      ],
    ).toBe("Driver 1");
  });

  it("draws the replacement Driver caption into the generated PDF", async () => {
    const pdfBytes = await generateDeliveryTicketCopyPdfBytes(
      ticket(),
      1,
      fillOptions,
    );
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: pdfBytes,
    });
    const pdf = await loadingTask.promise;

    try {
      const page = await pdf.getPage(1);
      const text = await page.getTextContent();
      const labels = text.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean);

      expect(labels).toContain("Driver");
      expect(labels).not.toContain("Legacy Truck 1");
    } finally {
      await loadingTask.destroy();
    }
  });

  it("falls back to the linked job address when the ticket address is blank", () => {
    const data = buildDeliveryTicketFormData(
      ticket({ deliveryAddress: "  \n " }),
      1,
      fillOptions,
    );

    expect(data["Delivery Address 1"]).toBe("20 Job Road");
    expect(data["Delivery Address 2"]).toBe("Job Town, NY 11701");
  });

  it("falls back to the quote project address when the ticket and job are blank", () => {
    const data = buildDeliveryTicketFormData(
      ticket({
        deliveryAddress: null,
        job: {
          projectAddress: null,
          city: null,
          state: null,
          zip: null,
        },
      }),
      1,
      fillOptions,
    );

    expect(data["Delivery Address 1"]).toBe("30 Quote Street");
    expect(data["Delivery Address 2"]).toBe("Quote Town, NY 11702");
  });

  it("leaves terms blank when the ticket has no linked quote", () => {
    const data = buildDeliveryTicketFormData(
      ticket({ quote: null }),
      1,
      fillOptions,
    );

    expect(data.Terms).toBe("");
    expect(data).not.toHaveProperty("Quote Number");
  });

  it("blanks site contact, driver, and trailer for pickup tickets", () => {
    const data = buildDeliveryTicketFormData(
      ticket({ fulfillmentMethod: "PICKUP" }),
      1,
      fillOptions,
    );

    expect(data["Site Contact"]).toBe("");
    expect(data["Site Contact Phone"]).toBe("");
    expect(data["Driver/Truck"]).toBe("");
    expect(data.Trailer).toBe("");
    // Everything else fills as usual.
    expect(data["Contractor Name"]).toBe("Sample Contractor");
    expect(data["Delivery Address 1"]).toBe("10 Ticket Lane");
  });

  it("swaps the driver copy title for the yard copy on pickups", () => {
    expect(toPickupCopyTitles(fillOptions.copyTitles)).toEqual([
      "Customer Copy",
      "Office Copy",
      "Yard Copy",
    ]);
  });

  it("renders the pickup layout for pickup tickets", async () => {
    const pdfBytes = await generateDeliveryTicketCopyPdfBytes(
      ticket({ fulfillmentMethod: "PICKUP" }),
      3,
      fillOptions,
    );
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    try {
      const page = await pdf.getPage(1);
      const text = await page.getTextContent();
      const labels = text.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean);
      const joined = labels.join(" ");

      expect(labels).toContain("Pickup Ticket");
      expect(labels).toContain("Pickup Date");
      expect(labels).toContain("Yard Copy");
      expect(joined).toContain("this pickup ticket by the customer");
      // Values for the dropped fields never fill, even when set on the ticket.
      expect(joined).not.toContain("Driver 1");
      expect(joined).not.toContain("Trailer 1");
      expect(joined).not.toContain("631-555-0100");
    } finally {
      await loadingTask.destroy();
    }
  });

  it("removes a trailing ring-height suffix from PDF descriptions", () => {
    const ringLine: DbDeliveryTicketForPdf["lineItems"][number] = {
      itemCode: "R-3-DRAIN",
      description: `3' Drain Ring (3' Ring)`,
      quantity: { toString: () => "2" },
      unit: "EA",
      totalWeight: null,
      jobStructure: null,
    };

    expect(mapLineItemsForPdf([ringLine])[0]?.description).toBe(
      `3' Drain Ring`,
    );
    expect(
      mapDbDeliveryTicketToPdfView(ticket({ lineItems: [ringLine] })).lineItems[0]
        ?.description,
    ).toBe(`3' Drain Ring`);
  });

  it("preserves ring-height text that is not a trailing label", () => {
    const line: DbDeliveryTicketForPdf["lineItems"][number] = {
      itemCode: "MISC-1",
      description: `Special bracket (3' Ring) required at assembly`,
      quantity: { toString: () => "1" },
      unit: "EA",
      totalWeight: null,
      jobStructure: null,
    };

    expect(mapLineItemsForPdf([line])[0]?.description).toBe(
      `Special bracket (3' Ring) required at assembly`,
    );
  });
});
