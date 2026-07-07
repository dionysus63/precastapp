import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { JobProgressView } from "@/components/jobs/job-utils";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellWrapClassName,
  tableRowClassName,
} from "@/lib/table-styles";
type JobProgressPanelProps = {
  jobId: string;
  progress: JobProgressView;
};

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}>
        {message}
      </td>
    </tr>
  );
}

export function JobProgressPanel({ jobId, progress }: JobProgressPanelProps) {
  const { lines, summary, quoteNumber, quoteId } = progress;
  const remaining = summary.partiallyShippedLines + summary.notShippedLines;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Awarded Line Items"
        description={
          quoteNumber
            ? `${lines.length} item${lines.length === 1 ? "" : "s"} on ${quoteNumber}`
            : "No won quote on this job yet"
        }
        action={
          quoteNumber ? (
            <p className="text-right text-[11px] text-slate-600">
              Quote{" "}
              {quoteId ? (
                <Link
                  href={`/quotes/${quoteId}`}
                  className="font-mono font-semibold text-slate-900 hover:underline"
                >
                  {quoteNumber}
                </Link>
              ) : (
                <span className="font-mono font-semibold text-slate-900">
                  {quoteNumber}
                </span>
              )}
              {" · "}
              <span className="font-semibold text-slate-900">
                {summary.fullyShippedLines}
              </span>{" "}
              fully shipped ·{" "}
              <span className="font-semibold text-slate-900">{remaining}</span>{" "}
              remaining{" "}
              <span className="text-slate-400">
                ({summary.partiallyShippedLines} partial ·{" "}
                {summary.notShippedLines} not started)
              </span>
            </p>
          ) : undefined
        }
        noPadding
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellWrapClassName}>Item</th>
                <th className={tableHeaderCellWrapClassName}>Description</th>
                <th className={tableHeaderCellWrapClassName}>Awarded</th>
                <th className={tableHeaderCellWrapClassName}>Shipped</th>
                <th className={tableHeaderCellWrapClassName}>Scheduled</th>
                <th className={tableHeaderCellWrapClassName}>Remaining</th>
                <th className={tableHeaderCellWrapClassName}>Stock</th>
                <th className={tableHeaderCellWrapClassName}>Submittal</th>
                <th className={tableHeaderCellWrapClassName}>Structure</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {lines.length === 0 ? (
                <EmptyRow
                  colSpan={9}
                  message={
                    quoteNumber
                      ? "No line items on the won quote."
                      : "Mark a quote as Won to track awarded line item progress."
                  }
                />
              ) : (
                lines.map((line) => (
                  <tr key={line.quoteLineItemId} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      {line.jobStructureId ? (
                        <StructureManageLink
                          jobId={jobId}
                          structureId={line.jobStructureId}
                        >
                          {line.itemCode}
                        </StructureManageLink>
                      ) : (
                        line.itemCode
                      )}
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      <span className="block font-medium text-slate-900">
                        {line.displayName}
                      </span>
                      {line.description !== "—" &&
                      line.description !== line.displayName ? (
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {line.description}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{line.awardedQty}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{line.shippedQty}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {line.scheduledQty}
                    </td>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      {line.remainingQty}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {line.stockLevel}
                    </td>
                    <td className={tableCellClassName}>
                      {line.submittalStatus === "—" ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <StatusBadge
                            label={line.submittalStatus}
                            variant={line.submittalStatusVariant}
                          />
                          {line.submittalDocCount > 0 ? (
                            <span className="text-[10px] text-slate-400">
                              {line.submittalDocCount} doc
                              {line.submittalDocCount === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className={tableCellClassName}>
                      {line.structureStatus === "—" ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <StatusBadge
                          label={line.structureStatus}
                          variant={line.structureStatusVariant}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
