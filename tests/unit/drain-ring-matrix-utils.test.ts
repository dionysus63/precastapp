import { describe, expect, it } from "vitest";
import {
  buildDrainRingDiameterGroups,
  drainRingQuantityKey,
  getDrainRingQuotedGroupLabel,
  getDrainRingQuotedGroupParts,
} from "@/components/delivery-tickets/drain-ring-matrix-utils";
import type {
  DrainRingOption,
  QuoteLineFulfillment,
} from "@/lib/delivery-fulfillment";

function ringOption(
  productId: string,
  heightFeet: number,
  overrides: Partial<DrainRingOption> = {},
): DrainRingOption {
  return {
    productId,
    productCode: productId.toUpperCase(),
    name: `${heightFeet}' ring`,
    heightFeet,
    drainRingStyle: "DRAIN",
    weightEach: 100,
    currentStock: 10,
    trackInventory: true,
    ...overrides,
  };
}

function fulfillmentLine(
  overrides: Partial<QuoteLineFulfillment> = {},
): QuoteLineFulfillment {
  return {
    quoteLineItemId: "line-1",
    lineNumber: 1,
    lineType: "STOCK_PRODUCT",
    itemCode: "R-10-DRAIN",
    description: `10'Ø Storm Pool - 1 Pool @ 5'-0" Deep`,
    displayName: `10'Ø Storm Pool - 1 Pool @ 5'-0" Deep`,
    unit: "LF",
    weightEach: null,
    quotedQty: 5,
    shippedQty: 0,
    remainingQty: 5,
    eligible: true,
    eligibilityReason: null,
    jobStructureId: null,
    jobStructureStatus: null,
    productId: null,
    currentStock: null,
    isDrainRing: true,
    ringDiameterFeet: 10,
    poolHeightFeet: 5,
    drainRingStyle: "DRAIN",
    drainRingOptions: [],
    isCastingAssembly: false,
    castingComponentOptions: [],
    isAdsPipe: false,
    adsPipeOptions: [],
    isSplitStructure: false,
    structurePieceOptions: [],
    ...overrides,
  };
}

describe("drain ring matrix labels and keys", () => {
  it("uses the same stable composite key as ticket ring lines", () => {
    expect(drainRingQuantityKey("quote-line", "product")).toBe(
      "quote-line::product",
    );
  });

  it("removes the repeated diameter/style prefix from generated pool labels", () => {
    expect(
      getDrainRingQuotedGroupLabel(
        ` 10'Ø Storm Pool - 2 Pools @ 9'-0" Deep `,
      ),
    ).toBe(`2 Pools @ 9'-0" Deep`);
    expect(getDrainRingQuotedGroupLabel("Custom pool group")).toBe(
      "Custom pool group",
    );
  });

  it("splits the pool count and depth into compact badge labels", () => {
    expect(
      getDrainRingQuotedGroupParts(
        `10'Ø Storm Pool - 5 Pools @ 29'-0" Deep`,
      ),
    ).toEqual({
      fullLabel: `5 Pools @ 29'-0" Deep`,
      poolCountLabel: "5 Pools",
      depthLabel: `29'-0" Deep`,
    });
    expect(getDrainRingQuotedGroupParts("Custom pool group")).toEqual({
      fullLabel: "Custom pool group",
      poolCountLabel: "Custom pool group",
      depthLabel: null,
    });
  });
});

