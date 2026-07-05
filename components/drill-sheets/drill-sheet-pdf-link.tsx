/**
 * One-click drill sheet PDF viewer: opens the streamed PDF from the preview
 * API route in a new tab. Works from server and client components.
 */
export function DrillSheetPdfLink({
  drillSheetId,
  label = "View PDF",
  className,
}: {
  drillSheetId: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`/api/drill-sheets/${drillSheetId}/preview`}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-100"
      }
    >
      {label}
    </a>
  );
}
