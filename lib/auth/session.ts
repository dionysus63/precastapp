import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppPermission } from "@/app/generated/prisma/client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  canAccessPath,
  getDefaultHome,
  getEffectivePermissions,
  hasPermission,
  type AuthUser,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export { SESSION_COOKIE_NAME };

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const SESSION_SLIDE_THRESHOLD_SECONDS = 60 * 60 * 24;

/** Secure cookies are ignored by browsers on plain HTTP (LAN deploys). Set SESSION_COOKIE_SECURE=true only behind HTTPS. */
function useSecureSessionCookie(): boolean {
  const explicit = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return false;
}

function getSessionExpiryDate(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

async function refreshSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureSessionCookie(),
    path: "/",
    expires: expiresAt,
  });
}

async function slideSessionIfNeeded(session: {
  id: string;
  token: string;
  expiresAt: Date;
}): Promise<Date> {
  const remainingSeconds = Math.floor(
    (session.expiresAt.getTime() - Date.now()) / 1000,
  );

  if (remainingSeconds > SESSION_SLIDE_THRESHOLD_SECONDS) {
    return session.expiresAt;
  }

  const expiresAt = getSessionExpiryDate();

  // Cookies can only be modified in a Server Action or Route Handler; during
  // server-component rendering the set() call throws. Refresh the cookie
  // first and only extend the database expiry when it succeeds, so the two
  // never drift apart. Render-path calls skip the slide and it happens on
  // the next Server Action instead.
  try {
    await refreshSessionCookie(session.token, expiresAt);
  } catch {
    return session.expiresAt;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt },
  });

  return expiresAt;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = getSessionExpiryDate();

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  await refreshSessionCookie(token, expiresAt);

  return token;
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  if (!session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  await slideSessionIfNeeded(session);

  return session.user;
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requirePermission(
  permission: AppPermission,
): Promise<AuthUser> {
  const user = await requireAuth();

  if (!(await hasPermission(user, permission))) {
    throw new Error("You don't have permission to do that.");
  }

  return user;
}

export async function requireAuthForPath(pathname: string): Promise<AuthUser> {
  const user = await requireAuth();

  if (!(await canAccessPath(user, pathname))) {
    redirect(getDefaultHome(user));
  }

  return user;
}

export async function signInUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.isActive) {
    throw new Error("That user account is not available.");
  }

  await createSession(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    userId: user.id,
    action: "auth.sign_in",
    entityType: "User",
    entityId: user.id,
    summary: `${user.displayName} signed in`,
  });

  return user;
}

export async function getUserPermissions(
  user: AuthUser,
): Promise<AppPermission[]> {
  return getEffectivePermissions(user);
}
