import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { JobProgressView } from "@/components/jobs/job-utils";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";

type JobProgressPanelProps = {
  jobId: string;
  progress: JobProgressView;
};

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-slate-500">
        {message}
      </td>
    </tr>
  );
}

export function JobProgressPanel({ jobId, progress }: JobProgressPanelProps) {
  const { lines, summary, quoteNumber, quoteId } = progress;

  return (
    <div className="space-y-4">
      {quoteNumber ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Awarded Quote
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {quoteId ? (
                <Link
                  href={`/quotes/${quoteId}`}
                  className="hover:text-slate-700"
                >
                  {quoteNumber}
                </Link>
              ) : (
                quoteNumber
              )}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Line Items
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {summary.totalLines}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Fully Shipped
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {summary.fullyShippedLines}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Remaining Work
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {summary.partiallyShippedLines + summary.notShippedLines}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.partiallyShippedLines} partial · {summary.notShippedLines}{" "}
              not started
            </p>
          </div>
        </div>
      ) : null}

      <SectionCard
        title="Awarded Line Items"
        description={
          quoteNumber
            ? `${lines.length} item${lines.length === 1 ? "" : "s"} on ${quoteNumber}`
            : "No won quote on this job yet"
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Item</th>
                <th className="px-3 py-2.5 font-semibold">Description</th>
                <th className="px-3 py-2.5 font-semibold">Awarded</th>
                <th className="px-3 py-2.5 font-semibold">Shipped</th>
                <th className="px-3 py-2.5 font-semibold">Scheduled</th>
                <th className="px-3 py-2.5 font-semibold">Remaining</th>
                <th className="px-3 py-2.5 font-semibold">Stock</th>
                <th className="px-3 py-2.5 font-semibold">Submittal</th>
                <th className="px-3 py-2.5 font-semibold">Submittals</th>
                <th className="px-3 py-2.5 font-semibold">Structure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 ? (
                <EmptyRow
                  colSpan={10}
                  message={
                    quoteNumber
                      ? "No line items on the won quote."
                      : "Mark a quote as Won to track awarded line item progress."
                  }
                />
              ) : (
                lines.map((line) => (
                  <tr key={line.quoteLineItemId} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
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
                    <td className="px-3 py-2.5 text-slate-700">
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
                    <td className="px-3 py-2.5 text-slate-600">{line.awardedQty}</td>
                    <td className="px-3 py-2.5 text-slate-600">{line.shippedQty}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {line.scheduledQty}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {line.remainingQty}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {line.stockLevel}
                    </td>
                    <td className="px-3 py-2.5">
                      {line.submittalStatus === "—" ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <StatusBadge
                          label={line.submittalStatus}
                          variant={line.submittalStatusVariant}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {line.submittalDocCount > 0 ? line.submittalDocCount : "—"}
                    </td>
                    <td className="px-3 py-2.5">
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
