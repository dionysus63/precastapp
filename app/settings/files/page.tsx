import { redirect } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import { JobsRootTestButton, StockSubmittalsRootTestButton } from "@/components/settings/settings-action-buttons";
import {
  SettingsFeedback,
  SettingsField,
  settingsInputClassName,
  settingsSubmitClassName,
} from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateFileSettingsFormAction } from "@/app/settings/actions";
import { getAppSettings } from "@/lib/app-settings";

type FileSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function saveFileSettings(formData: FormData) {
  "use server";
  const result = await updateFileSettingsFormAction(formData);
  if (result.error) {
    redirect(`/settings/files?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/files?success=1");
}

export default async function FileSettingsPage({
  searchParams,
}: FileSettingsPageProps) {
  const params = await searchParams;
  const settings = await getAppSettings();
  const year = new Date().getFullYear();
  const previewPath = `${settings.jobsRoot}\\${year}\\26-001 - Customer Name - Project Name\\${settings.jobSubfolders[0] ?? "01 Construction Plans"}`;

  return (
    <SettingsShell
      title="Files & Folders"
      subtitle="Windows job folder root, stock submittals, and PDF output paths."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard title="Storage paths">
        <form action={saveFileSettings} className="grid max-w-xl gap-4">
          <SettingsField
            label="Jobs root"
            hint="Local path or UNC (e.g. \\\\SERVER\\Jobs). New job folders are created here."
          >
            <input
              name="jobsRoot"
              defaultValue={settings.jobsRoot}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField
            label="Quote PDF fallback directory"
            hint="Used when a job has no folder yet."
          >
            <input
              name="quotePdfFallbackDir"
              defaultValue={settings.quotePdfFallbackDir}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField
            label="Stock submittals root"
            hint="Catalog submittals are stored in subfolders named by product code (e.g. C:\StockSubmittals\MH-48)."
          >
            <input
              name="stockSubmittalsRoot"
              defaultValue={settings.stockSubmittalsRoot}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={settingsSubmitClassName}>
              Save paths
            </button>
            <JobsRootTestButton />
            <StockSubmittalsRootTestButton />
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Job folder template"
        description="Subfolder names are fixed for existing jobs. Renaming requires a disk migration."
      >
        <p className="mb-3 font-mono text-[11px] text-slate-600">{previewPath}</p>
        <ul className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/80 p-3 font-mono text-[11px] text-slate-700">
          {settings.jobSubfolders.map((folder) => (
            <li key={folder}>📁 {folder}</li>
          ))}
        </ul>
      </SectionCard>
    </SettingsShell>
  );
}
