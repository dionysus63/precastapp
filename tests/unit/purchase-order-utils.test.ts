import { describe, expect, it } from "vitest";
import {
  purchaseOrderCreatorNames,
  purchaseOrderPdfFileName,
} from "@/lib/purchase-order-utils";

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

describe("purchaseOrderCreatorNames", () => {
  it("lists each name once, sorted, whatever its capitals or spaces", () => {
    expect(
      purchaseOrderCreatorNames(["Nick", "anna", null, " nick ", "", "Anna", "Bob"]),
    ).toEqual(["anna", "Bob", "Nick"]);
  });

  it("is empty when no order names anyone", () => {
    expect(purchaseOrderCreatorNames([null, undefined, "  "])).toEqual([]);
  });
});
