import { AppPermission } from "@/app/generated/prisma/client";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
import { BackButton } from "@/components/dashboard/back-button";
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
        <BackButton href="/settings/users" label="Back to Users & Access" />
      </div>

      <SectionCard title="Recent Activity" noPadding>
        <div className="overflow-hidden">
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>
                  When
                </th>
                <th className={tableHeaderCellClassName}>
                  User
                </th>
                <th className={tableHeaderCellClassName}>
                  Action
                </th>
                <th className={tableHeaderCellClassName}>
                  Summary
                </th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className={`${tableCellClassName} text-slate-600`}>
                    {log.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className={`${tableCellClassName} text-slate-700`}>
                    {log.user
                      ? `${log.user.displayName} (@${log.user.username})`
                      : "System"}
                  </td>
                  <td className={`${tableCellClassName} font-medium text-slate-800`}>
                    {log.action}
                  </td>
                  <td className={`${tableCellClassName} text-slate-600`}>
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
