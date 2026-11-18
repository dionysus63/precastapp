import { describe, expect, it } from "vitest";
import { formatMoneyText, parseMoneyText } from "@/lib/money-input";

describe("parseMoneyText", () => {
  it("reads an amount with or without $, commas and spaces", () => {
    expect(parseMoneyText("30318")).toBe(30318);
    expect(parseMoneyText(" $30,318.50 ")).toBe(30318.5);
    expect(parseMoneyText("0")).toBe(0);
  });

  it("is null for empty and for anything that is not an amount", () => {
    expect(parseMoneyText("")).toBeNull();
    expect(parseMoneyText("  ")).toBeNull();
    expect(parseMoneyText("abc")).toBeNull();
    expect(parseMoneyText("1.2.3")).toBeNull();
    expect(parseMoneyText("-5")).toBeNull();
  });
});

describe("formatMoneyText", () => {
  it("shows two decimals and thousands commas", () => {
    expect(formatMoneyText("30318")).toBe("30,318.00");
    expect(formatMoneyText("1185.5")).toBe("1,185.50");
    expect(formatMoneyText("$1,234,567.891")).toBe("1,234,567.89");
    expect(formatMoneyText("0")).toBe("0.00");
  });

  it("keeps the extra decimals of a per-foot price when allowed", () => {
    expect(formatMoneyText("0.1275", 4)).toBe("0.1275");
    expect(formatMoneyText("1185", 4)).toBe("1,185.00");
    expect(formatMoneyText("2.123456", 4)).toBe("2.1235");
  });

  it("leaves empty empty and a mistyped amount as typed", () => {
    expect(formatMoneyText("")).toBe("");
    expect(formatMoneyText("   ")).toBe("");
    expect(formatMoneyText("12x")).toBe("12x");
  });

  it("is stable when applied again", () => {
    expect(formatMoneyText(formatMoneyText("30318"))).toBe("30,318.00");
  });
});
