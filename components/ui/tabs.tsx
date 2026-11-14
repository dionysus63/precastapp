import Link from "next/link";

/**
 * The app's one tab look: folder tabs. The selected tab has a box around it
 * (top and sides) and opens onto the line the row sits on, so it is plain
 * which screen is showing. Every row of tabs in the app uses these; filters
 * and either/or switches (pills) are a different thing and keep their own
 * look.
 *
 * No "use client" here on purpose: server pages use <TabLink>, client
 * screens use <Tab> with their own onClick.
 */

/**
 * The line the tabs sit on is the gridline colour of the tables below; the
 * selected tab's box is one step darker so it stands out from the line.
 * (Whole class names, so Tailwind finds them.)
 */
const lineClassName = "border-slate-300";
const tabLineClassName = "border-b-slate-300";
const selectedBoxClassName = "border-slate-400";

const tabBaseClassName =
  "inline-flex items-baseline gap-1.5 whitespace-nowrap rounded-t-md border-b border-t py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500";

/**
 * Classes for one tab. Each tab carries its own piece of the line (its
 * bottom border), so a row that wraps keeps a line under every row; the
 * selected tab's piece is white, which is what joins its box to the screen
 * below. Tabs that are not selected have no side borders (their padding is
 * 1px wider instead), so the line under them runs unbroken from tab to tab.
 */
export function tabClassName(active: boolean) {
  return `${tabBaseClassName} ${
    active
      ? `border-x ${selectedBoxClassName} border-b-white bg-white px-3.5 font-semibold text-slate-900`
      : `border-t-transparent ${tabLineClassName} px-[calc(0.875rem+1px)] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900`
  }`;
}

function TabCount({ active, count }: { active: boolean; count: number | string }) {
  return (
    <span
      className={`font-normal tabular-nums ${active ? "text-slate-500" : "text-slate-400"}`}
    >
      {typeof count === "number" ? count.toLocaleString() : count}
    </span>
  );
}

type TabBarProps = {
  /** What the tabs switch between, for screen readers ("Job sections"). */
  label?: string;
  /** Shown after the last tab, on the line (a filter chip, a hint, buttons). */
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** A row of tabs sitting on a line that runs the full width. */
export function TabBar({ label, trailing, className = "", children }: TabBarProps) {
  return (
    <div
      role="navigation"
      aria-label={label}
      data-tab-bar
      className={`flex flex-wrap items-end ${className}`}
    >
      {children}
      {/* The rest of the line, to the right of the last tab. */}
      <div
        className={`flex min-w-0 flex-1 flex-wrap items-center gap-2 self-stretch border-b ${lineClassName} ${
          trailing ? "pb-1 pl-3" : ""
        }`}
      >
        {trailing}
      </div>
    </div>
  );
}

type TabCommonProps = {
  active: boolean;
  /** Small grey number after the label. */
  count?: number | string;
  children: React.ReactNode;
};

type TabProps = TabCommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/** A tab that switches the screen in place (client screens). */
export function Tab({ active, count, children, type = "button", ...props }: TabProps) {
  return (
    <button
      type={type}
      aria-current={active ? "page" : undefined}
      className={tabClassName(active)}
      {...props}
    >
      {children}
      {count !== undefined ? <TabCount active={active} count={count} /> : null}
    </button>
  );
}

type TabLinkProps = TabCommonProps & { href: string };

/** A tab that is a link to another address. */
export function TabLink({ href, active, count, children }: TabLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={tabClassName(active)}
    >
      {children}
      {count !== undefined ? <TabCount active={active} count={count} /> : null}
    </Link>
  );
}
