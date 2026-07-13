import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  canAccessPathWithPermissions,
} from "@/lib/auth/constants";

/**
 * Regression tests for the page-permission map behind DashboardShell.
 *
 * DashboardShell authorizes with canAccessPathWithPermissions against the
 * middleware-forwarded x-pathname header (and fails closed when the header
 * is missing). These tests pin the map itself: role defaults must not
 * silently gain access to pages outside their area.
 */
describe("canAccessPathWithPermissions", () => {
  const production = DEFAULT_ROLE_PERMISSIONS.PRODUCTION;
  const readOnly = DEFAULT_ROLE_PERMISSIONS.READ_ONLY;

  it("denies PRODUCTION role pages outside its area", () => {
    for (const path of [
      "/customers",
      "/customers/abc123",
      "/invoices",
      "/quotes",
      "/quotes/new",
      "/settings/users",
    ]) {
      expect(
        canAccessPathWithPermissions(production, path),
        `PRODUCTION should be denied ${path}`,
      ).toBe(false);
    }
  });

  it("allows PRODUCTION role its own pages", () => {
    for (const path of ["/production", "/inventory", "/jobs", "/jobs/xyz"]) {
      expect(
        canAccessPathWithPermissions(production, path),
        `PRODUCTION should be allowed ${path}`,
      ).toBe(true);
    }
  });

  it("prefix matching does not bleed across similarly named routes", () => {
    // "/production" and "/products" are distinct gates.
    expect(canAccessPathWithPermissions(production, "/products")).toBe(false);
    expect(canAccessPathWithPermissions(["PRODUCTS_VIEW"], "/production")).toBe(
      false,
    );
    expect(canAccessPathWithPermissions(["PRODUCTS_VIEW"], "/products")).toBe(
      true,
    );
  });

  it("READ_ONLY cannot reach management-only settings pages", () => {
    expect(canAccessPathWithPermissions(readOnly, "/settings/users")).toBe(
      false,
    );
  });

  it("a user with every permission can reach every mapped page", () => {
    for (const path of [
      "/customers",
      "/invoices",
      "/quotes",
      "/production",
      "/inventory",
      "/settings/users",
      "/delivery-tickets",
    ]) {
      expect(canAccessPathWithPermissions([...ALL_PERMISSION_KEYS], path)).toBe(
        true,
      );
    }
  });

  it("documents that unmapped paths (like /) are ungated", () => {
    // This is why DashboardShell must fail closed when the pathname header
    // is missing: an empty or unknown path passes the permission check.
    expect(canAccessPathWithPermissions([], "/")).toBe(true);
    expect(canAccessPathWithPermissions([], "")).toBe(true);
  });
});
