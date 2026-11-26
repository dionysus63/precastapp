import { describe, expect, it } from "vitest";
import { parsePriceInput, splitPastedColumn } from "@/lib/pricing/price-input";

describe("parsePriceInput", () => {
  it("reads prices as typed and as Excel shows them", () => {
    expect(parsePriceInput("1450")).toEqual({ ok: true, value: "1450.00" });
    expect(parsePriceInput(" 618.5 ")).toEqual({ ok: true, value: "618.50" });
    expect(parsePriceInput("$1,450.00")).toEqual({ ok: true, value: "1450.00" });
    expect(parsePriceInput("$ 14.25")).toEqual({ ok: true, value: "14.25" });
    expect(parsePriceInput(".5")).toEqual({ ok: true, value: "0.50" });
    expect(parsePriceInput("12.")).toEqual({ ok: true, value: "12.00" });
    expect(parsePriceInput("0")).toEqual({ ok: true, value: "0.00" });
  });

  it("reads blank as no price", () => {
    expect(parsePriceInput("")).toEqual({ ok: true, value: null });
    expect(parsePriceInput("   ")).toEqual({ ok: true, value: null });
  });

  it("refuses text, negatives, fractions of a cent and oversized numbers", () => {
    expect(parsePriceInput("abc").ok).toBe(false);
    expect(parsePriceInput("-5").ok).toBe(false);
    expect(parsePriceInput("12.345").ok).toBe(false);
    expect(parsePriceInput("1e3").ok).toBe(false);
    expect(parsePriceInput("1.2.3").ok).toBe(false);
    expect(parsePriceInput("99999999999").ok).toBe(false);
  });
});

describe("splitPastedColumn", () => {
  it("takes one entry per copied row and drops Excel's last line break", () => {
    expect(splitPastedColumn("1450\r\n618\r\n780\r\n")).toEqual(["1450", "618", "780"]);
    expect(splitPastedColumn("1450\n618")).toEqual(["1450", "618"]);
  });

  it("keeps only the first column when several were copied", () => {
    expect(splitPastedColumn("1450\tEA\tbase\r\n618\tEA\triser")).toEqual(["1450", "618"]);
  });

  it("keeps blank rows in the middle so the rows under them line up", () => {
    expect(splitPastedColumn("1450\n\n780\n")).toEqual(["1450", "", "780"]);
  });

  it("drops quotes wrapped around a cell", () => {
    expect(splitPastedColumn('"1,640.00"\n410')).toEqual(["1,640.00", "410"]);
  });

  it("treats a single value as one row", () => {
    expect(splitPastedColumn("1450")).toEqual(["1450"]);
    expect(splitPastedColumn("")).toEqual([]);
  });
});
