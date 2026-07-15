import { describe, expect, it } from "vitest";
import { resolvePriceListIsDefault } from "@/lib/price-list-service";

describe("price list default settings", () => {
  it("preserves the current default when its disabled checkbox is omitted", () => {
    expect(resolvePriceListIsDefault(true, false)).toBe(true);
  });

  it("allows a different list to be promoted", () => {
    expect(resolvePriceListIsDefault(false, true)).toBe(true);
  });

  it("leaves a non-default list unchanged when not promoted", () => {
    expect(resolvePriceListIsDefault(false, false)).toBe(false);
  });
});
