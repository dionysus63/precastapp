import { afterAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing with no meaning outside a request.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import { savePlanSheetMarkup } from "@/app/quotes/plan-sheet-actions";
import { isActionError } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("savePlanSheetMarkup", () => {
  it("returns a readable error instead of throwing when the save fails", async () => {
    // The workbook autosaves markup in the background; a thrown error would
    // reach it as a generic message (or not at all) in production.
    const result = await savePlanSheetMarkup("missing-plan-sheet", {
      version: 1,
      markers: [],
    } as unknown as Parameters<typeof savePlanSheetMarkup>[1]);

    expect(isActionError(result)).toBe(true);
    expect(isActionError(result) && result.error).toMatch(/not found/i);
  });
});
