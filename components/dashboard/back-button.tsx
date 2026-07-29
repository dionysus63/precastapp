import Link from "next/link";

type BackButtonProps = {
  href: string;
  label: string;
  className?: string;
  /** Client pages can intercept (e.g. unsaved-changes guard) via preventDefault. */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

/**
 * Standard back-navigation pill: sky accent with a circled arrow. Reads as
 * navigation rather than an action, so it never competes with a page's
 * primary buttons.
 */
export function BackButton({ href, label, className, onClick }: BackButtonProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 py-1 pl-1.5 pr-4 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100 ${className ?? ""}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white">
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="M5 12l6 6" />
          <path d="M5 12l6 -6" />
        </svg>
      </span>
      {label}
    </Link>
  );
}
