import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPermission } from "@/app/generated/prisma/client";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { UsersList } from "@/components/settings/users-list";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function SettingsUsersPage() {
  await requirePermission(AppPermission.USERS_MANAGE);

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
  });

  return (
    <SettingsShell
      title="Users & Access"
      subtitle="Manage who can sign in and what each person can do."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            {users.filter((user) => user.isActive).length} active user
            {users.filter((user) => user.isActive).length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings/users/audit"
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Audit Log
          </Link>
          <Link
            href="/settings/users/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Add User
          </Link>
        </div>
      </div>

      <SectionCard
        title="User Accounts"
        description="Deactivate users instead of deleting them to preserve audit history."
        noPadding
      >
        <UsersList
          users={users.map((user) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            initials: user.initials,
            role: user.role,
            isActive: user.isActive,
            lastLoginAt: user.lastLoginAt
              ? user.lastLoginAt.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : null,
          }))}
        />
      </SectionCard>
    </SettingsShell>
  );
}
