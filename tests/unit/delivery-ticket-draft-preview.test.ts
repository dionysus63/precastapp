import { describe, expect, it } from "vitest";
import {
  buildDraftTicketForPdf,
  DRAFT_PREVIEW_MAX_LINES,
  parseDraftPreviewInput,
  type DeliveryTicketDraftPreviewInput,
  type DraftPreviewLookups,
} from "@/lib/delivery-ticket-draft-preview";
import {
  buildDeliveryTicketFormData,
  computeTotalPieces,
  mapLineItemsForPdf,
} from "@/lib/delivery-ticket-pdf-data";
import { generateDeliveryTicketCopyPdfBytes } from "@/lib/delivery-ticket-pdf-fill";

const fillOptions = {
  copyTitles: ["Customer Copy", "Office Copy", "Driver Copy"] as [
    string,
    string,
    string,
  ],
};

function draft(
  overrides: Partial<DeliveryTicketDraftPreviewInput> = {},
): DeliveryTicketDraftPreviewInput {
  return {
    ticketId: null,
    ticketType: "JOB",
    fulfillmentMethod: "DELIVERY",
    jobId: "job-1",
    quoteId: "quote-1",
    customerId: "customer-1",
    jobNumber: "26-001",
    customerName: "Sample Contractor",
    projectName: "Sample Project",
    deliveryDate: "2026-07-14",
    driver: "Mike",
    trailer: "Flatbed",
    customLine: "1st",
    lines: [],
    ...overrides,
  };
}

function lookups(overrides: Partial<DraftPreviewLookups> = {}): DraftPreviewLookups {
  return {
    saved: null,
    job: {
      deliveryAddress: null,
      projectAddress: "20 Job Road",
      city: "Job Town",
      state: "NY",
      zip: "11701",
      siteContactName: null,
      siteContactPhone: null,
      siteContactEmail: null,
    },
    quote: {
      customerPO: "PO-100",
      termsAndConditions: "Net 30",
      projectAddress: null,
    },
    defaultSiteContact: null,
    structuresById: new Map(),
    productsById: new Map(),
    ...overrides,
  };
}

describe("parseDraftPreviewInput", () => {
  it("survives junk and keeps only printable lines", () => {
    expect(parseDraftPreviewInput(null).lines).toEqual([]);
    expect(parseDraftPreviewInput("nope").ticketType).toBe("JOB");

    const parsed = parseDraftPreviewInput({
      ticketType: "JOB",
      fulfillmentMethod: "DELIVERY",
      jobId: " job-1 ",
      customerName: "  Sample Contractor ",
      projectName: 42,
      lines: [
        { itemCode: "A", quantity: 2, unit: "", weightEach: "heavy" },
        { itemCode: "zero", quantity: 0 },
        { itemCode: "text", quantity: "3" },
        null,
      ],
    });
    expect(parsed.jobId).toBe("job-1");
    expect(parsed.customerName).toBe("Sample Contractor");
    expect(parsed.projectName).toBe("");
    expect(parsed.lines).toEqual([
      {
        productId: null,
        jobStructureId: null,
        itemCode: "A",
        description: null,
        quantity: 2,
        unit: "EA",
        weightEach: null,
      },
    ]);
  });

  it("treats a walk-in as a pickup with no job or quote", () => {
    const parsed = parseDraftPreviewInput({
      ticketType: "WALK_IN",
      fulfillmentMethod: "DELIVERY",
      jobId: "job-1",
      quoteId: "quote-1",
      lines: [],
    });
    expect(parsed.fulfillmentMethod).toBe("PICKUP");
    expect(parsed.jobId).toBeNull();
    expect(parsed.quoteId).toBeNull();
  });

  it("caps the number of lines", () => {
    const parsed = parseDraftPreviewInput({
      lines: Array.from({ length: DRAFT_PREVIEW_MAX_LINES + 50 }, () => ({
        itemCode: "A",
        quantity: 1,
      })),
    });
    expect(parsed.lines).toHaveLength(DRAFT_PREVIEW_MAX_LINES);
  });
});

