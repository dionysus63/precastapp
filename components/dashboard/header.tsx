import Link from "next/link";
import type { AppPermission } from "@/app/generated/prisma/client";
import type { AuthUser } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/constants";
import { signOut } from "@/app/login/actions";

type HeaderProps = {
  title: string;
  subtitle?: string;
  user: AuthUser;
  permissions: AppPermission[];
};

export function Header({ title, subtitle, user }: HeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
            {today}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {user.initials}
            </div>
            <div className="min-w-0">
              <Link
                href="/profile"
                className="block truncate text-xs font-semibold text-slate-900 hover:text-slate-700"
              >
                {user.displayName}
              </Link>
              <p className="text-[11px] text-slate-500">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
