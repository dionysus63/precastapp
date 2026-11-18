import { describe, expect, it } from "vitest";
import { purchaseOrderPdfFileName } from "@/lib/purchase-order-utils";

describe("purchaseOrderPdfFileName", () => {
  it("names the file after the number and the vendor", () => {
    expect(purchaseOrderPdfFileName("HA-0001", "Halliday Products")).toBe(
      "Purchase Order HA-0001 - Halliday Products.pdf",
    );
  });

  it("drops what Windows does not allow in a file name", () => {
    expect(purchaseOrderPdfFileName("AB-0002", 'A/B "Supply": Pipe?')).toBe(
      "Purchase Order AB-0002 - A B Supply Pipe.pdf",
    );
  });

  it("does not end the name in a dot before the extension", () => {
    expect(purchaseOrderPdfFileName("EJ-0003", "E.J. Prescott Inc.")).toBe(
      "Purchase Order EJ-0003 - E.J. Prescott Inc.pdf",
    );
  });
});
