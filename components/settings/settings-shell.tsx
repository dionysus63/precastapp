import Link from "next/link";
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
  backLabel = "← Back to Settings",
}: SettingsShellProps) {
  const settings = await getAppSettings();

  return (
    <DashboardShell
      title={title}
      subtitle={subtitle}
      appTitle={settings.appTitle}
      appSubtitle={settings.appSubtitle}
    >
      {showBackLink ? (
        <Link
          href={backHref}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          {backLabel}
        </Link>
      ) : null}
      <div className={showBackLink ? "mt-4 space-y-4" : "space-y-4"}>
        {children}
      </div>
    </DashboardShell>
  );
}
