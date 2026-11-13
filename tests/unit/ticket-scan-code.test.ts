import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import type { DbDeliveryTicketForPdf } from "@/lib/delivery-ticket-pdf-data";
import {
  generateDeliveryTicketCopyPdfBytes,
  generateDeliveryTicketPdfBytes,
} from "@/lib/delivery-ticket-pdf-fill";
import {
  buildQrModulePath,
  SCAN_CODE_SIZE,
  ticketPageScanCodeText,
} from "@/lib/delivery-ticket-pdf-scan-code";
import {
  buildTicketScanCode,
  parseTicketScanCode,
  ticketScanCheck,
  ticketScanCheckMatches,
} from "@/lib/ticket-scan-code";

const fillOptions = {
  copyTitles: ["Customer Copy", "Office Copy", "Driver Copy"] as [
    string,
    string,
    string,
  ],
};

const TICKET_ID = "cmh2k9x1p0003abcdk3f9q2";

function line(index: number): DbDeliveryTicketForPdf["lineItems"][number] {
  return {
    itemCode: `MH-${index}`,
    description: "48in manhole base with riser, cone, frame and cover",
    quantity: { toString: () => "1" },
    unit: "EA",
    totalWeight: null,
    jobStructure: null,
  };
}

function ticket(
  overrides: Partial<DbDeliveryTicketForPdf> = {},
): DbDeliveryTicketForPdf {
  return {
    id: TICKET_ID,
    ticketNumber: "T10189",
    customerName: "Sample Contractor",
    projectName: "Sample Project",
    deliveryAddress: "10 Ticket Lane\nTicket Town, NY 11700",
    siteContactName: null,
    siteContactPhone: null,
    jobNumber: "26-001",
    deliveryDate: new Date(2026, 10, 13),
    driver: "Driver 1",
    trailer: "Trailer 1",
    customerNotes: null,
    siteInstructions: null,
    totalItems: 0,
    totalWeight: null,
    customer: null,
    job: null,
    quoteNumber: null,
    quote: null,
    lineItems: [line(1), line(2)],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ticket scan code text", () => {
  it("round-trips a code", () => {
    const text = buildTicketScanCode({
      ticketNumber: "T10189",
      copyNumber: 1,
      pageNumber: 2,
      pageCount: 3,
      check: "K3F9Q2",
    });
    expect(text).toBe("LIP/T10189/1/2/3/K3F9Q2");
    expect(parseTicketScanCode(text)).toEqual({
      ticketNumber: "T10189",
      copyNumber: 1,
      pageNumber: 2,
      pageCount: 3,
      check: "K3F9Q2",
    });
  });

  it("keeps a ticket number that contains a slash", () => {
    const text = buildTicketScanCode({
      ticketNumber: "LI/T10189",
      copyNumber: 3,
      pageNumber: 1,
      pageCount: 1,
      check: "ABC123",
    });
    expect(parseTicketScanCode(text)?.ticketNumber).toBe("LI/T10189");
  });

  it("rejects text that is not one of our codes", () => {
    expect(parseTicketScanCode("https://example.com/a/b/c/d/e")).toBeNull();
    expect(parseTicketScanCode("LIP/T10189/1/1")).toBeNull();
    expect(parseTicketScanCode("LIP/T10189/x/1/1/K3F9Q2")).toBeNull();
    expect(parseTicketScanCode("LIP/T10189/1/0/1/K3F9Q2")).toBeNull();
    // Page 3 of 2 cannot exist.
    expect(parseTicketScanCode("LIP/T10189/1/3/2/K3F9Q2")).toBeNull();
    expect(parseTicketScanCode("LIP//1/1/1/K3F9Q2")).toBeNull();
  });

  it("derives the check value from the ticket id", () => {
    expect(ticketScanCheck(TICKET_ID)).toBe("K3F9Q2");
    const code = parseTicketScanCode("LIP/T10189/1/1/1/K3F9Q2")!;
    expect(ticketScanCheckMatches(code, TICKET_ID)).toBe(true);
    // Same ticket number on another database (dev vs production).
    expect(ticketScanCheckMatches(code, "cmh2k9x1p0003abcdzzzzzz")).toBe(false);
  });
});

describe("scan code on the ticket PDF", () => {
  it("gives a numbered, saved ticket page its code text", () => {
    expect(
      ticketPageScanCodeText({
        ticketId: TICKET_ID,
        ticketNumber: "T10189",
        copyNumber: 2,
        pageNumber: 1,
        pageCount: 2,
        isPickup: false,
      }),
    ).toBe("LIP/T10189/2/1/2/K3F9Q2");
  });

  it("gives a draft or an unsaved preview no code", () => {
    const base = { copyNumber: 1, pageNumber: 1, pageCount: 1, isPickup: false };
    expect(
      ticketPageScanCodeText({ ...base, ticketId: TICKET_ID, ticketNumber: null }),
    ).toBeNull();
    expect(
      ticketPageScanCodeText({ ...base, ticketId: null, ticketNumber: "T10189" }),
    ).toBeNull();
  });

  it("builds a QR symbol with the three corner finder squares", () => {
    const { path, size } = buildQrModulePath("LIP/T10189/1/1/1/K3F9Q2");
    // Version 2 at level Q: 25 modules, so each prints 2 pt wide at 50 pt.
    expect(size).toBe(25);
    expect(SCAN_CODE_SIZE / size).toBe(2);
    // A finder square's top edge is a run of seven dark modules.
    expect(path).toContain("M0 0h7v1h-7z");
    expect(path).toContain(`M${size - 7} 0h7v1h-7z`);
    expect(path).toContain(`M0 ${size - 7}h7v1h-7z`);
  });

  it("draws one code per page on every copy", async () => {
    const drawSvgPath = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    await generateDeliveryTicketPdfBytes(ticket(), fillOptions);
    // Three copies, one page each.
    expect(drawSvgPath).toHaveBeenCalledTimes(3);
    const first = drawSvgPath.mock.calls[0]![1]!;
    // Bottom-right corner: right edge on the table border, clear of the fine print.
    expect(first.x).toBeCloseTo(525.5);
    expect(first.y).toBeCloseTo(86);
    expect(first.scale).toBeCloseTo(2);
  });

  it("draws a code on each page of a multi-page ticket", async () => {
    const drawSvgPath = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    await generateDeliveryTicketCopyPdfBytes(
      ticket({ lineItems: Array.from({ length: 45 }, (_, i) => line(i + 1)) }),
      1,
      fillOptions,
    );
    expect(drawSvgPath.mock.calls.length).toBeGreaterThan(1);
  });

  it("moves the code above the logo on a pickup ticket", async () => {
    const drawSvgPath = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    await generateDeliveryTicketCopyPdfBytes(
      ticket({ fulfillmentMethod: "PICKUP" }),
      1,
      fillOptions,
    );
    expect(drawSvgPath).toHaveBeenCalledTimes(1);
    expect(drawSvgPath.mock.calls[0]![1]!.y).toBeCloseTo(144);
  });

  it("leaves a draft ticket without a code", async () => {
    const drawSvgPath = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    await generateDeliveryTicketCopyPdfBytes(
      ticket({ ticketNumber: null }),
      1,
      fillOptions,
    );
    expect(drawSvgPath).not.toHaveBeenCalled();
  });
});
