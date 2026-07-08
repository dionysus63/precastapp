import { describe, expect, it } from "vitest";
import {
  markBulkContactDuplicateRows,
  parseContactRolesCell,
  validateBulkContactPasteRow,
} from "@/components/customers/customer-utils";

describe("parseContactRolesCell", () => {
  it("parses full role names case-insensitively", () => {
    expect(parseContactRolesCell("Estimating, Billing, Field")).toEqual({
      roles: ["ESTIMATING", "BILLING", "FIELD"],
      invalidTokens: [],
    });
    expect(parseContactRolesCell("estimating")).toEqual({
      roles: ["ESTIMATING"],
      invalidTokens: [],
    });
  });

  it("accepts synonyms (est, bill, ap, site)", () => {
    expect(parseContactRolesCell("est/ap").roles).toEqual([
      "ESTIMATING",
      "BILLING",
    ]);
    expect(parseContactRolesCell("site").roles).toEqual(["FIELD"]);
  });

  it("dedupes repeated roles", () => {
    expect(parseContactRolesCell("est, estimating, bid").roles).toEqual([
      "ESTIMATING",
    ]);
  });

  it("returns empty for a blank cell", () => {
    expect(parseContactRolesCell("")).toEqual({ roles: [], invalidTokens: [] });
    expect(parseContactRolesCell("  ")).toEqual({
      roles: [],
      invalidTokens: [],
    });
  });

  it("flags unknown tokens without dropping valid ones", () => {
    const result = parseContactRolesCell("billing, sales");
    expect(result.roles).toEqual(["BILLING"]);
    expect(result.invalidTokens).toEqual(["sales"]);
  });
});

const baseRow = {
  customer: "Smith Construction LLC",
  name: "John Smith",
  title: "Owner",
  rolesRaw: "Estimating",
  phone: "631-555-0100",
  email: "john@smith.com",
  notes: "",
};

describe("validateBulkContactPasteRow", () => {
  it("accepts a complete row and parses its roles", () => {
    const row = validateBulkContactPasteRow(baseRow, 1);
    expect(row.isValid).toBe(true);
    expect(row.roles).toEqual(["ESTIMATING"]);
    expect(row.issues).toEqual([]);
  });

  it("requires customer and contact names", () => {
    expect(
      validateBulkContactPasteRow({ ...baseRow, customer: "" }, 1).issues,
    ).toContain("Customer name is required.");
    expect(
      validateBulkContactPasteRow({ ...baseRow, name: " " }, 1).issues,
    ).toContain("Contact name is required.");
  });

  it("requires phone or email", () => {
    const row = validateBulkContactPasteRow(
      { ...baseRow, phone: "", email: "" },
      1,
    );
    expect(row.isValid).toBe(false);
    expect(row.issues).toContain(
      "Contact must have at least a phone number or email.",
    );
  });

  it("accepts phone-only rows", () => {
    const row = validateBulkContactPasteRow({ ...baseRow, email: "" }, 1);
    expect(row.isValid).toBe(true);
  });

  it("rejects malformed emails", () => {
    const row = validateBulkContactPasteRow(
      { ...baseRow, email: "not-an-email" },
      1,
    );
    expect(row.isValid).toBe(false);
  });

  it("flags unknown role tokens", () => {
    const row = validateBulkContactPasteRow(
      { ...baseRow, rolesRaw: "estimating, sales" },
      1,
    );
    expect(row.isValid).toBe(false);
    expect(row.roles).toEqual(["ESTIMATING"]);
    expect(row.issues.join(" ")).toContain("Unknown role");
  });
});

describe("markBulkContactDuplicateRows", () => {
  it("flags a repeated customer+name pair against the first line", () => {
    const rows = [
      validateBulkContactPasteRow(baseRow, 1),
      validateBulkContactPasteRow({ ...baseRow, title: "PM" }, 2),
      validateBulkContactPasteRow({ ...baseRow, name: "Pete Ryan" }, 3),
    ];
    const marked = markBulkContactDuplicateRows(rows);
    expect(marked[0].isValid).toBe(true);
    expect(marked[1].isValid).toBe(false);
    expect(marked[1].issues.join(" ")).toContain("same as line 1");
    expect(marked[2].isValid).toBe(true);
  });

  it("treats the same name at different customers as distinct", () => {
    const rows = [
      validateBulkContactPasteRow(baseRow, 1),
      validateBulkContactPasteRow(
        { ...baseRow, customer: "Bay Shore Pools" },
        2,
      ),
    ];
    const marked = markBulkContactDuplicateRows(rows);
    expect(marked.every((row) => row.isValid)).toBe(true);
  });
});
