import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import type { QuoteDetailView } from "@/components/quotes/quote-utils";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

type QuoteDetailContentProps = {
  quote: QuoteDetailView;
};

export function QuoteDetailContent({ quote }: QuoteDetailContentProps) {
  const topSummaryCards = [
    {
      label: "Quote Status",
      value: quote.statusLabel,
      detail: quote.status,
      accent: "amber" as const,
    },
    {
      label: "Quote Total",
      value: quote.total,
      detail: "Current revision total",
      accent: "sky" as const,
    },
    {
      label: "Bid Due Date",
      value: quote.bidDueDate,
      detail: "Customer bid deadline",
      accent: "rose" as const,
    },
    {
      label: "Revision",
      value: quote.revision,
      detail: `Original ${quote.originalQuote}`,
      accent: "emerald" as const,
    },
    {
      label: "Estimator",
      value: quote.estimator,
      detail: "Assigned estimator",
      accent: "sky" as const,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/quotes"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Quotes
        </Link>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
          >
            Revise Quote
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
          >
            Preview PDF
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
          >
            Send Quote
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
          >
            Mark Won
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
          >
            More
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {topSummaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard title="Quote Information">
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Quote Number" value={quote.quoteNumber} />
              <DetailField label="Revision Number" value={quote.revision} />
              <DetailField label="Job Number" value={quote.jobNumber} />
              <DetailField label="Project Name" value={quote.projectName} />
              <DetailField label="Customer" value={quote.customer} />
              <DetailField
                label="Project Address"
                value={quote.projectAddress}
              />
              <DetailField label="Contact Name" value={quote.contactName} />
              <DetailField label="Contact Email" value={quote.contactEmail} />
              <DetailField label="Contact Phone" value={quote.contactPhone} />
              <DetailField label="Quote Date" value={quote.quoteDate} />
              <DetailField label="Expiration Date" value={quote.expirationDate} />
              <DetailField label="Price List" value={quote.priceList} />
              <DetailField label="Tax Rate" value={quote.taxRate} />
              <DetailField label="Customer PO" value={quote.customerPo} />
            </dl>
          </SectionCard>

          <SectionCard title="Line Items" noPadding>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Line #</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">
                      Item / Product
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Description</th>
                    <th className="px-3 py-2.5 font-semibold">Qty</th>
                    <th className="px-3 py-2.5 font-semibold">Unit</th>
                    <th className="px-3 py-2.5 font-semibold">Unit Price</th>
                    <th className="px-3 py-2.5 font-semibold">Weight</th>
                    <th className="px-3 py-2.5 font-semibold">Yards</th>
                    <th className="px-3 py-2.5 font-semibold">Taxable</th>
                    <th className="px-3 py-2.5 font-semibold">Total</th>
                    <th className="px-3 py-2.5 font-semibold">
                      Status / Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quote.lineItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No line items on this quote.
                      </td>
                    </tr>
                  ) : (
                    quote.lineItems.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 text-slate-700">
                        {line.lineNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge label={line.typeLabel} variant="neutral" />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {line.item}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {line.description}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{line.qty}</td>
                      <td className="px-3 py-2.5 text-slate-600">{line.unit}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {line.unitPrice}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {line.weight}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{line.yards}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          label={line.taxable ? "Yes" : "No"}
                          variant={line.taxable ? "success" : "neutral"}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {line.total}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {line.statusNotes}
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Notes and Terms">
            <dl className="grid gap-5">
              <DetailField
                label="Customer-Facing Notes"
                value={quote.customerNotes}
              />
              <DetailField label="Internal Notes" value={quote.internalNotes} />
              <DetailField label="Delivery Notes" value={quote.deliveryNotes} />
              <div className="grid gap-5 sm:grid-cols-2">
                <DetailField label="Lead Time" value={quote.leadTime} />
                <DetailField
                  label="Terms and Conditions"
                  value={quote.terms}
                />
              </div>
            </dl>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard title="Quote Summary">
            <dl className="space-y-3 text-xs">
              {[
                ["Subtotal", quote.summary.subtotal],
                ["Discount", quote.summary.discount],
                ["Delivery", quote.summary.delivery],
                ["Taxable Amount", quote.summary.taxableAmount],
                ["Sales Tax", quote.summary.salesTax],
                ["Total", quote.summary.total],
                ["Total Weight", quote.summary.totalWeight],
                ["Total Yards", quote.summary.totalYards],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd
                    className={`font-medium ${
                      label === "Total" ? "text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Revision History">
            <ul className="space-y-2">
              {quote.revisionHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-700"
                >
                  {entry.label}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Related Records">
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Job</dt>
                <dd className="font-medium text-slate-900">
                  {quote.relatedRecords.jobNumber}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Customer</dt>
                <dd className="font-medium text-slate-900">
                  {quote.relatedRecords.customer}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Structures</dt>
                <dd className="font-medium text-slate-900">
                  {quote.relatedRecords.structures}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Documents</dt>
                <dd className="font-medium text-slate-900">
                  {quote.relatedRecords.documents}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Submittals</dt>
                <dd className="font-medium text-slate-900">
                  {quote.relatedRecords.submittals}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Invoice</dt>
                <dd className="font-medium text-slate-900">
                  {quote.relatedRecords.invoice}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Delivery Tickets</dt>
                <dd className="font-medium text-slate-900">
                  {quote.relatedRecords.deliveryTickets}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Future Actions">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
              >
                Generate Submittal Package
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
              >
                Convert to Invoice
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
              >
                Create Delivery Ticket
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
              >
                Add Structure Details
              </button>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
