import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { NavIcon } from "./nav-icon";

type HeaderProps = {
  title: string;
  /** Which record this is, or a rule worth knowing. Not a description. */
  subtitle?: string;
};

export function Header({ title, subtitle }: HeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    // One line, one fixed height (--app-header-height in globals.css): the
    // bars that stick under this one are placed by that number.
    <header className="sticky top-0 z-10 h-[var(--app-header-height)] border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-4 px-5">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="shrink-0 text-lg font-semibold text-slate-900">{title}</h2>
          {/* Which record this is, or a rule worth knowing; never a
              description of the screen. One line: the bar keeps its height. */}
          {subtitle ? (
            <p title={subtitle} className="min-w-0 truncate text-xs text-slate-500">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
            {today}
          </div>
          <Link
            href="/"
            aria-label="Home"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <NavIcon name="home" className="h-4 w-4" />
          </Link>
          {/* Who is signed in shows once, at the foot of the sidebar. */}
          <form action={signOut}>
            <button
              type="submit"
              className="flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
