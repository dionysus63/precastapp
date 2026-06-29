import { redirect } from "next/navigation";
import { AppPermission } from "@/app/generated/prisma/client";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  SettingsFeedback,
} from "@/components/settings/settings-form-fields";
import { RolePermissionsSettingsForm } from "@/components/settings/role-permissions-settings-form";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateRolePermissionsFormAction } from "@/app/settings/actions";
import { getRoleDefaults } from "@/lib/app-settings";
import { requirePermission } from "@/lib/auth/session";

type RolesSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function saveRolePermissions(formData: FormData) {
  "use server";
  const result = await updateRolePermissionsFormAction(formData);
  if (result.error) {
    redirect(`/settings/roles?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/roles?success=1");
}

export default async function RolesSettingsPage({
  searchParams,
}: RolesSettingsPageProps) {
  await requirePermission(AppPermission.USERS_MANAGE);
  const params = await searchParams;
  const roleDefaults = await getRoleDefaults();

  return (
    <SettingsShell
      title="Roles & Permissions"
      subtitle="Default permissions for each role. Changes apply to all users with that role unless they have personal overrides."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Role defaults saved." : null}
      />

      <SectionCard title="Role Defaults">
        <RolePermissionsSettingsForm
          action={saveRolePermissions}
          roleDefaults={roleDefaults}
        />
      </SectionCard>
    </SettingsShell>
  );
}
