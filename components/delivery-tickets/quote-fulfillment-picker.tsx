"use client";

import { useEffect, useState, useTransition } from "react";
import { getQuoteFulfillmentForTicket } from "@/app/operations/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";

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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-semibold">Item</th>
                <th className="px-4 py-2 font-semibold">Type</th>
                <th className="px-4 py-2 font-semibold">Quoted</th>
                <th className="px-4 py-2 font-semibold">Shipped</th>
                <th className="px-4 py-2 font-semibold">Remaining</th>
                <th className="px-4 py-2 font-semibold">Eligible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => (
                <tr
                  key={line.quoteLineItemId}
                  className={line.eligible ? "text-slate-800" : "text-slate-400"}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{line.itemCode}</div>
                    <div className="text-slate-500">{line.description}</div>
                  </td>
                  <td className="px-4 py-2">{line.lineType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">{line.quotedQty}</td>
                  <td className="px-4 py-2">{line.shippedQty}</td>
                  <td className="px-4 py-2">{line.remainingQty}</td>
                  <td className="px-4 py-2">
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
  const selectedJob = jobs.find((job) => job.id === jobId);
  const quote = selectedJob?.quotes[0];

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
              onChange={(event) => setJobId(event.target.value)}
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
            <label className="text-xs font-medium text-slate-700">Won quote</label>
            <p className="mt-2 text-xs text-slate-600">
              {quote ? quote.quoteNumber : "Select a job with a WON quote"}
            </p>
          </div>
        </div>
      </SectionCard>

      {quote ? (
        <QuoteFulfillmentPicker quoteId={quote.id} quoteLabel={quote.quoteNumber} />
      ) : null}
    </div>
  );
}
