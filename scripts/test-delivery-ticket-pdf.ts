import { writeFileSync } from "fs";
import {
  buildDeliveryTicketFormData,
  type DbDeliveryTicketForPdf,
} from "@/lib/delivery-ticket-pdf-data";
import {
  generateDeliveryTicketCopyPdfBytes,
  generateDeliveryTicketPdfBytes,
  listDeliveryTicketFormFields,
} from "@/lib/delivery-ticket-pdf-fill";

const fillOptions = {
  copyTitles: ["Customer Copy", "Office Copy", "Driver Copy"] as [string, string, string],
};

const baseLineItems: DbDeliveryTicketForPdf["lineItems"] = [
  {
    itemCode: "MH-48",
    description: "48in Manhole with standard frame and cover",
    quantity: { toString: () => "2" },
    unit: "EA",
    totalWeight: null,
    jobStructure: null,
  },
  {
    itemCode: "R10-SS-5",
    description:
      "5 foot sanitary ring section with extended description that should wrap across multiple lines in the description column when rendered on the delivery ticket PDF form",
    quantity: { toString: () => "3" },
    unit: "EA",
    totalWeight: null,
    jobStructure: { structureNumber: "S-1", description: "Structure 1" },
  },
  {
    itemCode: "VALVE-12",
    description: "12 inch valve",
    quantity: { toString: () => "1" },
    unit: "EA",
    totalWeight: null,
    jobStructure: null,
  },
];

function buildMockTicket(
  overrides: Partial<DbDeliveryTicketForPdf> = {},
): DbDeliveryTicketForPdf {
  return {
    ticketNumber: "DT99999",
    customerName: "Sample Contractor",
    projectName: "Sample Job Site With A Long Project Name",
    deliveryAddress: "123 Main St\nPatchogue, NY 11772",
    siteContactName: "John Smith",
    siteContactPhone: "631-555-0100",
    jobNumber: "26-999",
    deliveryDate: new Date("2026-06-24"),
    driver: "Mike",
    truck: "Truck 1",
    trailer: "Flatbed Trailer",
    customerNotes: null,
    siteInstructions: "Enter from south gate",
    totalItems: 5,
    totalWeight: null,
    customer: null,
    quoteNumber: "Q-26-999-R0",
    quote: { customerPO: "PO-12345", revisionNumber: 0 },
    lineItems: baseLineItems,
    ...overrides,
  };
}

async function main() {
  const fields = await listDeliveryTicketFormFields();
  console.log(`Template fields (${fields.length}):`);
  for (const name of fields) {
    console.log(`  - ${name}`);
  }

  const originalTicket = buildMockTicket();
  const revisedTicket = buildMockTicket({
    ticketNumber: "DT99998",
    quoteNumber: "Q-26-999-R1",
    quote: { customerPO: "PO-12345", revisionNumber: 1 },
  });

  const originalForm = buildDeliveryTicketFormData(originalTicket, 1, fillOptions);
  const revisedForm = buildDeliveryTicketFormData(revisedTicket, 1, fillOptions);
  console.log("\nOriginal quote revision field:", JSON.stringify(originalForm["Quote Number"]));
  console.log("Revised quote revision field:", JSON.stringify(revisedForm["Quote Number"]));

  const copyBytes = await generateDeliveryTicketCopyPdfBytes(originalTicket, 1, fillOptions);
  writeFileSync("test-delivery-ticket-copy1.pdf", copyBytes);

  const revisedCopyBytes = await generateDeliveryTicketCopyPdfBytes(
    revisedTicket,
    1,
    fillOptions,
  );
  writeFileSync("test-delivery-ticket-rev1-copy1.pdf", revisedCopyBytes);

  const fullBytes = await generateDeliveryTicketPdfBytes(originalTicket, fillOptions);
  writeFileSync("test-delivery-ticket-full.pdf", fullBytes);

  console.log(
    "\nWrote test-delivery-ticket-copy1.pdf, test-delivery-ticket-rev1-copy1.pdf, and test-delivery-ticket-full.pdf",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
