import Link from "next/link";
import { AppPermission } from "@/app/generated/prisma/client";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function SettingsUsersAuditPage() {
  await requirePermission(AppPermission.USERS_MANAGE);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          displayName: true,
          username: true,
        },
      },
    },
  });

  return (
    <SettingsShell
      title="Audit Log"
      subtitle="Recent sign-ins, user changes, and other tracked actions."
    >
      <div>
        <Link
          href="/settings/users"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Users & Access
        </Link>
      </div>

      <SectionCard title="Recent Activity" noPadding>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  When
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  User
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Action
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-slate-600">
                    {log.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {log.user
                      ? `${log.user.displayName} (@${log.user.username})`
                      : "System"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.summary ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </SettingsShell>
  );
}
