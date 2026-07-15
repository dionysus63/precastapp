import { BackButton } from "@/components/dashboard/back-button";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAppSettings } from "@/lib/app-settings";

type SettingsShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBackLink?: boolean;
  backHref?: string;
  backLabel?: string;
};

export async function SettingsShell({
  title,
  subtitle,
  children,
  showBackLink = true,
  backHref = "/settings",
  backLabel = "Back to Settings",
}: SettingsShellProps) {
  const settings = await getAppSettings();

  return (
    <DashboardShell
      title={title}
      subtitle={subtitle}
      appTitle={settings.appTitle}
      appSubtitle={settings.appSubtitle}
    >
      {showBackLink ? <BackButton href={backHref} label={backLabel} /> : null}
      <div className={showBackLink ? "mt-4 space-y-4" : "space-y-4"}>
        {children}
      </div>
    </DashboardShell>
  );
}
