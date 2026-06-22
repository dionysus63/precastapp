import { SettingsShell } from "@/components/settings/settings-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { UserPermissionsForm } from "@/components/settings/user-permissions-form";
import { createUser } from "@/app/settings/users/actions";
import { AppPermission, UserRole } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";

export default async function NewSettingsUserPage() {
  await requirePermission(AppPermission.USERS_MANAGE);

  return (
    <SettingsShell
      title="Add User"
      subtitle="Create a new account and assign a role with optional permission overrides."
    >
      <SectionCard title="User Details">
        <UserPermissionsForm
          action={createUser}
          cancelHref="/settings/users"
          submitLabel="Create User"
          showUsernameField
          defaultValues={{
            displayName: "",
            initials: "",
            email: "",
            role: UserRole.OFFICE,
            isActive: true,
            grantedPermissions: [],
            deniedPermissions: [],
          }}
        />
      </SectionCard>
    </SettingsShell>
  );
}
