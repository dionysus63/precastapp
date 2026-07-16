import { writeFileSync } from "fs";
import type { DbDeliveryTicketForPdf } from "@/lib/delivery-ticket-pdf-data";
import {
  generateDeliveryTicketCopyPdfBytes,
  generateDeliveryTicketPdfBytes,
} from "@/lib/delivery-ticket-pdf-fill";

const fillOptions = {
  copyTitles: ["Customer Copy", "Office Copy", "Driver Copy"] as [string, string, string],
};

function buildMockPickupTicket(
  overrides: Partial<DbDeliveryTicketForPdf> = {},
): DbDeliveryTicketForPdf {
  return {
    ticketNumber: "PU10001",
    fulfillmentMethod: "PICKUP",
    customerName: "Sample Contractor",
    projectName: "Yard Pickup — Sample Job",
    deliveryAddress: "123 Main St\nPatchogue, NY 11772",
    siteContactName: "John Smith",
    siteContactPhone: "631-555-0100",
    jobNumber: "26-999",
    deliveryDate: new Date("2026-07-16T12:00:00"),
    driver: "Mike",
    trailer: "Flatbed Trailer",
    customerNotes: null,
    siteInstructions: "Check in at the office before loading.",
    totalItems: 3,
    totalWeight: null,
    customer: null,
    job: {
      projectAddress: "123 Main St",
      city: "Patchogue",
      state: "NY",
      zip: "11772",
    },
    quoteNumber: "Q-26-999-R0",
    quote: {
      customerPO: "PO-12345",
      termsAndConditions: "Standard Precast Terms",
      projectAddress: "123 Main St\nPatchogue, NY 11772",
    },
    lineItems: [
      {
        itemCode: "MH-48",
        description: "48in Manhole with standard frame and cover",
        quantity: { toString: () => "2" },
        unit: "EA",
        totalWeight: null,
        jobStructure: null,
      },
      {
        itemCode: "VALVE-12",
        description: "12 inch valve",
        quantity: { toString: () => "1" },
        unit: "EA",
        totalWeight: null,
        jobStructure: null,
      },
    ],
    ...overrides,
  };
}

async function main() {
  const outDir = process.argv[2] ?? ".";
  const ticket = buildMockPickupTicket();

  // Driver/site-contact values are set on the mock intentionally: the pickup
  // layout must blank them even when present on the ticket.
  const copyBytes = await generateDeliveryTicketCopyPdfBytes(ticket, 1, fillOptions);
  writeFileSync(`${outDir}/test-pickup-ticket-copy1.pdf`, copyBytes);

  const fullBytes = await generateDeliveryTicketPdfBytes(ticket, fillOptions);
  writeFileSync(`${outDir}/test-pickup-ticket-full.pdf`, fullBytes);

  console.log(
    `Wrote ${outDir}/test-pickup-ticket-copy1.pdf and ${outDir}/test-pickup-ticket-full.pdf`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
