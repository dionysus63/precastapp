"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

export function Sidebar({
  appTitle = "Precast Ops",
  appSubtitle = "Quoting & Inventory",
  logoUrl = null,
}: {
  appTitle?: string;
  appSubtitle?: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${appTitle} logo`}
              className="h-8 w-8 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              PC
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">{appTitle}</p>
            <p className="text-[11px] text-slate-500">{appSubtitle}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map((item) => {
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
        <p className="text-[11px] font-medium text-slate-500">Local POC</p>
        <p className="text-[11px] text-slate-400">Static dashboard preview</p>
      </div>
    </aside>
  );
}
