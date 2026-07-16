import { describe, expect, it } from "vitest";
import {
  buildDeliveryTicketFormData,
  computeTotalPieces,
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

  it("combines the same ring SKU from multiple pool groups into one PDF row", () => {
    const ring = (qty: string): DbDeliveryTicketForPdf["lineItems"][number] => ({
      itemCode: "R10-D-1",
      description: `10' Drain Ring 1'`,
      quantity: { toString: () => qty },
      unit: "EA",
      totalWeight: null,
      jobStructure: null,
    });

    const rows = mapLineItemsForPdf([
      ring("2"),
      {
        itemCode: "VALVE-12",
        description: "12 inch valve",
        quantity: { toString: () => "1" },
        unit: "EA",
        totalWeight: null,
        jobStructure: null,
      },
      ring("3"),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ productCode: "R10-D-1", qty: "5" });
    expect(rows[1]).toMatchObject({ productCode: "VALVE-12", qty: "1" });
  });

  it("never merges structure lines, even with identical codes", () => {
    const structure = (
      structureNumber: string,
    ): DbDeliveryTicketForPdf["lineItems"][number] => ({
      itemCode: "CB-4X4",
      description: null,
      quantity: { toString: () => "1" },
      unit: "EA",
      totalWeight: null,
      jobStructure: { structureNumber, description: "Catch basin" },
    });

    // Same code and same resolved description ("Catch basin") on both rows.
    expect(mapLineItemsForPdf([structure("S-1"), structure("S-2")])).toHaveLength(2);
  });

  it("keeps rows with the same code but different descriptions separate", () => {
    const line = (
      description: string,
    ): DbDeliveryTicketForPdf["lineItems"][number] => ({
      itemCode: "MISC",
      description,
      quantity: { toString: () => "1" },
      unit: "EA",
      totalWeight: null,
      jobStructure: null,
    });

    expect(mapLineItemsForPdf([line("Gasket kit"), line("Sealant")])).toHaveLength(2);
  });

  it("counts LF pipe as sticks in the total pieces", () => {
    const lines: DbDeliveryTicketForPdf["lineItems"] = [
      {
        itemCode: "ADS-15-20-ST",
        description: "15in ADS 20ft",
        quantity: { toString: () => "160" },
        unit: "LF",
        totalWeight: null,
        jobStructure: null,
        product: { pipeLengthFeet: { toString: () => "20" } },
      },
      {
        itemCode: "MH-48",
        description: "Manhole",
        quantity: { toString: () => "2" },
        unit: "EA",
        totalWeight: null,
        jobStructure: null,
      },
    ];

    // 160 LF of 20' sticks = 8 pieces, plus 2 manholes.
    expect(computeTotalPieces(ticket({ lineItems: lines }))).toBe("10");
  });

  it("rounds partial pipe sticks up and leaves non-LF pipe lines alone", () => {
    const partial: DbDeliveryTicketForPdf["lineItems"][number] = {
      itemCode: "ADS-15-20-ST",
      description: "15in ADS 20ft",
      quantity: { toString: () => "150" },
      unit: "LF",
      totalWeight: null,
      jobStructure: null,
      product: { pipeLengthFeet: { toString: () => "20" } },
    };
    expect(computeTotalPieces(ticket({ lineItems: [partial] }))).toBe("8");

    const eaLine = { ...partial, unit: "EA", quantity: { toString: () => "3" } };
    expect(computeTotalPieces(ticket({ lineItems: [eaLine] }))).toBe("3");
  });

  it("strips the ADS joint-type suffix from printed descriptions", () => {
    const line = (
      description: string,
    ): DbDeliveryTicketForPdf["lineItems"][number] => ({
      itemCode: "ADS-15-20-ST",
      description,
      quantity: { toString: () => "20" },
      unit: "LF",
      totalWeight: null,
      jobStructure: null,
    });

    expect(
      mapLineItemsForPdf([line(`15" ADS 20' (Soiltight (ST))`)])[0]?.description,
    ).toBe(`15" ADS 20'`);
    expect(
      mapLineItemsForPdf([line(`15" ADS 20' (Watertight (WT)) — substitute`)])[0]
        ?.description,
    ).toBe(`15" ADS 20' — substitute`);
    expect(
      mapLineItemsForPdf([line("Soiltight fittings kit")])[0]?.description,
    ).toBe("Soiltight fittings kit");
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
