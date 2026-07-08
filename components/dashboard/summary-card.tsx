import Link from "next/link";

type SummaryCardProps = {
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export function SummaryCard({ label, value, detail, href }: SummaryCardProps) {
  const card = (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-colors ${
        href ? "hover:border-slate-300 hover:shadow-md" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        {card}
      </Link>
    );
  }

  return card;
}
