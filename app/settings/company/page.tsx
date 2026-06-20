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
import {
  removeCompanyLogoFormAction,
  updateCompanySettingsFormAction,
  uploadCompanyLogoFormAction,
} from "@/app/settings/actions";
import {
  companyLogoApiUrl,
  getCompanyLogoUpdatedAt,
  hasCompanyLogo,
} from "@/lib/company-logo";
import { getAppSettings } from "@/lib/app-settings";

type CompanySettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function saveCompanySettings(formData: FormData) {
  "use server";
  const result = await updateCompanySettingsFormAction(formData);
  if (result.error) {
    redirect(`/settings/company?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/company?success=1");
}

async function uploadCompanyLogo(formData: FormData) {
  "use server";
  const result = await uploadCompanyLogoFormAction(formData);
  if (result.error) {
    redirect(`/settings/company?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/company?success=logo");
}

async function removeCompanyLogo() {
  "use server";
  const result = await removeCompanyLogoFormAction();
  if (result.error) {
    redirect(`/settings/company?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/company?success=logo-removed");
}

export default async function CompanySettingsPage({
  searchParams,
}: CompanySettingsPageProps) {
  const params = await searchParams;
  const settings = await getAppSettings();
  const logoAvailable = await hasCompanyLogo();
  const logoUpdatedAt = await getCompanyLogoUpdatedAt();
  const logoUrl = logoAvailable ? companyLogoApiUrl(logoUpdatedAt) : null;

  const successMessage =
    params.success === "logo"
      ? "Logo uploaded."
      : params.success === "logo-removed"
        ? "Logo removed."
        : params.success
          ? "Settings saved."
          : null;

  return (
    <SettingsShell
      title="Company & Branding"
      subtitle="Used on PDF letterhead and in the app sidebar."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={successMessage}
      />

      <SectionCard title="Company logo">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`${settings.companyName} logo`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-center text-xs text-slate-500">No logo</span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <form action={uploadCompanyLogo} className="space-y-3">
              <SettingsField
                label="Upload logo"
                hint="PNG, JPG, SVG, or PDF. PDFs are converted to PNG for display and documents."
              >
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.png,.jpg,.jpeg,.webp,.svg,.pdf"
                  className={settingsInputClassName}
                />
              </SettingsField>
              <button type="submit" className={settingsSubmitClassName}>
                Upload logo
              </button>
            </form>
            {logoAvailable ? (
              <form action={removeCompanyLogo}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Remove logo
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Company & app branding">
        <form action={saveCompanySettings} className="grid max-w-xl gap-4">
          <SettingsField label="Company name">
            <input
              name="companyName"
              defaultValue={settings.companyName}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField label="Address">
            <input
              name="companyAddress"
              defaultValue={settings.companyAddress}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField label="Phone">
            <input
              name="companyPhone"
              defaultValue={settings.companyPhone}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField label="Email">
            <input
              name="companyEmail"
              type="email"
              defaultValue={settings.companyEmail}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField label="App title" hint="Shown in the sidebar header.">
            <input
              name="appTitle"
              defaultValue={settings.appTitle}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField label="App subtitle">
            <input
              name="appSubtitle"
              defaultValue={settings.appSubtitle}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField
            label="Quote PDF footer"
            hint="One paragraph per line. Signature blocks are always included."
          >
            <textarea
              name="quoteFooterText"
              rows={4}
              defaultValue={settings.quoteFooterText ?? ""}
              className={settingsTextareaClassName}
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
