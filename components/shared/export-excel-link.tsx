type ExportExcelLinkProps = {
  href: string;
  label?: string;
};

export function ExportExcelLink({
  href,
  label = "Download Excel",
}: ExportExcelLinkProps) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
    >
      {label}
    </a>
  );
}
