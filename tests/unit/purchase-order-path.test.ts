import { describe, expect, it } from "vitest";
import { isVendorQuotePathInsideRoot } from "@/lib/purchase-order-path";

describe("isVendorQuotePathInsideRoot", () => {
  it("accepts a file in a purchase order's own folder", () => {
    expect(
      isVendorQuotePathInsideRoot("C:\\PrecastPurchaseOrders\\HA-0001\\quote.pdf"),
    ).toBe(true);
    expect(
      isVendorQuotePathInsideRoot("c:\\precastpurchaseorders\\HA-0001\\quote.pdf"),
    ).toBe(true);
  });

  it("refuses anything else", () => {
    for (const filePath of [
      "C:\\PrecastPurchaseOrders",
      "C:\\PrecastPurchaseOrders\\HA-0001",
      "C:\\PrecastPurchaseOrders\\HA-0001\\..\\..\\Windows\\win.ini",
      "C:\\PrecastPurchaseOrders\\..\\Apps\\precastapp\\.env",
      "C:\\PrecastPurchaseOrdersOther\\HA-0001\\quote.pdf",
      "C:\\PrecastPurchaseOrders\\HA-0001\\deeper\\quote.pdf",
      "D:\\PrecastPurchaseOrders\\HA-0001\\quote.pdf",
      "\\\\server\\share\\HA-0001\\quote.pdf",
      "quote.pdf",
    ]) {
      expect(isVendorQuotePathInsideRoot(filePath), filePath).toBe(false);
    }
  });
});
