import { describe, expect, it } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import { ringPieceUnitPrice } from "@/lib/invoicing-service";

function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(String(value));
}

describe("ringPieceUnitPrice", () => {
  it("bills each ring at its height times the per-VF quote price", () => {
    // Field report: 4 x "10'Ø x 5' Drain Ring" showed $112 (the VF price);
    // each ring is worth 5 VF x $112 = $560.
    expect(
      ringPieceUnitPrice(decimal(112), decimal(5)).toString(),
    ).toBe("560");
    expect(
      ringPieceUnitPrice(decimal(124), decimal(4)).toString(),
    ).toBe("496");
  });

  it("handles fractional ring heights exactly", () => {
    expect(
      ringPieceUnitPrice(decimal(112), decimal("2.5")).toString(),
    ).toBe("280");
  });

  it("falls back to the raw quote price without a usable height", () => {
    expect(ringPieceUnitPrice(decimal(112), null).toString()).toBe("112");
    expect(ringPieceUnitPrice(decimal(112), undefined).toString()).toBe("112");
    expect(ringPieceUnitPrice(decimal(112), decimal(0)).toString()).toBe("112");
  });
});
