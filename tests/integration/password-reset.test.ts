import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Request-scoped plumbing is mocked; Prisma, hashing, and the business rules
// run real against the scratch database.
const hoisted = vi.hoisted(() => ({ cookieToken: "" }));

vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn(),
  requireAuth: vi.fn(),
  signInUser: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  deleteCurrentSession: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () =>
      hoisted.cookieToken ? { value: hoisted.cookieToken } : undefined,
  })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { signInWithPassword } from "@/app/login/actions";
import {
  changeMyPassword,
  resetUserPassword,
} from "@/app/settings/users/actions";
import { verifyPassword } from "@/lib/auth/password";
import {
  requireAuth,
  requirePermission,
  signInUser,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const tag = `PWRESET-${Date.now()}`;

let adminId: string;
let workerId: string;

function loginForm(userId: string, password: string): FormData {
  const formData = new FormData();
  formData.set("userId", userId);
  formData.set("password", password);
  return formData;
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      username: `${tag}-admin`.toLowerCase(),
      displayName: `${tag} Admin`,
      initials: "TA",
      role: "ADMIN",
    },
  });
  adminId = admin.id;
  vi.mocked(requirePermission).mockResolvedValue({
    id: adminId,
    displayName: `${tag} Admin`,
  } as never);

  const worker = await prisma.user.create({
    data: {
      username: `${tag}-worker`.toLowerCase(),
      displayName: `${tag} Worker`,
      initials: "TW",
      role: "PRODUCTION",
    },
  });
  workerId = worker.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { userId: { in: [adminId, workerId] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [adminId, workerId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, workerId] } } });
});

describe("password reset and claim protection", () => {
  it("refuses sign-in for an account that has no password yet", async () => {
    const result = await signInWithPassword(loginForm(workerId, "whatever!!"));
    expect(result?.error).toMatch(/no password yet/i);
    expect(vi.mocked(signInUser)).not.toHaveBeenCalled();
  });

  let tempPassword: string;

  it("admin reset issues a temporary password and revokes sessions", async () => {
    await prisma.session.create({
      data: {
        id: `${tag}-old-sess`,
        token: `${tag}-old-token`,
        userId: workerId,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const formData = new FormData();
    formData.set("id", workerId);
    const result = await resetUserPassword(formData);
    tempPassword = result.tempPassword;

    // Readable format, satisfies the minimum length rule.
    expect(tempPassword).toMatch(/^LIP-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: workerId },
    });
    // Never a claimable null-hash state.
    expect(user.passwordHash).not.toBeNull();
    expect(user.mustChangePassword).toBe(true);
    expect(await verifyPassword(tempPassword, user.passwordHash)).toBe(true);

    const sessions = await prisma.session.findMany({
      where: { userId: workerId },
    });
    expect(sessions).toHaveLength(0);
  });

  it("rejects a wrong password against the temp credential", async () => {
    const result = await signInWithPassword(
      loginForm(workerId, "not-the-temp-password"),
    );
    expect(result?.error).toMatch(/incorrect password/i);
    expect(vi.mocked(signInUser)).not.toHaveBeenCalled();
  });

  it("temp-password sign-in authenticates, then routes to the profile page", async () => {
    vi.mocked(signInUser).mockResolvedValue({
      id: workerId,
      role: "PRODUCTION",
    } as never);

    await expect(
      signInWithPassword(loginForm(workerId, tempPassword)),
    ).rejects.toThrow("REDIRECT:/profile");
    expect(vi.mocked(signInUser)).toHaveBeenCalledWith(workerId);
  });

  it("changing the password requires the temp password and keeps only the current session", async () => {
    // Two live sessions: the device changing the password and another one.
    await prisma.session.createMany({
      data: [
        {
          id: `${tag}-current-sess`,
          token: `${tag}-current-token`,
          userId: workerId,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
        {
          id: `${tag}-other-sess`,
          token: `${tag}-other-token`,
          userId: workerId,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      ],
    });
    hoisted.cookieToken = `${tag}-current-token`;

    const worker = await prisma.user.findUniqueOrThrow({
      where: { id: workerId },
    });
    vi.mocked(requireAuth).mockResolvedValue({
      id: workerId,
      displayName: worker.displayName,
      passwordHash: worker.passwordHash,
    } as never);

    // Wrong current password is rejected.
    const badForm = new FormData();
    badForm.set("currentPassword", "wrong-current!");
    badForm.set("newPassword", "my-new-password-1");
    badForm.set("confirmPassword", "my-new-password-1");
    await expect(changeMyPassword(badForm)).rejects.toThrow(
      /current password is incorrect/i,
    );

    // The temp password authorizes the change.
    const formData = new FormData();
    formData.set("currentPassword", tempPassword);
    formData.set("newPassword", "my-new-password-1");
    formData.set("confirmPassword", "my-new-password-1");
    await expect(changeMyPassword(formData)).rejects.toThrow(
      "REDIRECT:/profile",
    );

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: workerId },
    });
    expect(updated.mustChangePassword).toBe(false);
    expect(await verifyPassword("my-new-password-1", updated.passwordHash)).toBe(
      true,
    );
    expect(await verifyPassword(tempPassword, updated.passwordHash)).toBe(false);

    // Other sessions are revoked; the changing device stays signed in.
    const tokens = (
      await prisma.session.findMany({ where: { userId: workerId } })
    ).map((session) => session.token);
    expect(tokens).toEqual([`${tag}-current-token`]);
  });
});
