import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Who is signed in comes from the session cookie, which a test has none of.
// The save and the read run for real.
const signedIn = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => ({ id: signedIn.id })),
  requirePermission: vi.fn(async () => ({ id: signedIn.id })),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { savePreviewZoom } from "@/app/settings/users/actions";
import { isActionError } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { loadKeptPreviewZoom } from "@/lib/server/preview-zoom";

// "Keep zoom" beside a preview's zoom buttons: the zoom is kept per account
// and per screen, so it follows the user to any computer and no one else.

const tag = `zoomtest${Date.now()}`;
let firstUser: string;
let secondUser: string;

beforeAll(async () => {
  const [first, second] = await Promise.all(
    ["a", "b"].map((letter) =>
      prisma.user.create({
        data: {
          username: `${tag}${letter}`,
          displayName: `Zoom Test ${letter.toUpperCase()}`,
          initials: `Z${letter.toUpperCase()}`,
        },
      }),
    ),
  );
  firstUser = first.id;
  secondUser = second.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: tag } } });
});

describe("keeping a preview zoom", () => {
  it("opens fitted for a user who never kept one", async () => {
    expect(await loadKeptPreviewZoom(firstUser, "invoice-list")).toBe(1);
    expect(await loadKeptPreviewZoom(null, "invoice-list")).toBe(1);
  });

  it("keeps the zoom for the signed-in user only", async () => {
    signedIn.id = firstUser;
    expect(await savePreviewZoom("invoice-list", 1.5)).toEqual({ ok: true });
    expect(await loadKeptPreviewZoom(firstUser, "invoice-list")).toBe(1.5);
    expect(await loadKeptPreviewZoom(secondUser, "invoice-list")).toBe(1);
  });

  it("replaces the kept zoom instead of adding a second one", async () => {
    signedIn.id = firstUser;
    await savePreviewZoom("invoice-list", 2.5);
    await savePreviewZoom("invoice-list", 1);
    expect(await loadKeptPreviewZoom(firstUser, "invoice-list")).toBe(1);
    expect(
      await prisma.userPreviewZoom.count({ where: { userId: firstUser } }),
    ).toBe(1);
  });

  it("refuses a zoom that is not a step, and a screen it does not know", async () => {
    signedIn.id = secondUser;
    expect(isActionError(await savePreviewZoom("invoice-list", 1.4))).toBe(true);
    expect(isActionError(await savePreviewZoom("somewhere-else", 2))).toBe(true);
    expect(
      await prisma.userPreviewZoom.count({ where: { userId: secondUser } }),
    ).toBe(0);
  });

  it("goes with the user when the account is removed", async () => {
    signedIn.id = secondUser;
    await savePreviewZoom("invoice-list", 2);
    await prisma.user.delete({ where: { id: secondUser } });
    expect(
      await prisma.userPreviewZoom.count({ where: { userId: secondUser } }),
    ).toBe(0);
  });
});
