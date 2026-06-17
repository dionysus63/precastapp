type HeaderProps = {
  title: string;
  subtitle?: string;
};

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Operations
          </p>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
            Wed, Jun 17, 2026
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            NP
          </div>
        </div>
      </div>
    </header>
  );
}
