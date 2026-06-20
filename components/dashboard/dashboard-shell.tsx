import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { getAppSettings } from "@/lib/app-settings";
import {
  companyLogoApiUrl,
  getCompanyLogoUpdatedAt,
} from "@/lib/company-logo";

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  appTitle?: string;
  appSubtitle?: string;
  children: React.ReactNode;
};

export async function DashboardShell({
  title,
  subtitle,
  appTitle,
  appSubtitle,
  children,
}: DashboardShellProps) {
  const fullSettings = await getAppSettings();
  const settings = {
    appTitle: appTitle ?? fullSettings.appTitle,
    appSubtitle: appSubtitle ?? fullSettings.appSubtitle,
  };
  const logoUpdatedAt = await getCompanyLogoUpdatedAt();
  const logoUrl = logoUpdatedAt ? companyLogoApiUrl(logoUpdatedAt) : null;

  return (
    <div className="flex min-h-screen bg-slate-50/80">
      <Sidebar
        appTitle={settings.appTitle}
        appSubtitle={settings.appSubtitle}
        logoUrl={logoUrl}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 px-5 py-5">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
