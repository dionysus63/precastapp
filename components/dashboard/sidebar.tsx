"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PermissionKey, UserRoleKey } from "@/lib/auth/constants";
import { ROLE_LABELS } from "@/lib/auth/constants";
import { NavIcon } from "./nav-icon";
import { navItems, navSections } from "./nav-items";

export function Sidebar({
  appTitle = "Precast Ops",
  logoUrl = null,
  permissions,
  userDisplayName,
  userInitials,
  userRole,
}: {
  appTitle?: string;
  logoUrl?: string | null;
  permissions: PermissionKey[];
  userDisplayName: string;
  userInitials: string;
  userRole: UserRoleKey;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (!item.requiredPermission) {
      return true;
    }

    return permissions.includes(item.requiredPermission);
  });

  const visibleSections = navSections.filter((section) =>
    visibleItems.some((item) => item.section === section.id),
  );

  // Longest matching href wins so nested routes (e.g. /delivery-tickets/all)
  // highlight their own entry instead of every prefix entry.
  const activeHref = visibleItems.reduce((best, item) => {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    return matches && item.href.length > best.length ? item.href : best;
  }, "");

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex h-screen w-60 flex-col overflow-y-auto border-r border-slate-200/80 bg-gradient-to-b from-white to-slate-50">
      <div className="border-b border-slate-100 px-4 py-4">
        <Link
          href="/"
          aria-label="Dashboard"
          className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${appTitle} logo`}
              className="h-14 w-full max-w-[200px] object-contain object-left"
            />
          ) : (
            <div className="flex h-14 max-w-[200px] items-center justify-center rounded bg-slate-900 px-4 text-sm font-bold tracking-wide text-white">
              PC
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4" aria-label="Main navigation">
        {visibleSections.map((section, sectionIndex) => {
          const sectionItems = visibleItems.filter(
            (item) => item.section === section.id,
          );

          return (
            <div key={section.id} className={sectionIndex > 0 ? "mt-5" : undefined}>
              <div
                className="mb-1.5 select-none px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
                aria-hidden="true"
              >
                {section.label}
              </div>
              <div className="space-y-0.5">
                {sectionItems.map((item) => {
                  const isActive = item.href === activeHref;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                        isActive
                          ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                          : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                      }`}
                    >
                      <NavIcon
                        name={item.icon}
                        className="h-4 w-4 shrink-0 opacity-75"
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-slate-200/80 px-4 py-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600"
          aria-hidden="true"
        >
          {userInitials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-slate-700">
            {userDisplayName}
          </p>
          <p className="text-[11px] text-slate-400">{ROLE_LABELS[userRole]}</p>
        </div>
      </div>
    </aside>
  );
}
