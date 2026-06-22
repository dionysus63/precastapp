"use server";

import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/auth/audit";
import { getDefaultHome } from "@/lib/auth/permissions";
import {
  deleteCurrentSession,
  getCurrentUser,
  signInUser,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function signInAsUser(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    throw new Error("User is required.");
  }

  const user = await signInUser(userId);
  redirect(getDefaultHome(user));
}

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

export async function getActiveLoginUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ displayName: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      initials: true,
      role: true,
    },
  });
}
