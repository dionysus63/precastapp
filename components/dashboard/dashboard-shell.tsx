import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { PermissionRouteGuard } from "./permission-route-guard";
import { getAppSettings } from "@/lib/app-settings";
import {
  companyLogoApiUrl,
  getCompanyLogoUpdatedAt,
} from "@/lib/company-logo";
import {
  canAccessPathWithPermissions,
  getDefaultHome,
} from "@/lib/auth/permissions";
import type { PermissionKey, UserRoleKey } from "@/lib/auth/constants";
import {
  getCurrentUser,
  getUserPermissions,
} from "@/lib/auth/session";

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
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(user);
  const headerList = await headers();
  // Only x-pathname is trusted: middleware overwrites it on every matched
  // request, so it cannot be spoofed. No referer/next-url fallbacks — those
  // are caller-controlled, and a missing header must fail closed rather
  // than fall back to "/" (which has no permission requirement).
  const pathname = headerList.get("x-pathname");
  if (!pathname || !canAccessPathWithPermissions(permissions as PermissionKey[], pathname)) {
    redirect(getDefaultHome(user));
  }

  const fullSettings = await getAppSettings();
  const settings = {
    appTitle: appTitle ?? fullSettings.appTitle,
    appSubtitle: appSubtitle ?? fullSettings.appSubtitle,
  };
  const logoUpdatedAt = await getCompanyLogoUpdatedAt(fullSettings.companyLogoPath);
  const logoUrl = logoUpdatedAt ? companyLogoApiUrl(logoUpdatedAt) : null;

  return (
    <div className="min-h-screen bg-slate-50/80 pl-60">
      <PermissionRouteGuard
        role={user.role as UserRoleKey}
        permissions={permissions as PermissionKey[]}
      />
      <Sidebar
        appTitle={settings.appTitle}
        logoUrl={logoUrl}
        permissions={permissions}
        userDisplayName={user.displayName}
        userInitials={user.initials}
        userRole={user.role}
      />
      <div className="flex min-h-screen min-w-0 flex-col">
        <Header
          title={title}
          subtitle={subtitle}
          user={user}
          permissions={permissions}
        />
        <main className="flex-1 px-5 py-5">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