describe("buildDraftTicketForPdf", () => {
  it("prints a new ticket as DRAFT with the screen's values", () => {
    const ticket = buildDraftTicketForPdf(
      draft(),
      lookups({
        defaultSiteContact: { name: "Field Contact", phone: "631-555-0100" },
      }),
    );
    const form = buildDeliveryTicketFormData(ticket, 1, fillOptions);

    expect(form["Delivery Ticket Number"]).toBe("DRAFT");
    expect(form["Contractor Name"]).toBe("Sample Contractor");
    expect(form["Job Name"]).toBe("Sample Project");
    expect(form["Job Number"]).toBe("26-001");
    expect(form["Ship Date"]).toBe("7/14/2026");
    expect(form["Driver/Truck"]).toBe("Mike");
    expect(form.Trailer).toBe("Flatbed");
    expect(form["Purchase Order Number"]).toBe("PO-100");
    expect(form.Terms).toBe("Net 30");
    // No address of its own yet: the job's postal address.
    expect(form["Delivery Address 1"]).toBe("20 Job Road");
    expect(form["Delivery Address 2"]).toBe("Job Town, NY 11701");
    // What a save would default the site contact to.
    expect(form["Site Contact"]).toBe("Field Contact");
    expect(form["Site Contact Phone"]).toBe("631-555-0100");
    expect(ticket.customLine).toBe("1st");
  });

  it("lets the job's own site contact win over the default", () => {
    const base = lookups();
    const ticket = buildDraftTicketForPdf(
      draft(),
      lookups({
        job: {
          ...base.job!,
          deliveryAddress: "Gate 4, Yard Road",
          siteContactName: "Job Super",
          siteContactPhone: "631-555-0199",
        },
        defaultSiteContact: { name: "Field Contact", phone: "631-555-0100" },
      }),
    );
    const form = buildDeliveryTicketFormData(ticket, 1, fillOptions);
    expect(form["Site Contact"]).toBe("Job Super");
    expect(form["Site Contact Phone"]).toBe("631-555-0199");
    expect(form["Delivery Address 1"]).toBe("Gate 4, Yard Road");
  });

  it("keeps what the saved ticket holds that the editor doesn't show", () => {
    const ticket = buildDraftTicketForPdf(
      draft({ ticketId: "ticket-1", driver: "Sal" }),
      lookups({
        saved: {
          ticketNumber: "T10189",
          deliveryAddress: "5 Ticket Lane\nTicket Town, NY 11700",
          siteContactName: "Saved Contact",
          siteContactPhone: "631-555-0111",
          siteInstructions: "Use the south gate",
          customerNotes: null,
        },
        // Never applies to a saved ticket.
        defaultSiteContact: { name: "Field Contact", phone: "631-555-0100" },
      }),
    );
    const form = buildDeliveryTicketFormData(ticket, 1, fillOptions);
    expect(form["Delivery Ticket Number"]).toBe("T10189");
    expect(form["Delivery Address 1"]).toBe("5 Ticket Lane");
    expect(form["Site Contact"]).toBe("Saved Contact");
    expect(form.Notes).toBe("Use the south gate");
    // The unsaved change on screen.
    expect(form["Driver/Truck"]).toBe("Sal");
  });

  it("carries the lines with their structures and products", () => {
    const ticket = buildDraftTicketForPdf(
      draft({
        lines: [
          {
            productId: null,
            jobStructureId: "structure-1",
            itemCode: "MH-1",
            description: null,
            quantity: 1,
            unit: "EA",
            weightEach: 9000,
          },
          {
            productId: "pipe-1",
            jobStructureId: null,
            itemCode: "ADS-12",
            description: "12\" ADS pipe",
            quantity: 160,
            unit: "LF",
            weightEach: 3,
          },
        ],
      }),
      lookups({
        structuresById: new Map([
          ["structure-1", { structureNumber: "MH-1", description: "5' Manhole" }],
        ]),
        productsById: new Map([["pipe-1", { pipeLengthFeet: 20 }]]),
      }),
    );

    expect(mapLineItemsForPdf(ticket.lineItems)).toEqual([
      { qty: "1", unit: "EA", productCode: "MH-1", description: "5' Manhole" },
      { qty: "160", unit: "LF", productCode: "ADS-12", description: "12\" ADS pipe" },
    ]);
    // 1 structure + 160 LF in 20' sticks.
    expect(computeTotalPieces(ticket)).toBe("9");
    expect(ticket.totalWeight).toBe(9480);
  });

  it("drops the custom line and site details on a walk-in pickup", () => {
    const ticket = buildDraftTicketForPdf(
      draft({
        ticketType: "WALK_IN",
        fulfillmentMethod: "PICKUP",
        jobId: null,
        quoteId: null,
        jobNumber: null,
        projectName: "Walk-in sale",
      }),
      lookups({ job: null, quote: null }),
    );
    const form = buildDeliveryTicketFormData(ticket, 1, fillOptions);
    expect(ticket.customLine).toBeNull();
    expect(form["Site Contact"]).toBe("");
    expect(form["Driver/Truck"]).toBe("");
    expect(form["Job Name"]).toBe("Walk-in sale");
  });

  it("fills the real template from a draft", async () => {
    const ticket = buildDraftTicketForPdf(
      draft({
        lines: [
          {
            productId: null,
            jobStructureId: null,
            itemCode: "RISER-6",
            description: "6\" riser",
            quantity: 4,
            unit: "EA",
            weightEach: 310,
          },
        ],
      }),
      lookups(),
    );
    const bytes = await generateDeliveryTicketCopyPdfBytes(ticket, 1, fillOptions);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
