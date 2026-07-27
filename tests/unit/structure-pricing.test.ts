import { describe, expect, it } from "vitest";
import { mergePriceEntries } from "@/lib/structure-pricing";

type Row = { priceListId: string; refId: string; price: number };

const value = (row: Row, usedFallback: boolean) => ({
  price: row.price,
  usedFallback,
});

describe("mergePriceEntries", () => {
  it("target rows win over default rows", () => {
    const merged = mergePriceEntries(
      [{ priceListId: "muni", refId: "mold-4", price: 200 }],
      [{ priceListId: "std", refId: "mold-4", price: 148 }],
      (row) => row.refId,
      value,
      false,
    );
    expect(merged.get("mold-4")).toEqual({ price: 200, usedFallback: false });
  });

  it("default rows fill gaps and are flagged as fallback", () => {
    const merged = mergePriceEntries(
      [{ priceListId: "muni", refId: "mold-4", price: 200 }],
      [
        { priceListId: "std", refId: "mold-4", price: 148 },
        { priceListId: "std", refId: "mold-6", price: 300 },
      ],
      (row) => row.refId,
      value,
      false,
    );
    expect(merged.get("mold-6")).toEqual({ price: 300, usedFallback: true });
    expect(merged.get("mold-4")).toEqual({ price: 200, usedFallback: false });
  });

  it("pricing the default list itself never flags fallback", () => {
    const merged = mergePriceEntries(
      [{ priceListId: "std", refId: "mold-4", price: 148 }],
      [],
      (row) => row.refId,
      value,
      true,
    );
    expect(merged.get("mold-4")).toEqual({ price: 148, usedFallback: false });
  });

  it("no entry anywhere means no price", () => {
    const merged = mergePriceEntries<Row, { price: number; usedFallback: boolean }>(
      [],
      [],
      (row) => row.refId,
      value,
      false,
    );
    expect(merged.get("mold-4")).toBeUndefined();
  });
});
