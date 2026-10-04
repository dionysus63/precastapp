import { afterAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request (see
// delivery-status-guards.test.ts). Prisma and the action bodies run real.
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

import {
  createSheetPdfSetAction,
  deleteSheetPdfSetAction,
  renameSheetPdfSetAction,
} from "@/app/structures/sheet-pdfs/actions";
import { prisma } from "@/lib/prisma";

const tag = `SHEETPDFSET-${Date.now()}`;

afterAll(async () => {
  await prisma.rectSheetPdfSet.deleteMany({
    where: { name: { startsWith: tag } },
  });
});

describe("sheet PDF set actions return user-facing errors", () => {
  it("returns { error } for a duplicate set name instead of throwing", async () => {
    expect(
      await createSheetPdfSetAction(`${tag} Standard`, "RECTANGULAR"),
    ).toBeUndefined();

    expect(
      await createSheetPdfSetAction(`${tag} Standard`, "RECTANGULAR"),
    ).toEqual({ error: "A PDF set with that name already exists." });
  });

  it("returns { error } for a blank name and a missing set", async () => {
    const set = await prisma.rectSheetPdfSet.findFirstOrThrow({
      where: { name: `${tag} Standard` },
    });

    expect(await renameSheetPdfSetAction(set.id, "   ")).toEqual({
      error: "Set name is required.",
    });
    expect(await deleteSheetPdfSetAction(`${tag}-missing`)).toEqual({
      error: expect.stringContaining("not found"),
    });
  });
});
