import { describe, expect, it } from "vitest";
import {
  allocateRingsAcrossPools,
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

  it("nets feet on other open loads out of availability", () => {
    const option = ringOption("one", 1);
    const fullyScheduled = fulfillmentLine({
      quoteLineItemId: "booked",
      lineNumber: 1,
      remainingQty: 5,
      drainRingOptions: [option],
    });
    const partiallyScheduled = fulfillmentLine({
      quoteLineItemId: "partial",
      lineNumber: 2,
      remainingQty: 5,
      drainRingOptions: [option],
    });
    const linesByKey = new Map([
      [drainRingQuantityKey("partial", "one"), { quantity: "3" }],
    ]);

    const [group] = buildDrainRingDiameterGroups(
      [fullyScheduled, partiallyScheduled],
      linesByKey,
      { booked: 5, partial: 1 },
    );
    const [bookedRow, partialRow] = group.matrices[0].rows;

    expect(bookedRow).toMatchObject({
      scheduledElsewhereFeet: 5,
      availableFeet: 0,
      remainingAfterSelected: 0,
      overByFeet: 0,
      state: "scheduled",
    });
    expect(partialRow).toMatchObject({
      scheduledElsewhereFeet: 1,
      availableFeet: 4,
      selectedFeet: 3,
      remainingAfterSelected: 1,
      overByFeet: 0,
      state: "remaining",
    });
    expect(group.matrices[0].remainingLineCount).toBe(1);
    expect(group.matrices[0].completedLineCount).toBe(0);
  });

  it("flags selections that exceed the net availability as over limit", () => {
    const option = ringOption("one", 1);
    const line = fulfillmentLine({
      quoteLineItemId: "line-1",
      remainingQty: 5,
      drainRingOptions: [option],
    });
    const linesByKey = new Map([
      [drainRingQuantityKey("line-1", "one"), { quantity: "4" }],
    ]);

    const [group] = buildDrainRingDiameterGroups([line], linesByKey, {
      "line-1": 2,
    });
    expect(group.matrices[0].rows[0]).toMatchObject({
      availableFeet: 3,
      selectedFeet: 4,
      overByFeet: 1,
      state: "remaining",
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

describe("allocateRingsAcrossPools", () => {
  function matrixFor(lines: QuoteLineFulfillment[]) {
    return buildDrainRingDiameterGroups(lines, new Map())[0].matrices[0];
  }

  it("re-solves from scratch so rings fit when a different pool split is required", () => {
    const three = ringOption("three", 3);
    const four = ringOption("four", 4);
    const matrix = matrixFor([
      fulfillmentLine({
        quoteLineItemId: "pool-4",
        lineNumber: 1,
        remainingQty: 4,
        drainRingOptions: [three, four],
      }),
      fulfillmentLine({
        quoteLineItemId: "pool-3",
        lineNumber: 2,
        remainingQty: 3,
        drainRingOptions: [three, four],
      }),
    ]);

    // A 3' ring alone could land in either pool; the 4' ring only fits
    // pool-4. Solving the full set together must place 4'->pool-4 and
    // 3'->pool-3 regardless of entry order.
    const result = allocateRingsAcrossPools(matrix, { four: 1, three: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const byKey = Object.fromEntries(
        result.assignments.map((entry) => [
          `${entry.line.quoteLineItemId}:${entry.option.productId}`,
          entry.count,
        ]),
      );
      expect(byKey).toEqual({ "pool-4:four": 1, "pool-3:three": 1 });
    }
  });

  it("reports the total feet left when the rings exceed capacity", () => {
    const three = ringOption("three", 3);
    const matrix = matrixFor([
      fulfillmentLine({ remainingQty: 5, drainRingOptions: [three] }),
    ]);

    expect(allocateRingsAcrossPools(matrix, { three: 2 })).toEqual({
      ok: false,
      reason: "Only 5 LF left across these pools.",
    });
  });

  it("explains when heights cannot be split even though total feet fit", () => {
    const two = ringOption("two", 2);
    const matrix = matrixFor([
      fulfillmentLine({
        quoteLineItemId: "a",
        lineNumber: 1,
        remainingQty: 3,
        drainRingOptions: [two],
      }),
      fulfillmentLine({
        quoteLineItemId: "b",
        lineNumber: 2,
        remainingQty: 3,
        drainRingOptions: [two],
      }),
    ]);

    const result = allocateRingsAcrossPools(matrix, { two: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("assign by pool");
    }
  });

  it("only assigns a SKU to pool groups that offer it", () => {
    const one = ringOption("one", 1);
    const three = ringOption("three", 3);
    const matrix = matrixFor([
      fulfillmentLine({
        quoteLineItemId: "no-threes",
        lineNumber: 1,
        remainingQty: 10,
        drainRingOptions: [one],
      }),
      fulfillmentLine({
        quoteLineItemId: "threes",
        lineNumber: 2,
        remainingQty: 3,
        drainRingOptions: [one, three],
      }),
    ]);

    const result = allocateRingsAcrossPools(matrix, { three: 1, one: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const threes = result.assignments.find(
        (entry) => entry.option.productId === "three",
      );
      expect(threes?.line.quoteLineItemId).toBe("threes");
    }
  });

  it("never assigns to completed or ineligible pool groups", () => {
    const one = ringOption("one", 1);
    const matrix = matrixFor([
      fulfillmentLine({
        quoteLineItemId: "done",
        lineNumber: 1,
        remainingQty: 0,
        drainRingOptions: [one],
      }),
      fulfillmentLine({
        quoteLineItemId: "blocked",
        lineNumber: 2,
        remainingQty: 8,
        eligible: false,
        eligibilityReason: "Structure status: PENDING",
        drainRingOptions: [one],
      }),
      fulfillmentLine({
        quoteLineItemId: "open",
        lineNumber: 3,
        remainingQty: 2,
        drainRingOptions: [one],
      }),
    ]);

    const result = allocateRingsAcrossPools(matrix, { one: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0]).toMatchObject({ count: 2 });
      expect(result.assignments[0]!.line.quoteLineItemId).toBe("open");
    }
    expect(allocateRingsAcrossPools(matrix, { one: 3 }).ok).toBe(false);
  });
});

