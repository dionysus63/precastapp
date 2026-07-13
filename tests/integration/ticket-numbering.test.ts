import { afterAll, describe, expect, it } from "vitest";
import {
  allocateDeliveryTicketNumber,
  deriveInvoiceNumberFromTicket,
  formatTicketNumber,
  GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR,
} from "@/lib/delivery-ticket-number";
import { getAppSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

async function setNumberingSettings(prefix: string, start: number) {
  await prisma.appSettings.update({
    where: { id: "default" },
    data: { ticketNumberPrefix: prefix, ticketNumberStart: start },
  });
}

afterAll(async () => {
  // Leave the scratch settings at the defaults for other suites.
  await getAppSettings();
  await setNumberingSettings("T", 10001);
});

describe("ticket number allocation", () => {
  it("allocates monotonic prefixed numbers from the global counter", async () => {
    await getAppSettings(); // materialize the settings row

    const first = await prisma.$transaction((tx) =>
      allocateDeliveryTicketNumber(tx),
    );
    const second = await prisma.$transaction((tx) =>
      allocateDeliveryTicketNumber(tx),
    );

    expect(first.ticketNumber).toMatch(/^T\d{5,}$/);
    expect(second.sequenceNumber).toBe(first.sequenceNumber + 1);
    expect(second.ticketNumber).toBe(
      formatTicketNumber("T", first.sequenceNumber + 1),
    );
  });

  it("jumps forward when the starting number is raised, never backward", async () => {
    const current = await prisma.deliveryTicketSequence.findUnique({
      where: { year: GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR },
    });
    const jumpTo = (current?.lastNumber ?? 10001) + 500;

    await setNumberingSettings("T", jumpTo);
    const jumped = await prisma.$transaction((tx) =>
      allocateDeliveryTicketNumber(tx),
    );
    expect(jumped.sequenceNumber).toBe(jumpTo);

    // Lowering the start must not reissue earlier numbers.
    await setNumberingSettings("T", 1);
    const after = await prisma.$transaction((tx) =>
      allocateDeliveryTicketNumber(tx),
    );
    expect(after.sequenceNumber).toBe(jumpTo + 1);
  });

  it("uses the configured prefix", async () => {
    await setNumberingSettings("TK", 10001);
    const allocated = await prisma.$transaction((tx) =>
      allocateDeliveryTicketNumber(tx),
    );
    expect(allocated.ticketNumber).toBe(
      formatTicketNumber("TK", allocated.sequenceNumber),
    );
  });
});

describe("invoice numbers derive from ticket numbers", () => {
  it("swaps the prefix and keeps the digits", () => {
    expect(deriveInvoiceNumberFromTicket("T10024", "I")).toEqual({
      invoiceNumber: "I10024",
      sequenceNumber: 10024,
    });
  });

  it("handles the old DT prefix from before the rename", () => {
    expect(deriveInvoiceNumberFromTicket("DT10005", "I")).toEqual({
      invoiceNumber: "I10005",
      sequenceNumber: 10005,
    });
  });

  it("returns null for legacy year-based formats", () => {
    expect(deriveInvoiceNumberFromTicket("DT-26-0311", "I")).toBeNull();
    expect(deriveInvoiceNumberFromTicket("", "I")).toBeNull();
  });
});
