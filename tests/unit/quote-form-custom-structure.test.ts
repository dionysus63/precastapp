import { describe, expect, it } from "vitest";
import {
  createDefaultCustomStructureRow,
  findDuplicateStructureNumbers,
  formatDuplicatePasteMessage,
  formatStructureNumberList,
  isCustomStructureRowUserContent,
  productMeasureInputValue,
  type CustomStructureRow,
} from "@/components/quotes/quote-form/quote-form-utils";

function defaultRow(
  overrides: Partial<CustomStructureRow> = {},
): CustomStructureRow {
  return { ...createDefaultCustomStructureRow([]), ...overrides };
}

describe("isCustomStructureRowUserContent", () => {
  it("ignores an untouched row with only its auto-filled number", () => {
    const row = defaultRow();
    expect(row.structureNumber).toBe("CS-1");
    expect(isCustomStructureRowUserContent(row)).toBe(false);
  });

  it("ignores an untouched row whose number was cleared", () => {
    expect(
      isCustomStructureRowUserContent(defaultRow({ structureNumber: "  " })),
    ).toBe(false);
  });

  it("counts entered description, price, weight, yards, or cost items", () => {
    expect(
      isCustomStructureRowUserContent(
        defaultRow({ description: "<p>Vault</p>" }),
      ),
    ).toBe(true);
    expect(isCustomStructureRowUserContent(defaultRow({ unitPrice: "250" }))).toBe(true);
    expect(isCustomStructureRowUserContent(defaultRow({ weight: "4000" }))).toBe(true);
    expect(isCustomStructureRowUserContent(defaultRow({ yards: "1.5" }))).toBe(true);
    expect(
      isCustomStructureRowUserContent(
        defaultRow({
          costItems: [{ id: "c1", label: "Steel", qty: "2", unitCost: "10" }],
        }),
      ),
    ).toBe(true);
  });

  it("counts a structure number the user typed", () => {
    expect(
      isCustomStructureRowUserContent(defaultRow({ structureNumber: "MH-7" })),
    ).toBe(true);
  });

  it("counts a changed quantity", () => {
    expect(isCustomStructureRowUserContent(defaultRow({ qty: "4" }))).toBe(true);
    expect(isCustomStructureRowUserContent(defaultRow({ qty: " 1 " }))).toBe(false);
  });

  it("treats a number from the job or a paste as content", () => {
    const row: CustomStructureRow = {
      id: "r1",
      structureNumber: "CS-1",
      description: "",
      qty: "1",
      unitPrice: "",
      weight: "",
      yards: "",
      costItems: [],
    };
    expect(isCustomStructureRowUserContent(row)).toBe(true);
  });
});

describe("findDuplicateStructureNumbers", () => {
  it("returns nothing when every number is unique", () => {
    expect(
      findDuplicateStructureNumbers([
        { rowNumber: 2, structureNumber: "A-1" },
        { rowNumber: 3, structureNumber: "A-2" },
      ]),
    ).toEqual([]);
  });

  it("matches trimmed and case-insensitively, with sorted row numbers", () => {
    expect(
      findDuplicateStructureNumbers([
        { rowNumber: 5, structureNumber: " cb-1 " },
        { rowNumber: 2, structureNumber: "CB-1" },
        { rowNumber: 3, structureNumber: "MH-2" },
        { rowNumber: 9, structureNumber: "mh-2" },
        { rowNumber: 4, structureNumber: "MH-3" },
        { rowNumber: 7, structureNumber: "Cb-1" },
      ]),
    ).toEqual([
      { structureNumber: "CB-1", rowNumbers: [2, 5, 7] },
      { structureNumber: "MH-2", rowNumbers: [3, 9] },
    ]);
  });

  it("ignores blank numbers", () => {
    expect(
      findDuplicateStructureNumbers([
        { rowNumber: 2, structureNumber: "" },
        { rowNumber: 3, structureNumber: "  " },
      ]),
    ).toEqual([]);
  });
});

describe("paste messages", () => {
  it("names each duplicate and its rows", () => {
    const message = formatDuplicatePasteMessage([
      { structureNumber: "CB-1", rowNumbers: [2, 5] },
      { structureNumber: "MH-2", rowNumbers: [3, 9] },
    ]);
    expect(message).toContain("CB-1 (rows 2, 5)");
    expect(message).toContain("MH-2 (rows 3, 9)");
    expect(message).toMatch(/^No rows added:/);
  });

  it("truncates long structure number lists", () => {
    expect(formatStructureNumberList(["A", "B"])).toBe("A, B");
    expect(formatStructureNumberList(["A", "B", "C", "D"])).toBe("A, B, C…");
  });
});

describe("productMeasureInputValue", () => {
  it("shows a real 0 as 0 and blanks only missing values", () => {
    expect(productMeasureInputValue(0)).toBe("0");
    expect(productMeasureInputValue(1250)).toBe("1250");
    expect(productMeasureInputValue(0.75)).toBe("0.75");
    expect(productMeasureInputValue(null)).toBe("");
    expect(productMeasureInputValue(undefined)).toBe("");
  });
});
