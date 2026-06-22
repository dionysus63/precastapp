"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AppPermission,
  UserRole,
} from "@/app/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
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

  const user = await prisma.user.update({
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

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  await prisma.session.deleteMany({ where: { userId: id } });

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
