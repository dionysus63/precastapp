import { describe, expect, it, vi } from "vitest";

// The signed-in admin is "test-user"; editing that same id is a self-edit.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { updateUser } from "@/app/settings/users/actions";

function selfEdit(fields: { role: string; isActive: boolean }) {
  const formData = new FormData();
  formData.set("id", "test-user");
  formData.set("displayName", "Test User");
  formData.set("initials", "TU");
  formData.set("role", fields.role);
  if (fields.isActive) {
    formData.set("isActive", "on");
  }
  return formData;
}

describe("updateUser self-lockout guard", () => {
  it("refuses to deactivate your own account", async () => {
    const result = await updateUser(selfEdit({ role: "ADMIN", isActive: false }));
    expect(result).toEqual({ error: "You cannot deactivate your own account." });
  });

  it("refuses to remove your own Users & Access permission", async () => {
    const result = await updateUser(selfEdit({ role: "READ_ONLY", isActive: true }));
    expect(result).toEqual({
      error: expect.stringMatching(/your own Users & Access permission/),
    });
  });
});
