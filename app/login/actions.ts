"use server";

import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/auth/audit";
import { getDefaultHome } from "@/lib/auth/permissions";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import {
  deleteCurrentSession,
  getCurrentUser,
  signInUser,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type LoginUserOption = {
  id: string;
  username: string;
  displayName: string;
  initials: string;
  role: string;
  hasPassword: boolean;
  mustChangePassword: boolean;
};

export async function signOut() {
  const user = await getCurrentUser();

  if (user) {
    await writeAuditLog({
      userId: user.id,
      action: "auth.sign_out",
      entityType: "User",
      entityId: user.id,
      summary: `${user.displayName} signed out`,
    });
  }

  await deleteCurrentSession();
  redirect("/login");
}

export async function getActiveLoginUsers(): Promise<LoginUserOption[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ displayName: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      initials: true,
      role: true,
      passwordHash: true,
      mustChangePassword: true,
    },
  });

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    initials: user.initials,
    role: user.role,
    hasPassword: Boolean(user.passwordHash),
    mustChangePassword: user.mustChangePassword,
  }));
}

function parsePasswordFields(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!userId) {
    throw new Error("User is required.");
  }

  return { userId, password, confirmPassword };
}

async function getActiveUserForLogin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.isActive) {
    throw new Error("That user account is not available.");
  }

  return user;
}

export async function signInWithPassword(
  formData: FormData,
): Promise<{ error: string } | never> {
  const { userId, password } = parsePasswordFields(formData);

  if (!password) {
    return { error: "Password is required." };
  }

  const user = await getActiveUserForLogin(userId);

  if (!user.passwordHash) {
    return { error: "Create a password for this account first." };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { error: "Incorrect password." };
  }

  const signedInUser = await signInUser(user.id);
  redirect(getDefaultHome(signedInUser));
}

export async function setInitialPassword(
  formData: FormData,
): Promise<{ error: string } | never> {
  const { userId, password, confirmPassword } = parsePasswordFields(formData);

  if (!password || !confirmPassword) {
    return { error: "Enter and confirm your password." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    return { error: strengthError };
  }

  const user = await getActiveUserForLogin(userId);

  if (user.passwordHash && !user.mustChangePassword) {
    return { error: "This account already has a password. Sign in instead." };
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  const signedInUser = await signInUser(user.id);
  redirect(getDefaultHome(signedInUser));
}
