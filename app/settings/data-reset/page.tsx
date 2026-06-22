import { SectionCard } from "@/components/dashboard/section-card";
import { DataResetPanel } from "@/components/settings/data-reset-panel";
import { SettingsShell } from "@/components/settings/settings-shell";
import { getDataResetStats } from "@/app/settings/actions";

export default async function DataResetSettingsPage() {
  const stats = await getDataResetStats();

  return (
    <SettingsShell
      title="Data Reset"
      subtitle="Clear all products or customers. These actions cannot be undone."
    >
      <SectionCard
        title="Danger zone"
        description="Type the reset password from your .env file to confirm each action."
      >
        <DataResetPanel stats={stats} />
      </SectionCard>
    </SettingsShell>
  );
}
