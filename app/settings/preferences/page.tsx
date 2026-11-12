import { SectionCard } from "@/components/dashboard/section-card";
import { JobsDefaultTabForm } from "@/components/settings/jobs-default-tab-form";
import { SettingsShell } from "@/components/settings/settings-shell";
import { TextSizeForm } from "@/components/settings/text-size-form";
import { requireAuth } from "@/lib/auth/session";

export default async function MyPreferencesPage() {
  const user = await requireAuth();

  return (
    <SettingsShell
      title="My Preferences"
      subtitle={`Your own defaults. They apply only to ${user.displayName}'s sign-in.`}
    >
      <SectionCard
        title="Jobs List"
        description="Which tab opens when you click Jobs."
      >
        <JobsDefaultTabForm current={user.defaultJobsTab} />
      </SectionCard>

      <SectionCard
        title="Text Size"
        description="How big the words on your screens are."
      >
        <TextSizeForm current={user.textSize} />
      </SectionCard>
    </SettingsShell>
  );
}
