"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AppPermission,
  UserRole,
} from "@/app/generated/prisma/client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { writeAuditLog } from "@/lib/auth/audit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

function parseGrantedPermissions(formData: FormData): AppPermission[] {
  return formData
    .getAll("grantedPermissions")
    .map((value) => String(value))
    .filter((value): value is AppPermission =>
      Object.values(AppPermission).includes(value as AppPermission),
    );
}

function parseDeniedPermissions(formData: FormData): AppPermission[] {
  return formData
    .getAll("deniedPermissions")
    .map((value) => String(value))
    .filter((value): value is AppPermission =>
      Object.values(AppPermission).includes(value as AppPermission),
    );
}

function parseUserRole(value: string): UserRole {
  if (!Object.values(UserRole).includes(value as UserRole)) {
    throw new Error("Role is required.");
  }

  return value as UserRole;
}

export async function createUser(formData: FormData) {
  const actor = await requirePermission(AppPermission.USERS_MANAGE);

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();
  const email = String(formData.get("email") ?? "").trim() || null;
  const role = parseUserRole(String(formData.get("role") ?? "").trim());
  const isActive = formData.get("isActive") === "on";
  const grantedPermissions = parseGrantedPermissions(formData);
  const deniedPermissions = parseDeniedPermissions(formData);

  if (!username || !USERNAME_PATTERN.test(username)) {
    throw new Error(
      "Username is required and may only contain lowercase letters, numbers, dots, dashes, and underscores.",
    );
  }

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (!initials || initials.length < 2 || initials.length > 3) {
    throw new Error("Initials must be 2 or 3 characters.");
  }

  const user = await prisma.user.create({
    data: {
      username,
      displayName,
      initials,
      email,
      role,
      isActive,
      grantedPermissions,
      deniedPermissions,
    },
  });

  await writeAuditLog({
    userId: actor.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    summary: `Created user ${user.displayName}`,
  });

  revalidatePath("/settings/users");
  redirect(`/settings/users/${user.id}`);
}

export async function updateUser(formData: FormData) {
  const actor = await requirePermission(AppPermission.USERS_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("User id is required.");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();
  const email = String(formData.get("email") ?? "").trim() || null;
  const role = parseUserRole(String(formData.get("role") ?? "").trim());
  const isActive = formData.get("isActive") === "on";
  const grantedPermissions = parseGrantedPermissions(formData);
  const deniedPermissions = parseDeniedPermissions(formData);

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (!initials || initials.length < 2 || initials.length > 3) {
    throw new Error("Initials must be 2 or 3 characters.");
  }

  const expectedUpdatedAtRaw = String(
    formData.get("expectedUpdatedAt") ?? "",
  ).trim();

  const user = await prisma.$transaction(async (tx) => {
    if (expectedUpdatedAtRaw) {
      // Permission arrays are replaced wholesale, so a stale save would
      // silently discard another admin's changes (optimistic concurrency).
      const current = await tx.user.findUnique({
        where: { id },
        select: { updatedAt: true },
      });
      const expected = new Date(expectedUpdatedAtRaw);
      if (
        !current ||
        Number.isNaN(expected.getTime()) ||
        current.updatedAt.getTime() !== expected.getTime()
      ) {
        throw new Error(
          "This user was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.",
        );
      }
    }

    return tx.user.update({
      where: { id },
      data: {
        displayName,
        initials,
        email,
        role,
        isActive,
        grantedPermissions,
        deniedPermissions,
      },
    });
  });

  await writeAuditLog({
    userId: actor.id,
    action: "user.update",
    entityType: "User",
    entityId: user.id,
    summary: `Updated user ${user.displayName}`,
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${user.id}`);
  redirect(`/settings/users/${user.id}`);
}

export async function deactivateUser(formData: FormData) {
  const actor = await requirePermission(AppPermission.USERS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("User id is required.");
  }

  if (id === actor.id) {
    throw new Error("You cannot deactivate your own account.");
  }

  // Deactivation and session revocation commit together: a partial failure
  // must not leave a deactivated user with a still-valid session.
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { isActive: false },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    return updated;
  });

  await writeAuditLog({
    userId: actor.id,
    action: "user.deactivate",
    entityType: "User",
    entityId: user.id,
    summary: `Deactivated user ${user.displayName}`,
  });

  revalidatePath("/settings/users");
}

export async function reactivateUser(formData: FormData) {
  const actor = await requirePermission(AppPermission.USERS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("User id is required.");
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: true },
  });

  await writeAuditLog({
    userId: actor.id,
    action: "user.reactivate",
    entityType: "User",
    entityId: user.id,
    summary: `Reactivated user ${user.displayName}`,
  });

  revalidatePath("/settings/users");
}

export async function updateMyProfile(formData: FormData) {
  const user = await requireAuth();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (!initials || initials.length < 2 || initials.length > 3) {
    throw new Error("Initials must be 2 or 3 characters.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { displayName, initials },
  });

  revalidatePath("/profile");
  redirect("/profile");
}

/** Unambiguous alphabet (no 0/O, 1/I/L) for read-aloud temp passwords. */
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateTempPassword(): string {
  const block = (length: number) =>
    Array.from(
      { length },
      () => TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)],
    ).join("");
  return `LIP-${block(4)}-${block(4)}`;
}

/**
 * Generates a temporary password the admin hands to the user out of band.
 * The account is never left claimable: sign-in always requires a password,
 * and `mustChangePassword` sends the user to their profile to pick a real
 * one (verified against the temp password) after they authenticate.
 */
export async function resetUserPassword(
  formData: FormData,
): Promise<{ tempPassword: string }> {
  const actor = await requirePermission(AppPermission.USERS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("User id is required.");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  // Reset and session revocation commit together (same reasoning as
  // deactivateUser): no window where the old sessions outlive the reset.
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    return updated;
  });

  await writeAuditLog({
    userId: actor.id,
    action: "user.reset_password",
    entityType: "User",
    entityId: user.id,
    summary: `Reset password for ${user.displayName} (temporary password issued)`,
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${user.id}`);
  return { tempPassword };
}

export async function changeMyPassword(formData: FormData) {
  const user = await requireAuth();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error("All password fields are required.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("New passwords do not match.");
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    throw new Error(strengthError);
  }

  if (!user.passwordHash) {
    throw new Error("Set your password from the sign-in screen first.");
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new Error("Current password is incorrect.");
  }

  const passwordHash = await hashPassword(newPassword);

  // Revoke every other session for this user: after a password change (e.g.
  // rotating away from a temp password) only the current device stays in.
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });
    await tx.session.deleteMany({
      where: { userId: user.id, token: { not: currentToken } },
    });
  });

  await writeAuditLog({
    userId: user.id,
    action: "auth.change_password",
    entityType: "User",
    entityId: user.id,
    summary: `${user.displayName} changed their password`,
  });

  revalidatePath("/profile");
  redirect("/profile");
}
