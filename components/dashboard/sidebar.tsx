"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PermissionKey, UserRoleKey } from "@/lib/auth/constants";
import { ROLE_LABELS } from "@/lib/auth/constants";
import { navItems } from "./nav-items";

export function Sidebar({
  appTitle = "Precast Ops",
  logoUrl = null,
  permissions,
  userDisplayName,
  userRole,
}: {
  appTitle?: string;
  logoUrl?: string | null;
  permissions: PermissionKey[];
  userDisplayName: string;
  userRole: UserRoleKey;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (!item.requiredPermission) {
      return true;
    }

    return permissions.includes(item.requiredPermission);
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex h-screen w-60 flex-col overflow-y-auto border-r border-slate-200/80 bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
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
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 px-4 py-3">
        <p className="text-[11px] font-medium text-slate-700">
          {userDisplayName}
        </p>
        <p className="text-[11px] text-slate-400">{ROLE_LABELS[userRole]}</p>
      </div>
    </aside>
  );
}
