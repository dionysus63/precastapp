import { describe, expect, it } from "vitest";
import {
  customGridFromTsv,
  parseCustomStructureImport,
} from "@/lib/custom-structure-import";

const HEADER = [
  "Structure #",
  "Description",
  "Qty",
  "Unit",
  "Weight Each (lbs)",
  "Submittal Needed",
  "Notes",
];

describe("parseCustomStructureImport", () => {
  it("parses piece-type rows with defaults", () => {
    const result = parseCustomStructureImport([
      HEADER,
      ["SW-P1", "Sound Wall Panel Type 1", 120, "EA", 9800, "Yes", ""],
      ["SW-CAP", "Column Cap", "", "", "", "No", "stock yard"],
    ]);

    expect(result.headerFound).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].entry).toEqual({
      structureNumber: "SW-P1",
      description: "Sound Wall Panel Type 1",
      quantity: 120,
      unit: "EA",
      weightEachLbs: 9800,
      needsSubmittal: true,
      notes: null,
    });
    // Blank qty/unit/weight/submittal fall back to 1 / EA / none / Yes.
    expect(result.rows[1].entry).toEqual({
      structureNumber: "SW-CAP",
      description: "Column Cap",
      quantity: 1,
      unit: "EA",
      weightEachLbs: null,
      needsSubmittal: false,
      notes: "stock yard",
    });
  });

  it("matches headers by name regardless of order and extras", () => {
    const result = parseCustomStructureImport([
      ["Notes", "Qty", "Piece #", "Description"],
      ["", 4, "SW-C1", "Column"],
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].entry.structureNumber).toBe("SW-C1");
    expect(result.rows[0].entry.quantity).toBe(4);
  });

  it("rejects bad rows with row-numbered errors", () => {
    const result = parseCustomStructureImport([
      HEADER,
      ["", "No number", 1, "", "", "", ""],
      ["SW-1", "", 1, "", "", "", ""],
      ["SW-2", "Bad qty", "1.5", "", "", "", ""],
      ["SW-3", "Bad weight", 1, "", "-5", "", ""],
      ["SW-4", "Bad submittal", 1, "", "", "maybe", ""],
      ["SW-5", "Good", 2, "", "", "", ""],
      ["SW-5", "Duplicate", 1, "", "", "", ""],
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].entry.structureNumber).toBe("SW-5");
    expect(result.errors.map((error) => error.rowNumber)).toEqual([
      2, 3, 4, 5, 6, 8,
    ]);
  });

  it("round-trips pasted TSV", () => {
    const tsv = [HEADER.join("\t"), "SW-P1\tPanel\t10\tEA\t9,800\tyes\t"].join(
      "\n",
    );
    const result = parseCustomStructureImport(customGridFromTsv(tsv));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].entry.quantity).toBe(10);
    expect(result.rows[0].entry.weightEachLbs).toBe(9800);
  });

  it("reports a missing header row", () => {
    const result = parseCustomStructureImport([["random", "cells"], ["1", "2"]]);
    expect(result.headerFound).toBe(false);
  });
});
