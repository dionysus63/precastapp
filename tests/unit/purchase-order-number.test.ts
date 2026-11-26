import { describe, expect, it } from "vitest";
import {
  formatPurchaseOrderNumber,
  purchaseOrderNumberPrefix,
  purchaseOrderPrefix,
} from "@/lib/purchase-order-number";

describe("purchaseOrderPrefix", () => {
  it("takes the first two letters of the vendor name, upper case", () => {
    expect(purchaseOrderPrefix("Halliday")).toBe("HA");
    expect(purchaseOrderPrefix("halliday products")).toBe("HA");
    expect(purchaseOrderPrefix("  Neenah Foundry")).toBe("NE");
  });

  it("passes over spaces, punctuation and accents", () => {
    expect(purchaseOrderPrefix("E.J. Prescott")).toBe("EJ");
    expect(purchaseOrderPrefix("A & B Supply")).toBe("AB");
    expect(purchaseOrderPrefix("U.S. Foundry")).toBe("US");
    expect(purchaseOrderPrefix("Éclair Castings")).toBe("EC");
    expect(purchaseOrderPrefix("#1 Pipe")).toBe("1P");
  });

  it("uses digits like letters", () => {
    expect(purchaseOrderPrefix("3M")).toBe("3M");
    expect(purchaseOrderPrefix("84 Lumber")).toBe("84");
  });

  it("fills a name that is too short", () => {
    expect(purchaseOrderPrefix("Q")).toBe("QX");
    expect(purchaseOrderPrefix("--")).toBe("XX");
  });
});

describe("formatPurchaseOrderNumber", () => {
  it("prints four digits after the dash", () => {
    expect(formatPurchaseOrderNumber("HA", 1)).toBe("HA-0001");
    expect(formatPurchaseOrderNumber("HA", 427)).toBe("HA-0427");
  });

  it("keeps counting past 9999", () => {
    expect(formatPurchaseOrderNumber("HA", 10000)).toBe("HA-10000");
  });
});

describe("purchaseOrderNumberPrefix", () => {
  it("reads the prefix of a vendor style number", () => {
    expect(purchaseOrderNumberPrefix("HA-0007")).toBe("HA");
    expect(purchaseOrderNumberPrefix("3M-10000")).toBe("3M");
  });

  it("gives nothing for the old global numbers", () => {
    expect(purchaseOrderNumberPrefix("PO10001")).toBeNull();
    expect(purchaseOrderNumberPrefix("")).toBeNull();
  });
});