describe("buildDrainRingDiameterGroups", () => {
  it("groups by diameter, separates styles, deduplicates options, and sorts", () => {
    const half = ringOption("half", 0.5);
    const one = ringOption("one", 1);
    const sanitary = ringOption("san", 1, {
      drainRingStyle: "SANITARY",
    });

    const fulfillment = [
      fulfillmentLine({
        quoteLineItemId: "ten-second",
        lineNumber: 4,
        remainingQty: 0,
        drainRingOptions: [one, half],
      }),
      fulfillmentLine({
        quoteLineItemId: "twelve",
        lineNumber: 3,
        ringDiameterFeet: 12,
        drainRingOptions: [one],
      }),
      fulfillmentLine({
        quoteLineItemId: "ten-first",
        lineNumber: 1,
        drainRingOptions: [half, one],
      }),
      fulfillmentLine({
        quoteLineItemId: "ten-sanitary",
        lineNumber: 2,
        drainRingStyle: "SANITARY",
        drainRingOptions: [sanitary],
      }),
      fulfillmentLine({
        quoteLineItemId: "unknown",
        lineNumber: 5,
        ringDiameterFeet: null,
        drainRingOptions: [],
      }),
      fulfillmentLine({
        quoteLineItemId: "not-a-ring",
        isDrainRing: false,
      }),
    ];

    const groups = buildDrainRingDiameterGroups(fulfillment, new Map());

    expect(groups.map((group) => group.diameterFeet)).toEqual([10, 12, null]);
    expect(groups[0].matrices.map((matrix) => matrix.style)).toEqual([
      "DRAIN",
      "SANITARY",
    ]);
    expect(
      groups[0].matrices[0].rows.map((row) => row.line.quoteLineItemId),
    ).toEqual(["ten-first", "ten-second"]);
    expect(
      groups[0].matrices[0].options.map(
        (entry) => entry.option.productId,
      ),
    ).toEqual(["half", "one"]);
    expect(groups[0].remainingLineCount).toBe(2);
    expect(groups[0].completedLineCount).toBe(1);
  });

  it("calculates row, matrix, and diameter totals without pooling line limits", () => {
    const half = ringOption("half", 0.5, { currentStock: 4 });
    const one = ringOption("one", 1, { currentStock: 1 });
    const first = fulfillmentLine({
      quoteLineItemId: "first",
      lineNumber: 1,
      remainingQty: 5,
      drainRingOptions: [half, one],
    });
    const completed = fulfillmentLine({
      quoteLineItemId: "completed",
      lineNumber: 2,
      remainingQty: 0,
      eligible: false,
      eligibilityReason: "Fully shipped",
      drainRingOptions: [half, one],
    });
    const linesByKey = new Map([
      [drainRingQuantityKey("first", "half"), { quantity: "2" }],
      [drainRingQuantityKey("first", "one"), { quantity: "1" }],
      [drainRingQuantityKey("completed", "half"), { quantity: "3" }],
    ]);

    const [group] = buildDrainRingDiameterGroups(
      [completed, first],
      linesByKey,
    );
    const matrix = group.matrices[0];
    const [firstRow, completedRow] = matrix.rows;

    expect(firstRow.quantitiesByProductId).toMatchObject({
      half: { raw: "2", numeric: 2 },
      one: { raw: "1", numeric: 1 },
    });
    expect(firstRow).toMatchObject({
      selectedCount: 3,
      selectedFeet: 2,
      remainingAfterSelected: 3,
      overByFeet: 0,
      state: "remaining",
    });
    expect(completedRow).toMatchObject({
      selectedCount: 3,
      selectedFeet: 1.5,
      remainingAfterSelected: -1.5,
      overByFeet: 1.5,
      state: "completed",
    });
    expect(matrix).toMatchObject({
      selectedCount: 6,
      selectedFeet: 3.5,
      remainingLineCount: 1,
      completedLineCount: 1,
    });
    expect(group).toMatchObject({
      selectedCount: 6,
      selectedFeet: 3.5,
      remainingLineCount: 1,
      completedLineCount: 1,
    });

    const optionStates = Object.fromEntries(
      matrix.options.map((entry) => [entry.option.productId, entry]),
    );
    expect(optionStates.half).toMatchObject({
      selectedCount: 5,
      stockStatus: "short",
      shortageCount: 1,
    });
    expect(optionStates.one).toMatchObject({
      selectedCount: 1,
      stockStatus: "available",
      shortageCount: 0,
    });
  });

  it("uses the completion tolerance while keeping unavailable unfinished rows", () => {
    const option = ringOption("one", 1);
    const [group] = buildDrainRingDiameterGroups(
      [
        fulfillmentLine({
          quoteLineItemId: "epsilon",
          remainingQty: 0.001,
          drainRingOptions: [option],
        }),
        fulfillmentLine({
          quoteLineItemId: "unfinished",
          lineNumber: 2,
          remainingQty: 0.0011,
          eligible: false,
          eligibilityReason: "No active rings in catalog",
          drainRingOptions: [option],
        }),
      ],
      new Map(),
    );

    expect(group.matrices[0].rows.map((row) => row.state)).toEqual([
      "completed",
      "remaining",
    ]);
  });

  it("preserves raw cells, rounds footage, and derives every stock status", () => {
    const options = [
      ringOption("decimal", 0.1, { currentStock: 3 }),
      ringOption("out", 0.25, { currentStock: 0 }),
      ringOption("short", 0.5, { currentStock: 0 }),
      ringOption("untracked", 1, {
        trackInventory: false,
        currentStock: null,
      }),
      ringOption("unknown", 2, {
        trackInventory: true,
        currentStock: null,
      }),
      ringOption("invalid", 3, { currentStock: 5 }),
    ];
    const line = fulfillmentLine({ drainRingOptions: options });
    const linesByKey = new Map([
      [drainRingQuantityKey("line-1", "decimal"), { quantity: "3" }],
      [drainRingQuantityKey("line-1", "short"), { quantity: "2" }],
      [drainRingQuantityKey("line-1", "untracked"), { quantity: "5" }],
      [drainRingQuantityKey("line-1", "invalid"), { quantity: "oops" }],
    ]);

    const matrix = buildDrainRingDiameterGroups([line], linesByKey)[0]
      .matrices[0];
    const row = matrix.rows[0];
    const states = Object.fromEntries(
      matrix.options.map((entry) => [entry.option.productId, entry]),
    );

    expect(row.quantitiesByProductId.invalid).toEqual({
      raw: "oops",
      numeric: 0,
    });
    expect(row.selectedFeet).toBe(6.3);
    expect(states.decimal.stockStatus).toBe("available");
    expect(states.out.stockStatus).toBe("out_of_stock");
    expect(states.short).toMatchObject({
      stockStatus: "short",
      shortageCount: 2,
    });
    expect(states.untracked.stockStatus).toBe("not_tracked");
    expect(states.unknown.stockStatus).toBe("unknown");
  });
});
