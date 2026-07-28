import { describe, expect, it } from "vitest";
import {
  collapseCastingTicketLines,
  explodeAssemblyTicketLine,
  type CastingCollapseMeta,
} from "@/lib/casting-ticket-lines";

const META: CastingCollapseMeta = {
  quoteLineItemId: "qli-1",
  productId: "assembly-1",
  itemCode: "EJ301",
  displayName: "NC Curb Inlet Assembly",
  weightEach: 774,
  castingComponentOptions: [
    { productId: "frame-1", quantity: 1, weightEach: 478 },
    { productId: "grate-1", quantity: 1, weightEach: 296 },
    { productId: "hood-1", quantity: 1, weightEach: 0 },
  ],
};

function pieceLine(productId: string, quantity: number, itemCode = productId) {
  return {
    quoteLineItemId: "qli-1",
    productId,
    jobStructureId: null,
    lineType: "STOCK_PRODUCT",
    itemCode,
    description: `${itemCode} piece`,
    quantity,
    unit: "EA",
    weightEach: 100,
    yardLocation: null,
  };
}

describe("collapseCastingTicketLines", () => {
  it("replaces whole-set piece lines with one assembly line", () => {
    const other = {
      quoteLineItemId: "qli-2",
      productId: "p-9",
      jobStructureId: null,
      lineType: "STOCK_PRODUCT",
      itemCode: "RING",
      description: "ring",
      quantity: 5,
      unit: "EA",
      weightEach: 50,
      yardLocation: null,
    };
    const result = collapseCastingTicketLines(
      [other, pieceLine("frame-1", 2), pieceLine("grate-1", 2), pieceLine("hood-1", 2)],
      [META],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(other);
    expect(result[1]).toMatchObject({
      quoteLineItemId: "qli-1",
      productId: "assembly-1",
      itemCode: "EJ301",
      description: "NC Curb Inlet Assembly",
      quantity: 2,
      unit: "EA",
      weightEach: 774,
      lineType: "STOCK_PRODUCT",
    });
  });

  it("keeps partial-set leftovers as piece lines", () => {
    const result = collapseCastingTicketLines(
      [pieceLine("frame-1", 3), pieceLine("grate-1", 2), pieceLine("hood-1", 2)],
      [META],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ productId: "assembly-1", quantity: 2 });
    expect(result[1]).toMatchObject({ productId: "frame-1", quantity: 1 });
  });

  it("leaves lines untouched when no complete set exists", () => {
    const lines = [pieceLine("frame-1", 2), pieceLine("grate-1", 1, "G")];
    const noHood = collapseCastingTicketLines(
      [pieceLine("frame-1", 2)],
      [META],
    );
    expect(noHood).toHaveLength(1);
    expect(noHood[0]).toMatchObject({ productId: "frame-1", quantity: 2 });

    const result = collapseCastingTicketLines(lines, [META]);
    expect(result).toEqual(lines);
  });

  it("sums per-set quantity for a product serving two roles", () => {
    const meta: CastingCollapseMeta = {
      ...META,
      weightEach: null,
      castingComponentOptions: [
        { productId: "p-1", quantity: 1, weightEach: 100 },
        { productId: "p-1", quantity: 1, weightEach: 100 },
        { productId: "p-2", quantity: 1, weightEach: 50 },
      ],
    };
    const result = collapseCastingTicketLines(
      [pieceLine("p-1", 4), pieceLine("p-2", 2)],
      [meta],
    );
    expect(result).toHaveLength(1);
    // Set weight falls back to the summed parts when the assembly has none.
    expect(result[0]).toMatchObject({
      productId: "assembly-1",
      quantity: 2,
      weightEach: 250,
    });
  });

  it("merges duplicate piece lines of the same product", () => {
    const result = collapseCastingTicketLines(
      [
        pieceLine("frame-1", 1),
        pieceLine("frame-1", 1),
        pieceLine("grate-1", 2),
        pieceLine("hood-1", 2),
      ],
      [META],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ productId: "assembly-1", quantity: 2 });
  });

  it("ignores metas without an assembly product or BOM", () => {
    const lines = [pieceLine("frame-1", 2)];
    expect(
      collapseCastingTicketLines(lines, [{ ...META, productId: null }]),
    ).toEqual(lines);
    expect(
      collapseCastingTicketLines(lines, [
        { ...META, castingComponentOptions: [] },
      ]),
    ).toEqual(lines);
  });
});

describe("explodeAssemblyTicketLine", () => {
  it("expands sets into per-role piece entries", () => {
    const pieces = explodeAssemblyTicketLine(2, [
      {
        productId: "frame-1",
        productCode: "715811A01",
        name: "Curb Inlet Frame",
        pieceRole: "FRAME",
        quantity: 1,
        weightLb: 478,
      },
      {
        productId: "hood-1",
        productCode: "715861",
        name: "NC Hood",
        pieceRole: "HOOD",
        quantity: 2,
        weightLb: null,
      },
    ]);

    expect(pieces).toEqual([
      {
        pieceRole: "FRAME",
        productId: "frame-1",
        itemCode: "715811A01",
        description: "Curb Inlet Frame (Frame)",
        quantity: 2,
        weightEach: 478,
      },
      {
        pieceRole: "HOOD",
        productId: "hood-1",
        itemCode: "715861",
        description: "NC Hood (Hood)",
        quantity: 4,
        weightEach: null,
      },
    ]);
  });

  it("returns nothing for zero or invalid sets", () => {
    expect(explodeAssemblyTicketLine(0, [])).toEqual([]);
    expect(explodeAssemblyTicketLine(Number.NaN, [])).toEqual([]);
  });
});
