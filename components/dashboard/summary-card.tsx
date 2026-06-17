type SummaryCardProps = {
  label: string;
  value: string;
  detail: string;
  accent: "sky" | "emerald" | "amber" | "rose";
};

const accentStyles = {
  sky: "border-sky-200 bg-sky-50/40 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50/40 text-emerald-700",
  amber: "border-amber-200 bg-amber-50/40 text-amber-700",
  rose: "border-rose-200 bg-rose-50/40 text-rose-700",
};

export function SummaryCard({ label, value, detail, accent }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span
          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${accentStyles[accent]}`}
        >
          Live
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
