type HeaderProps = {
  title: string;
  subtitle?: string;
};

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
          ) : null}
        </div>
        <div className="text-right text-sm text-zinc-500">
          <p>Wednesday, Jun 17, 2026</p>
          <p className="mt-0.5">Precast Operations</p>
        </div>
      </div>
    </header>
  );
}
