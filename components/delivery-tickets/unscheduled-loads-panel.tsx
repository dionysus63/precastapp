import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { formatWeightLb } from "@/lib/format";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

export type UnscheduledDraftTicket = {
  jobId: string;
  jobNumber: string;
  projectName: string;
  customerName: string;
  totalWeight: number | null;
};

type UnscheduledLoadsPanelProps = {
  drafts: UnscheduledDraftTicket[];
};

type JobGroup = {
  jobId: string;
  jobNumber: string;
  projectName: string;
  customerName: string;
  loadCount: number;
  totalWeight: number;
  weightComplete: boolean;
};

// Server component: draft JOB delivery tickets grouped per job, so dispatch
// can see which jobs still need dates and jump straight to scheduling.
export function UnscheduledLoadsPanel({ drafts }: UnscheduledLoadsPanelProps) {
  const groups = new Map<string, JobGroup>();
  for (const draft of drafts) {
    const group = groups.get(draft.jobId) ?? {
      jobId: draft.jobId,
      jobNumber: draft.jobNumber,
      projectName: draft.projectName,
      customerName: draft.customerName,
      loadCount: 0,
      totalWeight: 0,
      weightComplete: true,
    };
    group.loadCount += 1;
    if (draft.totalWeight != null) {
      group.totalWeight += draft.totalWeight;
    } else {
      group.weightComplete = false;
    }
    groups.set(draft.jobId, group);
  }
  const jobGroups = [...groups.values()].sort((a, b) =>
    b.jobNumber.localeCompare(a.jobNumber),
  );

  return (
    // w-fit: hug the table's natural width instead of stretching page-wide.
    <div className="xl:w-fit xl:max-w-full">
      <SectionCard
        title="Awaiting Scheduling"
        description={`${jobGroups.length} job${jobGroups.length === 1 ? "" : "s"} with created loads that still need delivery dates.`}
        noPadding
      >
      {jobGroups.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No unscheduled loads — every created load has been scheduled.
        </p>
      ) : (
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Job</th>
                <th className={tableHeaderCellClassName}>Project</th>
                <th className={tableHeaderCellClassName}>Customer</th>
                <th className={tableHeaderCellClassName}>Loads</th>
                <th className={tableHeaderCellClassName}>Total Weight</th>
                <th className={tableHeaderCellClassName}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {jobGroups.map((group) => (
                <tr key={group.jobId} className={tableRowClassName}>
                  <td className={`${tableCellClassName} font-mono text-[11px] font-medium text-slate-900`}>
                    {group.jobNumber}
                  </td>
                  <td className={`${tableCellClassName} font-medium text-slate-900`}>
                    {group.projectName}
                  </td>
                  <td className={`${tableCellClassName} text-slate-600`}>
                    {group.customerName}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap text-slate-600`}>
                    {group.loadCount} load{group.loadCount === 1 ? "" : "s"}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap font-medium text-slate-900`}>
                    {group.totalWeight > 0 ? formatWeightLb(group.totalWeight) : "—"}
                    {!group.weightComplete && group.totalWeight > 0 ? (
                      <span
                        className="ml-0.5 text-amber-500"
                        title="Some loads have no weight on file."
                      >
                        *
                      </span>
                    ) : null}
                  </td>
                  <td className={tableCellClassName}>
                    <Link
                      href={`/delivery-tickets/schedule?jobId=${group.jobId}`}
                      className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Schedule →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </SectionCard>
    </div>
  );
}
