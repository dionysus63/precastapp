import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppPermission } from "@/app/generated/prisma/client";
import { BackupWarning } from "./backup-warning";
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
  getAccessibleHome,
} from "@/lib/auth/permissions";
import { SessionKeepAlive } from "./session-keep-alive";
import { pageWidthClassName, type PageWidth } from "@/lib/page-width";
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
  /** How wide the page content may grow (see lib/page-width.ts). */
  width?: PageWidth;
  children: React.ReactNode;
};

export async function DashboardShell({
  title,
  subtitle,
  appTitle,
  appSubtitle,
  width = "standard",
  children,
}: DashboardShellProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(user);
  const headerList = await headers();
  // Only x-pathname is trusted: proxy.ts overwrites it on every matched
  // request, so it cannot be spoofed. No referer/next-url fallbacks — those
  // are caller-controlled, and a missing header must fail closed rather
  // than fall back to "/" (which has no permission requirement).
  const pathname = headerList.get("x-pathname");
  // A temporary password must be replaced before anything else: everything
  // but the profile page (where it's changed) sends the user there.
  if (user.mustChangePassword && pathname !== "/profile") {
    redirect("/profile");
  }
  if (!pathname || !canAccessPathWithPermissions(permissions as PermissionKey[], pathname)) {
    redirect(getAccessibleHome(user, permissions));
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
      <SessionKeepAlive />
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
        {/* Only an admin can do something about the server's backup. */}
        {permissions.includes(AppPermission.USERS_MANAGE) ? <BackupWarning /> : null}
        <main className="flex-1 px-5 py-5">
          <div data-page-width={width} className={pageWidthClassName(width)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
