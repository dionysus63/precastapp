"use client";

import { useEffect, useState, useTransition } from "react";
import { getQuoteFulfillmentForTicket } from "@/app/operations/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
type QuoteFulfillmentPickerProps = {
  quoteId: string;
  quoteLabel: string;
};

export function QuoteFulfillmentPicker({
  quoteId,
  quoteLabel,
}: QuoteFulfillmentPickerProps) {
  const [lines, setLines] = useState<QuoteLineFulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setLoading(true);
      const data = await getQuoteFulfillmentForTicket(quoteId);
      setLines(data);
      setLoading(false);
    });
  }, [quoteId]);

  return (
    <SectionCard
      title="Quote fulfillment"
      description={`Pick items to ship from ${quoteLabel}. Shows quoted, shipped, and remaining quantities.`}
      noPadding
    >
      {loading ? (
        <p className="px-4 py-6 text-sm text-slate-500">Loading quote lines…</p>
      ) : lines.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No quote lines found.</p>
      ) : (
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Item</th>
                <th className={tableHeaderCellClassName}>Type</th>
                <th className={tableHeaderCellClassName}>Quoted</th>
                <th className={tableHeaderCellClassName}>Shipped</th>
                <th className={tableHeaderCellClassName}>Remaining</th>
                <th className={tableHeaderCellClassName}>Eligible</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {lines.map((line) => (
                <tr
                  key={line.quoteLineItemId}
                  className={line.eligible ? "text-slate-800" : "text-slate-400"}
                >
                  <td className={tableCellClassName}>
                    <div className="font-medium">{line.itemCode}</div>
                    <div className="text-slate-500">{line.description}</div>
                  </td>
                  <td className={tableCellClassName}>{line.lineType.replace(/_/g, " ")}</td>
                  <td className={tableCellClassName}>{line.quotedQty}</td>
                  <td className={tableCellClassName}>{line.shippedQty}</td>
                  <td className={tableCellClassName}>{line.remainingQty}</td>
                  <td className={tableCellClassName}>
                    {line.eligible
                      ? "Yes"
                      : (line.eligibilityReason ?? "No")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

type JobQuoteSelectorProps = {
  jobs: {
    id: string;
    jobNumber: string;
    projectName: string;
    customerName: string;
    quotes: { id: string; quoteNumber: string }[];
  }[];
};

export function JobQuoteSelector({ jobs }: JobQuoteSelectorProps) {
  const [jobId, setJobId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const selectedJob = jobs.find((job) => job.id === jobId);
  const quote =
    selectedJob?.quotes.find((entry) => entry.id === quoteId) ??
    selectedJob?.quotes[0];

  function handleJobChange(nextJobId: string) {
    setJobId(nextJobId);
    const nextJob = jobs.find((job) => job.id === nextJobId);
    setQuoteId(nextJob?.quotes[0]?.id ?? "");
  }

  function handleQuoteChange(nextQuoteId: string) {
    setQuoteId(nextQuoteId);
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Job and quote">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="jobId" className="text-xs font-medium text-slate-700">
              Job
            </label>
            <select
              id="jobId"
              value={jobId}
              onChange={(event) => handleJobChange(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            >
              <option value="">Select job…</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.jobNumber} — {job.projectName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quoteId" className="text-xs font-medium text-slate-700">
              Won quote
            </label>
            {selectedJob && selectedJob.quotes.length > 0 ? (
              <select
                id="quoteId"
                value={quoteId || selectedJob.quotes[0].id}
                onChange={(event) => handleQuoteChange(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {selectedJob.quotes.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.quoteNumber}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                {selectedJob ? "No won quote on this job" : "Select a job with a WON quote"}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      {quote ? (
        <QuoteFulfillmentPicker quoteId={quote.id} quoteLabel={quote.quoteNumber} />
      ) : null}
    </div>
  );
}
