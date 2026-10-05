import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Only the request-scoped cookie store is mocked: the session lookup, expiry,
// sliding refresh, role defaults (from the AppSettings row) and per-user
// overrides all run real against the scratch database. The cookie value the
// code reads comes from `cookieJar.token`.
const cookieJar = vi.hoisted(() => ({
  token: "" as string,
  setCalls: [] as Array<{ name: string; value: string; options: unknown }>,
  deleteCalls: [] as string[],
  setThrows: false,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "precastapp_session" && cookieJar.token
        ? { name, value: cookieJar.token }
        : undefined,
    set: (name: string, value: string, options: unknown) => {
      if (cookieJar.setThrows) {
        // What Next does when a Server Component render tries to set a cookie.
        throw new Error("Cookies can only be modified in a Server Action");
      }
      cookieJar.setCalls.push({ name, value, options });
    },
    delete: (name: string) => {
      cookieJar.deleteCalls.push(name);
    },
  })),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { AppPermission } from "@/app/generated/prisma/client";
import { getAppSettings, getRoleDefaults, invalidateAppSettingsCache } from "@/lib/app-settings";
import { ALL_PERMISSION_KEYS, SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { getEffectivePermissions, hasPermission } from "@/lib/auth/permissions";
import {
  createSession,
  deleteCurrentSession,
  getCurrentUser,
  requireAuth,
  requirePermission,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const tag = `AUTHSESS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const HOUR_MS = 60 * 60 * 1000;
const SESSION_MAX_AGE_MS = 8 * HOUR_MS;

const userIds: string[] = [];

async function createTestUser(
  suffix: string,
  data: {
    role: "ADMIN" | "MANAGER" | "ESTIMATOR" | "DISPATCHER" | "PRODUCTION" | "OFFICE" | "READ_ONLY";
    grantedPermissions?: AppPermission[];
    deniedPermissions?: AppPermission[];
    isActive?: boolean;
  },
) {
  const user = await prisma.user.create({
    data: {
      username: `${tag}-${suffix}`.toLowerCase(),
      displayName: `${tag} ${suffix}`,
      initials: "TS",
      role: data.role,
      grantedPermissions: data.grantedPermissions ?? [],
      deniedPermissions: data.deniedPermissions ?? [],
      isActive: data.isActive ?? true,
    },
  });
  userIds.push(user.id);
  return user;
}

async function createSessionRow(userId: string, suffix: string, expiresAt: Date) {
  const token = `${tag}-${suffix}-token`;
  await prisma.session.create({
    data: { id: `${tag}-${suffix}`, token, userId, expiresAt },
  });
  return token;
}

/** Sign the cookie jar in as `userId` with a fresh, full-length session. */
async function signInAs(userId: string, suffix: string) {
  cookieJar.token = await createSessionRow(
    userId,
    suffix,
    new Date(Date.now() + SESSION_MAX_AGE_MS),
  );
}

beforeAll(async () => {
  // Make sure the settings row exists so role defaults come from the DB.
  await getAppSettings();
});

beforeEach(() => {
  cookieJar.token = "";
  cookieJar.setCalls = [];
  cookieJar.deleteCalls = [];
  cookieJar.setThrows = false;
  invalidateAppSettingsCache();
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  invalidateAppSettingsCache();
  await prisma.$disconnect();
});

describe("effective permissions", () => {
  it("uses the role's configured defaults when the user has no overrides", async () => {
    const user = await createTestUser("prod-plain", { role: "PRODUCTION" });
    const roleDefaults = await getRoleDefaults();

    const effective = await getEffectivePermissions(user);
    const expected = ALL_PERMISSION_KEYS.filter((key) =>
      roleDefaults.PRODUCTION.includes(key),
    );
    expect(effective).toEqual(expected);
  });

  it("gives ADMIN every permission regardless of stored role defaults", async () => {
    const user = await createTestUser("admin", {
      role: "ADMIN",
      deniedPermissions: [AppPermission.USERS_MANAGE],
    });
    expect(await getEffectivePermissions(user)).toEqual([...ALL_PERMISSION_KEYS]);
  });

  it("a per-user GRANT adds a permission the role lacks", async () => {
    const roleDefaults = await getRoleDefaults();
    const missing = ALL_PERMISSION_KEYS.find(
      (key) => !roleDefaults.DISPATCHER.includes(key),
    );
    expect(missing).toBeDefined();
    const granted = missing as AppPermission;

    const plain = await createTestUser("disp-plain", { role: "DISPATCHER" });
    const withGrant = await createTestUser("disp-grant", {
      role: "DISPATCHER",
      grantedPermissions: [granted],
    });

    expect(await hasPermission(plain, granted)).toBe(false);
    expect(await hasPermission(withGrant, granted)).toBe(true);
    // Everything else the role has is kept.
    for (const key of roleDefaults.DISPATCHER) {
      expect(await hasPermission(withGrant, key as AppPermission)).toBe(true);
    }
  });

  it("a per-user DENY removes a permission the role has", async () => {
    const roleDefaults = await getRoleDefaults();
    const present = roleDefaults.OFFICE[0] as AppPermission | undefined;
    expect(present).toBeDefined();

    const withDeny = await createTestUser("office-deny", {
      role: "OFFICE",
      deniedPermissions: [present!],
    });

    const effective = await getEffectivePermissions(withDeny);
    expect(effective).not.toContain(present);
    expect(effective).toHaveLength(roleDefaults.OFFICE.length - 1);
  });

  it("DENY wins over a GRANT of the same permission", async () => {
    const user = await createTestUser("grant-and-deny", {
      role: "READ_ONLY",
      grantedPermissions: [AppPermission.USERS_MANAGE],
      deniedPermissions: [AppPermission.USERS_MANAGE],
    });
    expect(await hasPermission(user, AppPermission.USERS_MANAGE)).toBe(false);
  });

  it("honours an explicitly empty role permission list stored in settings", async () => {
    // The role map lives on the shared AppSettings row: change only the
    // ESTIMATOR entry for this test and restore the original JSON right after.
    const original = await prisma.appSettings.findUniqueOrThrow({
      where: { id: "default" },
      select: { rolePermissions: true },
    });
    const originalMap =
      original.rolePermissions &&
      typeof original.rolePermissions === "object" &&
      !Array.isArray(original.rolePermissions)
        ? (original.rolePermissions as Record<string, unknown>)
        : {};

    const estimator = await createTestUser("est-empty", { role: "ESTIMATOR" });
    const estimatorWithGrant = await createTestUser("est-empty-grant", {
      role: "ESTIMATOR",
      grantedPermissions: [AppPermission.QUOTES_VIEW],
    });

    try {
      await prisma.appSettings.update({
        where: { id: "default" },
        data: { rolePermissions: { ...originalMap, ESTIMATOR: [] } },
      });
      invalidateAppSettingsCache();

      expect((await getRoleDefaults()).ESTIMATOR).toEqual([]);
      // Not replaced by the built-in ESTIMATOR defaults.
      expect(await getEffectivePermissions(estimator)).toEqual([]);
      expect(await hasPermission(estimator, AppPermission.QUOTES_MANAGE)).toBe(false);
      // Per-user grants still apply on top of the empty role.
      expect(await getEffectivePermissions(estimatorWithGrant)).toEqual([
        AppPermission.QUOTES_VIEW,
      ]);
    } finally {
      await prisma.appSettings.update({
        where: { id: "default" },
        data: { rolePermissions: original.rolePermissions as object },
      });
      invalidateAppSettingsCache();
    }
  });
});

describe("session lifecycle", () => {
  it("createSession stores a row, sets an httpOnly cookie, and the token validates", async () => {
    const user = await createTestUser("create", { role: "OFFICE" });

    const before = Date.now();
    const token = await createSession(user.id);

    const row = await prisma.session.findUniqueOrThrow({ where: { token } });
    expect(row.userId).toBe(user.id);
    const lifetime = row.expiresAt.getTime() - before;
    expect(lifetime).toBeGreaterThan(SESSION_MAX_AGE_MS - 60_000);
    expect(lifetime).toBeLessThanOrEqual(SESSION_MAX_AGE_MS + 60_000);

    expect(cookieJar.setCalls).toHaveLength(1);
    expect(cookieJar.setCalls[0]).toMatchObject({
      name: SESSION_COOKIE_NAME,
      value: token,
      options: { httpOnly: true, sameSite: "lax", path: "/" },
    });

    cookieJar.token = token;
    const current = await getCurrentUser();
    expect(current?.id).toBe(user.id);
  });

  it("returns null without a cookie or for an unknown token", async () => {
    expect(await getCurrentUser()).toBeNull();
    cookieJar.token = `${tag}-no-such-token`;
    expect(await getCurrentUser()).toBeNull();
  });

  it("rejects and deletes an expired session (Prisma-written UTC expiry)", async () => {
    const user = await createTestUser("expired", { role: "OFFICE" });
    cookieJar.token = await createSessionRow(
      user.id,
      "expired",
      new Date(Date.now() - 60_000),
    );

    expect(await getCurrentUser()).toBeNull();
    expect(
      await prisma.session.findUnique({ where: { token: cookieJar.token } }),
    ).toBeNull();
  });

  it("reads a raw UTC timestamp correctly: expired a minute ago is rejected, a minute ahead is accepted", async () => {
    // Timestamp columns are timezone-less and hold UTC (what Prisma writes);
    // rows inserted by hand via psql must use `now() at time zone 'utc'`. If
    // the code misread the column as local time, these two would flip.
    const user = await createTestUser("raw-utc", { role: "OFFICE" });
    const expiredToken = `${tag}-raw-expired-token`;
    const liveToken = `${tag}-raw-live-token`;
    await prisma.$executeRaw`
      INSERT INTO "Session" ("id", "token", "userId", "expiresAt")
      VALUES
        (${`${tag}-raw-expired`}, ${expiredToken}, ${user.id},
         (now() at time zone 'utc') - interval '1 minute'),
        (${`${tag}-raw-live`}, ${liveToken}, ${user.id},
         (now() at time zone 'utc') + interval '1 minute')`;

    cookieJar.token = expiredToken;
    expect(await getCurrentUser()).toBeNull();
    expect(await prisma.session.findUnique({ where: { token: expiredToken } })).toBeNull();

    cookieJar.token = liveToken;
    expect((await getCurrentUser())?.id).toBe(user.id);
  });

  it("slides the expiry of a session that is used near the end of its window", async () => {
    const user = await createTestUser("slide", { role: "OFFICE" });
    const oldExpiry = new Date(Date.now() + HOUR_MS);
    cookieJar.token = await createSessionRow(user.id, "slide", oldExpiry);

    const before = Date.now();
    expect((await getCurrentUser())?.id).toBe(user.id);

    const row = await prisma.session.findUniqueOrThrow({
      where: { token: cookieJar.token },
    });
    expect(row.expiresAt.getTime()).toBeGreaterThan(oldExpiry.getTime());
    expect(row.expiresAt.getTime() - before).toBeGreaterThan(
      SESSION_MAX_AGE_MS - 60_000,
    );
    // The cookie is refreshed with the same token and the new expiry.
    expect(cookieJar.setCalls).toHaveLength(1);
    expect(cookieJar.setCalls[0].value).toBe(cookieJar.token);
    expect(
      (cookieJar.setCalls[0].options as { expires: Date }).expires.getTime(),
    ).toBe(row.expiresAt.getTime());
  });

  it("does not touch a session that was refreshed recently", async () => {
    const user = await createTestUser("fresh", { role: "OFFICE" });
    const expiry = new Date(Date.now() + SESSION_MAX_AGE_MS - 5 * 60_000);
    cookieJar.token = await createSessionRow(user.id, "fresh", expiry);

    expect((await getCurrentUser())?.id).toBe(user.id);
    const row = await prisma.session.findUniqueOrThrow({
      where: { token: cookieJar.token },
    });
    expect(row.expiresAt.getTime()).toBe(expiry.getTime());
    expect(cookieJar.setCalls).toHaveLength(0);
  });

  it("keeps the DB expiry unchanged when the cookie cannot be set (render path)", async () => {
    const user = await createTestUser("render", { role: "OFFICE" });
    const oldExpiry = new Date(Date.now() + HOUR_MS);
    cookieJar.token = await createSessionRow(user.id, "render", oldExpiry);
    cookieJar.setThrows = true;

    expect((await getCurrentUser())?.id).toBe(user.id);
    const row = await prisma.session.findUniqueOrThrow({
      where: { token: cookieJar.token },
    });
    expect(row.expiresAt.getTime()).toBe(oldExpiry.getTime());
  });

  it("rejects and deletes the session of a deactivated user", async () => {
    const user = await createTestUser("inactive", { role: "OFFICE" });
    await signInAs(user.id, "inactive");
    expect((await getCurrentUser())?.id).toBe(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    expect(await getCurrentUser()).toBeNull();
    expect(
      await prisma.session.findUnique({ where: { token: cookieJar.token } }),
    ).toBeNull();
  });

  it("deleteCurrentSession removes the row and clears the cookie", async () => {
    const user = await createTestUser("signout", { role: "OFFICE" });
    await signInAs(user.id, "signout");
    const token = cookieJar.token;

    await deleteCurrentSession();

    expect(await prisma.session.findUnique({ where: { token } })).toBeNull();
    expect(cookieJar.deleteCalls).toEqual([SESSION_COOKIE_NAME]);
  });
});

describe("requireAuth / requirePermission", () => {
  it("returns the user when they hold the permission", async () => {
    const user = await createTestUser("perm-ok", { role: "OFFICE" });
    await signInAs(user.id, "perm-ok");
    const roleDefaults = await getRoleDefaults();
    const held = roleDefaults.OFFICE[0] as AppPermission;

    const result = await requirePermission(held);
    expect(result.id).toBe(user.id);
  });

  it("allows a permission that comes only from a per-user GRANT", async () => {
    const user = await createTestUser("perm-grant", {
      role: "READ_ONLY",
      grantedPermissions: [AppPermission.USERS_MANAGE],
    });
    await signInAs(user.id, "perm-grant");

    expect((await requirePermission(AppPermission.USERS_MANAGE)).id).toBe(user.id);
  });

  it("throws a permission error (no redirect) when the user lacks it", async () => {
    const user = await createTestUser("perm-denied", {
      role: "MANAGER",
      deniedPermissions: [AppPermission.INVOICES_MANAGE],
    });
    await signInAs(user.id, "perm-denied");

    await expect(requirePermission(AppPermission.INVOICES_MANAGE)).rejects.toThrow(
      "You don't have permission to do that.",
    );
    // READ_ONLY never gets USERS_MANAGE by default.
    const readOnly = await createTestUser("perm-readonly", { role: "READ_ONLY" });
    await signInAs(readOnly.id, "perm-readonly");
    await expect(requirePermission(AppPermission.USERS_MANAGE)).rejects.toThrow(
      "You don't have permission to do that.",
    );
  });

  it("redirects to /login when there is no valid session", async () => {
    const assertLoginRedirect = (error: unknown) => {
      const digest = String((error as { digest?: string }).digest ?? "");
      expect(digest.startsWith("NEXT_REDIRECT")).toBe(true);
      expect(digest).toContain("/login");
    };

    await requireAuth().then(
      () => expect.fail("requireAuth should redirect"),
      assertLoginRedirect,
    );
    await requirePermission(AppPermission.CUSTOMERS_VIEW).then(
      () => expect.fail("requirePermission should redirect"),
      assertLoginRedirect,
    );

    const user = await createTestUser("perm-expired", { role: "MANAGER" });
    cookieJar.token = await createSessionRow(
      user.id,
      "perm-expired",
      new Date(Date.now() - 1000),
    );
    await requirePermission(AppPermission.CUSTOMERS_VIEW).then(
      () => expect.fail("expired session should redirect"),
      assertLoginRedirect,
    );
  });
});
