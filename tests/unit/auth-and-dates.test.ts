import { describe, expect, it } from "vitest";
import { getAccessibleHome } from "@/lib/auth/permissions";
import type { AuthUser } from "@/lib/auth/permissions";
import { productionDayTimestamp } from "@/lib/inventory-service";
import { parseRolePermissionsFromStorage } from "@/lib/role-permissions-settings";

describe("role permissions storage", () => {
  it("keeps a role's deliberately empty permission list", () => {
    const parsed = parseRolePermissionsFromStorage({ READ_ONLY: [] });
    expect(parsed.READ_ONLY).toEqual([]);
  });
});

describe("getAccessibleHome", () => {
  const dispatcher = { role: "DISPATCHER" } as AuthUser;

  it("uses the role's home when the user can open it", () => {
    expect(getAccessibleHome(dispatcher, ["DELIVERY_VIEW"])).toBe(
      "/delivery-tickets",
    );
  });

  it("falls back to the dashboard instead of looping on a denied home", () => {
    expect(getAccessibleHome(dispatcher, [])).toBe("/");
  });
});

describe("productionDayTimestamp", () => {
  it("keeps the production day's calendar date in local time", () => {
    // How the daily production form's "2026-10-03" is parsed (UTC midnight).
    const stamp = productionDayTimestamp(new Date("2026-10-03"));
    expect([stamp.getFullYear(), stamp.getMonth() + 1, stamp.getDate()]).toEqual([
      2026, 10, 3,
    ]);
  });
});
