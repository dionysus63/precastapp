import type { ReactNode } from "react";

/**
 * The labelled boxes at the top of the job page: a small two-column grid,
 * the label ("Contractor:") in a shaded cell and its value beside it, like
 * the front of a paper job jacket. No "use client": server and client
 * screens both use it.
 */
export function JobFieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-300">
      <table className="w-full border-separate border-spacing-0 text-left">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const jobFieldLabelClassName =
  "w-px whitespace-nowrap border-b border-r border-slate-300 bg-slate-100 px-2.5 py-1.5 align-top text-xs font-medium text-slate-600 group-last:border-b-0";

export const jobFieldValueClassName =
  "border-b border-slate-300 px-2.5 py-1.5 align-top text-sm font-semibold text-slate-900 group-last:border-b-0";

/** Shown in place of a value that has not been filled in. */
export function JobFieldEmpty() {
  return <span className="font-normal text-slate-500">—</span>;
}

export function JobFieldRow({
  label,
  children,
}: {
  /** With its colon, e.g. "Contractor:". */
  label: string;
  children: ReactNode;
}) {
  return (
    <tr className="group">
      <th scope="row" className={jobFieldLabelClassName}>
        {label}
      </th>
      <td className={jobFieldValueClassName}>{children}</td>
    </tr>
  );
}

/** A plain text value, or a dash when it is blank. */
export function JobFieldText({ value }: { value: string | null | undefined }) {
  const text = value?.trim();
  return text && text !== "—" ? (
    <span className="whitespace-pre-line break-words">{text}</span>
  ) : (
    <JobFieldEmpty />
  );
}
