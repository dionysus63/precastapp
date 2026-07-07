type CollapsibleSectionCardProps = {
  title: string;
  /** Extra badges/text rendered next to the title while collapsed. */
  summaryExtra?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** Anchor id so in-page links can scroll to this card. */
  id?: string;
};

/**
 * SectionCard variant that collapses to its header row. Server-rendered via
 * native <details>/<summary> — no client JS.
 */
export function CollapsibleSectionCard({
  title,
  summaryExtra,
  defaultOpen = false,
  children,
  id,
}: CollapsibleSectionCardProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm scroll-mt-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/60 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          {summaryExtra}
        </span>
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </summary>
      <div className="border-t border-slate-100 p-4">{children}</div>
    </details>
  );
}
