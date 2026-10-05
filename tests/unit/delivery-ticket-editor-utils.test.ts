import { describe, expect, it } from "vitest";
import {
  getDeliveryLinePrimaryLabel,
  getDeliveryLineSecondaryLabel,
  isPositiveDeliveryQuantity,
  shouldShowDeliveryLineDescription,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  isQuoteDerivedEditorLine,
  stripQuoteDerivedLines,
} from "@/components/delivery-tickets/delivery-ticket-editor/editor-utils";
import type { EditorLine } from "@/components/delivery-tickets/delivery-ticket-editor/types";

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

describe("stripQuoteDerivedLines (switching a ticket to Walk-in)", () => {
  function line(overrides: Partial<EditorLine> & { key: string }): EditorLine {
    return {
      quoteLineItemId: null,
      productId: null,
      jobStructureId: null,
      lineType: "STOCK_PRODUCT",
      itemCode: overrides.key,
      description: "",
      quantity: "1",
      unit: "EA",
      weightEach: "",
      yardLocation: "",
      ...overrides,
    };
  }

  const quoteRow = line({ key: "ql-1", quoteLineItemId: "ql-1", productId: "p-ring", unitPrice: "320" });
  const structure = line({
    key: "ql-2",
    quoteLineItemId: "ql-2",
    jobStructureId: "js-1",
    lineType: "CONFIGURABLE_STRUCTURE",
  });
  const splitPiece = line({
    key: "ql-3::piece-1",
    quoteLineItemId: "ql-3",
    jobStructureId: "js-2",
    jobStructurePieceId: "piece-1",
    lineType: "CUSTOM_STRUCTURE",
  });
  const castingPiece = line({ key: "ql-4::p-frame", quoteLineItemId: "ql-4", productId: "p-frame" });
  const ringSku = line({ key: "ql-5::p-r24", quoteLineItemId: "ql-5", productId: "p-r24" });
  const stockExtra = line({ key: "extra-1", productId: "p-cover", unitPrice: "100" });
  const customExtra = line({ key: "extra-2", lineType: "MISC", itemCode: "Grout", unitPrice: "12" });

  it("flags every quote-derived line and no product/custom line", () => {
    for (const quoteLine of [quoteRow, structure, splitPiece, castingPiece, ringSku]) {
      expect(isQuoteDerivedEditorLine(quoteLine)).toBe(true);
    }
    expect(isQuoteDerivedEditorLine(stockExtra)).toBe(false);
    expect(isQuoteDerivedEditorLine(customExtra)).toBe(false);
    // A structure link alone (no quote line) still counts.
    expect(isQuoteDerivedEditorLine(line({ key: "x", jobStructureId: "js-9" }))).toBe(true);
  });

  it("drops quote-derived lines and their selections, keeping extras as they were", () => {
    const lines = [quoteRow, structure, stockExtra, splitPiece, castingPiece, ringSku, customExtra];
    const selected = new Set(lines.map((entry) => entry.key));
    const result = stripQuoteDerivedLines(lines, selected);

    expect(result.lines).toEqual([stockExtra, customExtra]);
    expect([...result.selectedLineIds]).toEqual(["extra-1", "extra-2"]);
    // Unselected kept lines stay unselected.
    const partial = stripQuoteDerivedLines(lines, new Set(["ql-1", "extra-2"]));
    expect([...partial.selectedLineIds]).toEqual(["extra-2"]);
  });

  it("leaves a ticket with no quote lines untouched", () => {
    const result = stripQuoteDerivedLines([stockExtra], new Set(["extra-1"]));
    expect(result.lines).toEqual([stockExtra]);
    expect([...result.selectedLineIds]).toEqual(["extra-1"]);
  });
});