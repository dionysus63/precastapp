import { redirect } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  SettingsFeedback,
  SettingsField,
  settingsInputClassName,
  settingsSubmitClassName,
  settingsTextareaClassName,
} from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateOperationsSettingsFormAction } from "@/app/settings/actions";
import { formatLinesList, getAppSettings } from "@/lib/app-settings";

type OperationsSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function saveOperationsSettings(formData: FormData) {
  "use server";
  const result = await updateOperationsSettingsFormAction(formData);
  if (result.error) {
    redirect(`/settings/operations?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/operations?success=1");
}

export default async function OperationsSettingsPage({
  searchParams,
}: OperationsSettingsPageProps) {
  const params = await searchParams;
  const settings = await getAppSettings();

  return (
    <SettingsShell
      title="Fleet & Crew"
      subtitle="Dropdown options for quotes and delivery tickets."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard title="Shop floor lists">
        <form action={saveOperationsSettings} className="grid max-w-xl gap-4">
          <SettingsField label="Estimators" hint="One name per line.">
            <textarea
              name="estimators"
              rows={4}
              defaultValue={formatLinesList(settings.estimators)}
              required
              className={settingsTextareaClassName}
            />
          </SettingsField>
          <SettingsField label="Trucks">
            <textarea
              name="trucks"
              rows={4}
              defaultValue={formatLinesList(settings.trucks)}
              required
              className={settingsTextareaClassName}
            />
          </SettingsField>
          <SettingsField label="Drivers">
            <textarea
              name="drivers"
              rows={4}
              defaultValue={formatLinesList(settings.drivers)}
              required
              className={settingsTextareaClassName}
            />
          </SettingsField>
          <SettingsField label="Trailers">
            <textarea
              name="trailers"
              rows={4}
              defaultValue={formatLinesList(settings.trailers)}
              required
              className={settingsTextareaClassName}
            />
          </SettingsField>
          <SettingsField label="Default truck capacity label">
            <input
              name="truckCapacityLabel"
              defaultValue={settings.truckCapacityLabel}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <button type="submit" className={settingsSubmitClassName}>
            Save
          </button>
        </form>
      </SectionCard>
    </SettingsShell>
  );
}
