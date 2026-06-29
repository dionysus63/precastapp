import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { GenerateSubmittalPackageButton } from "@/components/quotes/generate-submittal-package-button";
import { LinkStructuresButton } from "@/components/quotes/link-structures-button";
import { MarkWonButton } from "@/components/quotes/mark-won-button";
import { ReviseQuoteButton } from "@/components/quotes/revise-quote-button";
import { SendQuoteButton } from "@/components/quotes/send-quote-button";
import { JobStructureSubmittalActions } from "@/components/jobs/job-structure-submittal-actions";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";
import { RichTextContent } from "@/components/ui/rich-text-content";
import type { QuoteDetailView } from "@/components/quotes/quote-utils";
import { isCategoryLineItem } from "@/lib/quotes/constants";

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
  const backHref = quote.jobId
    ? `/jobs/${quote.jobId}?tab=quotes`
    : "/quotes";
  const backLabel = quote.jobId ? "← Back to Job" : "← Back to Quotes";

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
          href={backHref}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          {backLabel}
        </Link>

        <div className="flex flex-wrap gap-2">
          {quote.canEdit ? (
            <Link
              href={`/quotes/${quote.id}/edit`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit Quote
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
            >
              Edit Quote
            </button>
          )}
          {quote.canRevise ? (
            <ReviseQuoteButton quoteId={quote.id} />
          ) : (
            <button
              type="button"
              disabled
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
            >
              Revise Quote
            </button>
          )}
          <Link
            href={`/quotes/${quote.id}/preview`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Preview PDF
          </Link>
          <SendQuoteButton
            quoteId={quote.id}
            quoteNumber={quote.quoteNumber}
            contactEmail={quote.contactEmailAddress}
            contactName={quote.contactName === "—" ? "" : quote.contactName}
            projectName={quote.projectName}
            disabled={!quote.canSend}
            disabledReason={
              quote.supersededBy
                ? "This quote was superseded by a newer revision."
                : !quote.canSend
                  ? "This quote cannot be sent in its current status."
                  : undefined
            }
          />
          {quote.status !== "WON" ? (
            <MarkWonButton quoteId={quote.id} />
          ) : null}
          {quote.status === "WON" ? (
            <LinkStructuresButton quoteId={quote.id} />
          ) : null}
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

      {quote.supersededBy ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This quote was revised.{" "}
          <Link
            href={`/quotes/${quote.supersededBy.id}`}
            className="font-semibold underline hover:text-amber-950"
          >
            Open {quote.supersededBy.quoteNumber} ({quote.supersededBy.revision})
          </Link>
        </div>
      ) : null}

      {(quote.scopeLabel || quote.customerTabs.length > 1) ? (
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {quote.scopeLabel ? (
                  <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
                    {quote.scopeLabel}
                  </span>
                ) : null}
                <StatusBadge
                  label={quote.statusLabel}
                  variant={quote.statusVariant}
                />
              </div>
              <p className="text-sm font-medium text-slate-900">
                {quote.projectName}
              </p>
              <p className="text-xs text-slate-600">
                {quote.jobNumber !== "—" ? `${quote.jobNumber} · ` : ""}
                {quote.customer}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-mono text-sm font-semibold text-slate-900">
                {quote.quoteNumber}
              </p>
              <p className="mt-0.5">{quote.revision}</p>
            </div>
          </div>

          {quote.customerTabs.length > 1 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Same quote for {quote.customerTabs.length} customers
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quote.customerTabs.map((tab) => (
                  <Link
                    key={tab.id}
                    href={`/quotes/${tab.id}`}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      tab.isCurrent
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{tab.customerName}</span>
                    <StatusBadge
                      label={tab.statusLabel}
                      variant={tab.statusVariant}
                    />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard title="Quote Information">
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Quote Number" value={quote.quoteNumber} />
              <DetailField label="Revision Number" value={quote.revision} />
              <DetailField label="Job Number" value={quote.jobNumber} />
              {quote.scopeLabel ? (
                <DetailField label="Scope / Area" value={quote.scopeLabel} />
              ) : null}
              {quote.jobId ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Link
                    href={`/jobs/${quote.jobId}?tab=production`}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
                  >
                    View job production →
                  </Link>
                </div>
              ) : null}
              <DetailField label="Project Name" value={quote.projectName} />
              <DetailField label="Customer" value={quote.customer} />
              <DetailField
                label="Project Address"
                value={quote.projectAddress}
              />
              <DetailField label="Contact Name" value={quote.contactName} />
              <DetailField label="Contact Role" value={quote.contactTitle} />
              <DetailField label="Contact Email" value={quote.contactEmail} />
              <DetailField label="Contact Phone" value={quote.contactPhone} />
              <DetailField label="Quote Date" value={quote.quoteDate} />
              <DetailField label="Created By" value={quote.createdBy} />
              <DetailField label="Sent Date" value={quote.sentAt} />
              {quote.bidListContractor ? (
                <DetailField
                  label="Bid List Contractor"
                  value={quote.bidListContractor}
                />
              ) : null}
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
                    quote.lineItems.map((line) =>
                      isCategoryLineItem(line.type) ? (
                        <tr key={line.id} className="bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-700">
                            {line.lineNumber}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge
                              label={line.typeLabel}
                              variant="neutral"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900 underline">
                            {line.description}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                          <td className="px-3 py-2.5 text-slate-400">—</td>
                        </tr>
                      ) : (
                        <tr key={line.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-700">
                            {line.lineNumber}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge
                              label={line.typeLabel}
                              variant="neutral"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {line.item}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            <RichTextContent value={line.description} />
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {line.qty}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {line.unit}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {line.unitPrice}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {line.weight}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {line.yards}
                          </td>
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
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {quote.status === "WON" || quote.relatedStructures.length > 0 ? (
            <SectionCard
              title="Structures & Submittals"
              description={
                quote.relatedStructures.length > 0
                  ? `${quote.relatedStructures.length} structure${
                      quote.relatedStructures.length === 1 ? "" : "s"
                    } linked from this quote`
                  : "Link structures after marking this quote as won."
              }
              noPadding
            >
              {quote.relatedStructures.length === 0 ? (
                <div className="space-y-3 px-4 py-6">
                  <p className="text-sm text-slate-500">
                    No job structures linked yet. Use Link structures to create
                    production records from configurable and custom line items.
                  </p>
                  {quote.status === "WON" ? (
                    <LinkStructuresButton quoteId={quote.id} />
                  ) : null}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5 font-semibold">Structure</th>
                        <th className="px-3 py-2.5 font-semibold">Description</th>
                        <th className="px-3 py-2.5 font-semibold">Status</th>
                        <th className="px-3 py-2.5 font-semibold">Docs</th>
                        <th className="px-3 py-2.5 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quote.relatedStructures.map((structure) => (
                        <tr key={structure.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            <StructureManageLink
                              jobId={structure.jobId}
                              structureId={structure.id}
                            >
                              {structure.structureNumber}
                            </StructureManageLink>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {structure.description}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge
                              label={structure.statusLabel}
                              variant={
                                structure.status === "MADE" ||
                                structure.status === "SHIPPED"
                                  ? "success"
                                  : structure.status === "SUBMITTED"
                                    ? "warning"
                                    : structure.status === "APPROVED" ||
                                        structure.status === "IN_PRODUCTION"
                                      ? "info"
                                      : "neutral"
                              }
                            />
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {structure.documentCount}
                          </td>
                          <td className="px-3 py-2.5">
                            {structure.jobId ? (
                              <JobStructureSubmittalActions
                                jobId={structure.jobId}
                                jobStructureId={structure.id}
                                status={structure.status}
                                needsSubmittal={structure.needsSubmittal}
                                folderPath={structure.folderPath}
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          ) : null}

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
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    entry.isCurrent
                      ? "border-sky-200 bg-sky-50/60 font-medium text-sky-900"
                      : "border-slate-100 bg-slate-50/60 text-slate-700"
                  }`}
                >
                  {entry.isCurrent ? (
                    entry.label
                  ) : (
                    <Link
                      href={`/quotes/${entry.id}`}
                      className="hover:underline"
                    >
                      {entry.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Related Records">
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Job</dt>
                <dd className="font-medium text-slate-900">
                  {quote.jobId ? (
                    <Link
                      href={`/jobs/${quote.jobId}?tab=production`}
                      className="hover:underline"
                    >
                      {quote.relatedRecords.jobNumber}
                    </Link>
                  ) : (
                    quote.relatedRecords.jobNumber
                  )}
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

          <SectionCard title="Actions">
            <div className="flex flex-col gap-2">
              {quote.canEdit ? (
                <Link
                  href={`/quotes/${quote.id}/edit`}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-center text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Edit Quote
                </Link>
              ) : null}
              <GenerateSubmittalPackageButton quoteId={quote.id} />
              {quote.jobId ? (
                <Link
                  href={`/jobs/${quote.jobId}?tab=production`}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Job Production & Submittals
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
                >
                  Job Production & Submittals
                </button>
              )}
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
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
