import { notFound } from "next/navigation";
import { AppPermission } from "@/app/generated/prisma/client";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { UserPermissionsForm } from "@/components/settings/user-permissions-form";
import { ResetPasswordButton } from "@/components/settings/reset-password-button";
import { updateUser, resetUserPassword } from "@/app/settings/users/actions";
import { getRoleDefaults } from "@/lib/app-settings";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type EditSettingsUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSettingsUserPage({
  params,
}: EditSettingsUserPageProps) {
  await requirePermission(AppPermission.USERS_MANAGE);
  const { id } = await params;
  const roleDefaults = await getRoleDefaults();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    notFound();
  }

  return (
    <SettingsShell
      title={`Edit ${user.displayName}`}
      subtitle={`@${user.username}`}
    >
      <SectionCard title="User Details">
        <UserPermissionsForm
          action={updateUser}
          cancelHref="/settings/users"
          submitLabel="Save Changes"
          expectedUpdatedAt={user.updatedAt.toISOString()}
          roleDefaults={roleDefaults}
          defaultValues={{
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            initials: user.initials,
            email: user.email ?? "",
            role: user.role,
            isActive: user.isActive,
            grantedPermissions: user.grantedPermissions,
            deniedPermissions: user.deniedPermissions,
          }}
        />
      </SectionCard>

      <SectionCard title="Password">
        <p className="text-sm text-slate-600">
          Reset this user&apos;s password. They will be signed out and must create
          a new password the next time they sign in.
        </p>
        <ResetPasswordButton userId={user.id} action={resetUserPassword} />
      </SectionCard>
    </SettingsShell>
  );
}
