import Link from "next/link";

export type JobSheetNavEntry = {
  id: string;
  structureNumber: string;
};

const buttonClassName =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50";
const disabledClassName =
  "rounded-lg border border-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-300";

/**
 * Previous/next links between a job's drill sheets, ordered by structure
 * number. Renders nothing when the sheet has no job siblings.
 */
export function DrillSheetJobNav({
  entries,
  currentId,
}: {
  entries: JobSheetNavEntry[];
  currentId: string;
}) {
  const index = entries.findIndex((entry) => entry.id === currentId);
  if (index < 0 || entries.length < 2) {
    return null;
  }
  const prev = index > 0 ? entries[index - 1] : null;
  const next = index < entries.length - 1 ? entries[index + 1] : null;

  return (
    <div className="flex items-center gap-1.5">
      {prev ? (
        <Link
          href={`/drill-sheets/${prev.id}`}
          className={buttonClassName}
          title={`Previous structure on this job: ${prev.structureNumber}`}
        >
          ← {prev.structureNumber}
        </Link>
      ) : (
        <span className={disabledClassName}>←</span>
      )}
      <span className="px-0.5 text-[11px] tabular-nums text-slate-400">
        {index + 1} / {entries.length}
      </span>
      {next ? (
        <Link
          href={`/drill-sheets/${next.id}`}
          className={buttonClassName}
          title={`Next structure on this job: ${next.structureNumber}`}
        >
          {next.structureNumber} →
        </Link>
      ) : (
        <span className={disabledClassName}>→</span>
      )}
    </div>
  );
}
