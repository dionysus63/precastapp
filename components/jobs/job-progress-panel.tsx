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
  const { lines, summary, quoteNumber, quoteId, structureLines } = progress;
  const remaining = summary.partiallyShippedLines + summary.notShippedLines;

  // Detailing flow: no won quote, but structures live on the job — show
  // production progress per structure instead of asking for a won quote.
  if (!quoteNumber && structureLines.length > 0) {
    const madeCount = structureLines.filter(
      (line) => line.statusLabel === "Made" || line.statusLabel === "Shipped",
    ).length;
    return (
      <div className="space-y-4">
        <SectionCard
          title="Structure Production Progress"
          description={`${structureLines.length} structure${
            structureLines.length === 1 ? "" : "s"
          } · no won quote — tracking production directly`}
          action={
            <p className="text-right text-[11px] text-slate-600">
              <span className="font-semibold text-slate-900">{madeCount}</span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900">
                {structureLines.length}
              </span>{" "}
              made · record daily counts in{" "}
              <Link
                href="/production/daily"
                className="font-medium text-sky-700 hover:underline"
              >
                Daily Production
              </Link>
            </p>
          }
          noPadding
        >
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellWrapClassName}>Structure</th>
                  <th className={tableHeaderCellWrapClassName}>Description</th>
                  <th className={tableHeaderCellWrapClassName}>Qty</th>
                  <th className={tableHeaderCellWrapClassName}>Made</th>
                  <th className={tableHeaderCellWrapClassName}>Remaining</th>
                  <th className={tableHeaderCellWrapClassName}>Status</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {structureLines.map((line) => (
                  <tr key={line.id} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      <StructureManageLink jobId={jobId} structureId={line.id}>
                        {line.structureNumber}
                      </StructureManageLink>
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {line.description}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {line.quantity}
                    </td>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      {line.madeSoFar}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {line.remainingToMake}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge
                        label={line.statusLabel}
                        variant={line.statusVariant}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    );
  }

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
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <StatusBadge
                            label={line.structureStatus}
                            variant={line.structureStatusVariant}
                          />
                          {line.createDrillSheetHref ? (
                            <Link
                              href={line.createDrillSheetHref}
                              className="text-[11px] font-medium text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900"
                            >
                              Create drill sheet
                            </Link>
                          ) : null}
                        </span>
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
