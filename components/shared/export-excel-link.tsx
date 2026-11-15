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
      className="inline-flex items-center justify-center rounded-lg btn-plain px-4 py-2 text-xs font-semibold transition-colors"
    >
      {label}
    </a>
  );
}
