"use server";

import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  getAccessibleHome,
  getEffectivePermissions,
} from "@/lib/auth/permissions";
import { verifyPassword } from "@/lib/auth/password";
import {
  deleteCurrentSession,
  getCurrentUser,
  signInUser,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Deliberately minimal: the unauthenticated picker must not leak roles or
// password/reset state (a claimable-account beacon).
export type LoginUserOption = {
  id: string;
  username: string;
  displayName: string;
  initials: string;
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
    },
  });

  return users;
}

function parsePasswordFields(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!userId) {
    throw new Error("User is required.");
  }

  return { userId, password };
}

async function getActiveUserForLogin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.isActive ? user : null;
}

export async function signInWithPassword(
  formData: FormData,
): Promise<{ error: string } | never> {
  const { userId, password } = parsePasswordFields(formData);

  if (!password) {
    return { error: "Password is required." };
  }

  // Returned, not thrown: a thrown message never reaches the user in
  // production (e.g. picking an account deactivated since the list loaded).
  const user = await getActiveUserForLogin(userId);
  if (!user) {
    return { error: "That user account is not available." };
  }

  if (!user.passwordHash) {
    return {
      error:
        "This account has no password yet. Ask an admin to issue a temporary password from Settings → Users.",
    };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { error: "Incorrect password." };
  }

  const signedInUser = await signInUser(user.id);

  // Temp-password sign-in: authenticated, but must pick a real password
  // (verified against the temp one) before anything else.
  if (user.mustChangePassword) {
    redirect("/profile");
  }

  redirect(
    getAccessibleHome(signedInUser, await getEffectivePermissions(signedInUser)),
  );
}
