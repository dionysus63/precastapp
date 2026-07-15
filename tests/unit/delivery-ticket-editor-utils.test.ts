import { describe, expect, it } from "vitest";
import {
  getDeliveryLinePrimaryLabel,
  getDeliveryLineSecondaryLabel,
  isPositiveDeliveryQuantity,
  shouldShowDeliveryLineDescription,
} from "@/components/delivery-tickets/delivery-ticket-utils";

describe("isPositiveDeliveryQuantity", () => {
  it("activates a line only for a positive number", () => {
    expect(isPositiveDeliveryQuantity("1")).toBe(true);
    expect(isPositiveDeliveryQuantity(" 2.5 ")).toBe(true);
    expect(isPositiveDeliveryQuantity("")).toBe(false);
    expect(isPositiveDeliveryQuantity("   ")).toBe(false);
    expect(isPositiveDeliveryQuantity("0")).toBe(false);
    expect(isPositiveDeliveryQuantity("-1")).toBe(false);
    expect(isPositiveDeliveryQuantity("not a number")).toBe(false);
  });
});

describe("shouldShowDeliveryLineDescription", () => {
  const base = {
    displayName: `12" Extension`,
    itemCode: "RA-E12",
  };

  it("hides descriptions that repeat the displayed product name", () => {
    expect(
      shouldShowDeliveryLineDescription({
        ...base,
        description: `12" Extension`,
      }),
    ).toBe(false);
  });

  it("compares decoded rich-text entities, case, and whitespace", () => {
    expect(
      shouldShowDeliveryLineDescription({
        ...base,
        description: "  12&quot;    EXTENSION  ",
      }),
    ).toBe(false);
  });

  it("hides descriptions that repeat the item number", () => {
    expect(
      shouldShowDeliveryLineDescription({
        ...base,
        description: "ra-e12",
      }),
    ).toBe(false);
  });

  it("keeps a genuinely useful description", () => {
    expect(
      shouldShowDeliveryLineDescription({
        ...base,
        description: "Reinforced extension with gasket",
      }),
    ).toBe(true);
  });

  it("hides the generated full description for configurable structures", () => {
    expect(
      shouldShowDeliveryLineDescription({
        lineType: "CONFIGURABLE_STRUCTURE",
        displayName: "4'x2.5' CB - No Top or Bottom",
        itemCode: "CB-4",
        description:
          `4'-0" x 2'-6" 4'x2.5' CB - No Top or Bottom (Open Top + Bottom) — Rim 34.50' / Inv 30.20' — 5.0' wall`,
      }),
    ).toBe(false);
  });
});

describe("getDeliveryLinePrimaryLabel", () => {
  it("uses the structure name first for configurable structures", () => {
    expect(
      getDeliveryLinePrimaryLabel({
        lineType: "CONFIGURABLE_STRUCTURE",
        displayName: "4'x2.5' CB - No Top or Bottom",
        itemCode: "CB-4",
      }),
    ).toBe("CB-4");
  });

  it("keeps the display name for other line types", () => {
    expect(
      getDeliveryLinePrimaryLabel({
        lineType: "STOCK_PRODUCT",
        displayName: `12" Extension`,
        itemCode: "RA-E12",
      }),
    ).toBe(`12" Extension`);
  });
});

describe("getDeliveryLineSecondaryLabel", () => {
  it("keeps a shorter configurable-structure summary below the name", () => {
    expect(
      getDeliveryLineSecondaryLabel({
        lineType: "CONFIGURABLE_STRUCTURE",
        displayName: "4'x2.5' CB - No Top or Bottom",
        itemCode: "CB-4",
        description:
          `4'-0" x 2'-6" 4'x2.5' CB - No Top or Bottom — Rim 34.50' / Inv 30.20'`,
      }),
    ).toBe("4'x2.5' CB - No Top or Bottom");
  });

  it("does not repeat the full generated description as a secondary label", () => {
    const fullDescription =
      `4'-0" x 2'-6" 4'x2.5' CB - No Top or Bottom — Rim 34.50' / Inv 30.20'`;
    expect(
      getDeliveryLineSecondaryLabel({
        lineType: "CONFIGURABLE_STRUCTURE",
        displayName: fullDescription,
        itemCode: "CB-4",
        description: fullDescription,
      }),
    ).toBeNull();
  });
});
