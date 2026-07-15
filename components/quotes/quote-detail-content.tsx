import Link from "next/link";
import { BackButton } from "@/components/dashboard/back-button";
import { CollapsibleSectionCard } from "@/components/dashboard/collapsible-section-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { GenerateSubmittalPackageButton } from "@/components/quotes/generate-submittal-package-button";
import {
  CreateDrillSheetsButton,
  StructureDrillSheetBadge,
} from "@/components/quotes/create-drill-sheets-button";
import { DrillSheetPdfLink } from "@/components/drill-sheets/drill-sheet-pdf-link";
import { LinkStructuresButton } from "@/components/quotes/link-structures-button";
import { MarkWonButton } from "@/components/quotes/mark-won-button";
import { DeleteQuoteButton } from "@/components/quotes/delete-quote-button";
import { EditSentQuoteButton } from "@/components/quotes/edit-sent-quote-button";
import { ReviseQuoteButton } from "@/components/quotes/revise-quote-button";
import { SendQuoteButton } from "@/components/quotes/send-quote-button";
import { JobStructureSubmittalActions } from "@/components/jobs/job-structure-submittal-actions";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { CustomStructureDetailBreakdown } from "@/components/quotes/custom-structure-cost-breakdown";
import type { QuoteDetailView } from "@/components/quotes/quote-utils";
import { isCategoryLineItem } from "@/lib/quotes/constants";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableHeaderCellWrapClassName,
  tableRowClassName,
} from "@/lib/table-styles";

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

function HeaderStat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="px-4 py-2 first:pl-3 last:pr-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={
          emphasize
            ? "text-base font-semibold text-slate-900"
            : "text-sm text-slate-800"
        }
      >
        {value}
      </p>
    </div>
  );
}

function RelatedChip({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </>
  );
  const chipClassName =
    "inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px]";

  if (href) {
    return (
      <Link href={href} className={`${chipClassName} hover:bg-slate-50`}>
        {body}
      </Link>
    );
  }

  return <span className={chipClassName}>{body}</span>;
}

const toolbarButtonClassName =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50";
const toolbarDisabledClassName =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400";

type QuoteDetailContentProps = {
  quote: QuoteDetailView;
  /** Auto-open the send dialog (form's save-then-send flow via ?send=1). */
  autoOpenSend?: boolean;
};

export function QuoteDetailContent({
  quote,
  autoOpenSend = false,
}: QuoteDetailContentProps) {
  const backHref = quote.jobId
    ? `/jobs/${quote.jobId}?tab=quotes`
    : "/quotes";
  const backLabel = quote.jobId ? "Back to Job" : "Back to Quotes";

  const drillSheetCreatedCount = quote.relatedStructures.filter(
    (structure) => structure.drillSheetId,
  ).length;
  const showDrillSheetBar =
    quote.drillSheetReadyCount > 0 || drillSheetCreatedCount > 0;

  const contextLine = [
    quote.jobNumber !== "—" ? quote.jobNumber : null,
    quote.customer,
    quote.customerPo !== "—" ? `PO ${quote.customerPo}` : null,
  ].filter(Boolean);

  const noteBadges = [
    { label: "customer notes", present: quote.customerNotes !== "—" },
    { label: "internal notes", present: quote.internalNotes !== "—" },
    { label: "delivery notes", present: quote.deliveryNotes !== "—" },
  ].filter((badge) => badge.present);

  const summaryRows: Array<[string, string]> = [
    ["Subtotal", quote.summary.subtotal],
    ["Discount", quote.summary.discount],
    ["Delivery", quote.summary.delivery],
    ["Taxable Amount", quote.summary.taxableAmount],
    ["Sales Tax", quote.summary.salesTax],
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <BackButton href={backHref} label={backLabel} />

          <div className="flex flex-wrap items-center gap-2">
            {quote.canEdit ? (
              quote.status === "SENT" ? (
                <EditSentQuoteButton
                  quoteId={quote.id}
                  className={toolbarButtonClassName}
                />
              ) : (
                <Link
                  href={`/quotes/${quote.id}/edit`}
                  className={toolbarButtonClassName}
                >
                  Edit Quote
                </Link>
              )
            ) : (
              <button type="button" disabled className={toolbarDisabledClassName}>
                Edit Quote
              </button>
            )}
            {quote.canRevise ? (
              <ReviseQuoteButton quoteId={quote.id} />
            ) : (
              <button type="button" disabled className={toolbarDisabledClassName}>
                Revise Quote
              </button>
            )}
            <Link
              href={`/quotes/${quote.id}/preview`}
              className={toolbarButtonClassName}
            >
              Preview PDF
            </Link>
            <SendQuoteButton
              quoteId={quote.id}
              quoteNumber={quote.quoteNumber}
              defaultOpen={autoOpenSend}
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
            <details className="relative">
              <summary
                className={`${toolbarButtonClassName} flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden`}
              >
                More
                <svg
                  viewBox="0 0 16 16"
                  className="h-3 w-3 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </summary>
              <div className="absolute right-0 z-20 mt-1 flex w-64 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
                {quote.jobId ? (
                  <Link
                    href={`/jobs/${quote.jobId}?tab=invoices`}
                    title="Invoices are created from delivered delivery tickets on the job's Invoices tab."
                    className="rounded-lg border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Convert to Invoice
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Link this quote to a job first — invoices are created from the job's delivered delivery tickets."
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
                  >
                    Convert to Invoice
                  </button>
                )}
                {quote.jobId ? (
                  <Link
                    href={`/delivery-tickets/new?jobId=${quote.jobId}`}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Create Ticket
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Link this quote to a job first — tickets are created against the job."
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
                  >
                    Create Ticket
                  </button>
                )}
                <div className="border-t border-slate-100 pt-2">
                  <DeleteQuoteButton
                    quoteId={quote.id}
                    quoteNumber={quote.quoteNumber}
                    disabled={!quote.canDelete}
                    disabledReason="Won quotes anchor the job's structures — revise the quote or mark it Lost instead."
                  />
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-semibold text-slate-900">
              {quote.quoteNumber}
            </span>
            <StatusBadge
              label={quote.statusLabel}
              variant={quote.statusVariant}
            />
            {quote.scopeLabel ? (
              <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-900">
                {quote.scopeLabel}
              </span>
            ) : null}
            {quote.revisionHistory.length > 1 ? (
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Revisions
                </span>
                {quote.revisionHistory.map((entry) => {
                  const chipText = entry.label.split(" — ")[0];
                  return entry.isCurrent ? (
                    <span
                      key={entry.id}
                      title={entry.label}
                      className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-sky-900"
                    >
                      {chipText}
                    </span>
                  ) : (
                    <Link
                      key={entry.id}
                      href={`/quotes/${entry.id}`}
                      title={entry.label}
                      className="inline-flex rounded-full border border-slate-200 px-2.5 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-slate-50"
                    >
                      {chipText}
                    </Link>
                  );
                })}
              </span>
            ) : null}
          </div>

          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">
              {quote.projectName}
            </span>
            {contextLine.length > 0 ? ` · ${contextLine.join(" · ")}` : ""}
          </p>

          <div className="flex flex-wrap divide-x divide-slate-200 rounded-lg border border-slate-200/80 bg-slate-50/60">
            <HeaderStat label="Total" value={quote.total} emphasize />
            <HeaderStat label="Bid Due" value={quote.bidDueDate} />
            <HeaderStat label="Expires" value={quote.expirationDate} />
            <HeaderStat label="Estimator" value={quote.estimator} />
            <HeaderStat label="Sent" value={quote.sentAt} />
            <HeaderStat
              label="Contact"
              value={
                quote.contactEmailAddress ? (
                  <a
                    href={`mailto:${quote.contactEmailAddress}`}
                    className="hover:underline"
                  >
                    {quote.contactName}
                  </a>
                ) : (
                  quote.contactName
                )
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Related
            </span>
            <RelatedChip
              label="Job"
              value={quote.relatedRecords.jobNumber}
              href={
                quote.jobId ? `/jobs/${quote.jobId}?tab=production` : undefined
              }
            />
            <RelatedChip
              label="Structures"
              value={quote.relatedRecords.structures}
              href={
                quote.relatedStructures.length > 0
                  ? "#structures-submittals"
                  : undefined
              }
            />
            <RelatedChip
              label="Documents"
              value={quote.relatedRecords.documents}
            />
            <RelatedChip
              label="Submittals"
              value={quote.relatedRecords.submittals}
            />
            <RelatedChip label="Invoice" value={quote.relatedRecords.invoice} />
            <RelatedChip
              label="Tickets"
              value={quote.relatedRecords.deliveryTickets}
            />
          </div>

          {quote.customerTabs.length > 1 ? (
            <div className="border-t border-slate-100 pt-3">
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
        </div>
      </section>

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

      <SectionCard title="Line Items" noPadding>
        {showDrillSheetBar ? (
          <div className="border-b border-slate-100 px-4 py-3">
            <CreateDrillSheetsButton
              quoteId={quote.id}
              readyCount={quote.drillSheetReadyCount}
              createdCount={drillSheetCreatedCount}
              canEdit={quote.canEdit}
            />
          </div>
        ) : null}
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellWrapClassName}>Line #</th>
                <th className={tableHeaderCellWrapClassName}>Type</th>
                <th className={tableHeaderCellWrapClassName}>
                  Item / Product
                </th>
                <th className={tableHeaderCellWrapClassName}>Description</th>
                <th className={tableHeaderCellWrapClassName}>Qty</th>
                <th className={tableHeaderCellWrapClassName}>Unit</th>
                <th className={tableHeaderCellWrapClassName}>Unit Price</th>
                <th className={tableHeaderCellWrapClassName}>Weight</th>
                <th className={tableHeaderCellWrapClassName}>Qty on Hand</th>
                <th className={tableHeaderCellWrapClassName}>Taxable</th>
                <th className={tableHeaderCellWrapClassName}>Total</th>
                <th className={tableHeaderCellWrapClassName}>
                  Status / Notes
                </th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {quote.lineItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}
                  >
                    No line items on this quote.
                  </td>
                </tr>
              ) : (
                quote.lineItems.map((line) =>
                  isCategoryLineItem(line.type) ? (
                    <tr key={line.id} className="bg-slate-50/60">
                      <td className={`${tableCellClassName} text-slate-700`}>
                        {line.lineNumber}
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge
                          label={line.typeLabel}
                          variant="neutral"
                        />
                      </td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                      <td className={`${tableCellClassName} font-semibold text-slate-900 underline`}>
                        {line.description}
                      </td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                      <td className={`${tableCellClassName} text-slate-400`}>—</td>
                    </tr>
                  ) : (
                    <tr key={line.id} className={tableRowClassName}>
                      <td className={`${tableCellClassName} text-slate-700`}>
                        {line.lineNumber}
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge
                          label={line.typeLabel}
                          variant="neutral"
                        />
                      </td>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        {line.item}
                        <StructureDrillSheetBadge
                          status={line.structureDrillSheetStatus}
                          jobStructureId={line.jobStructureId}
                        />
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        <RichTextContent value={line.description} />
                        {line.type === "CUSTOM_STRUCTURE" &&
                        line.costBreakdown?.length ? (
                          <CustomStructureDetailBreakdown
                            items={line.costBreakdown}
                          />
                        ) : null}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {line.qty}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {line.unit}
                      </td>
                      <td className={`${tableCellClassName} text-slate-700`}>
                        {line.unitPrice}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {line.weight}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {line.qtyOnHand}
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge
                          label={line.taxable ? "Yes" : "No"}
                          variant={line.taxable ? "success" : "neutral"}
                        />
                      </td>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        {line.total}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {line.statusNotes}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-[11px] text-slate-500">
            Total Weight{" "}
            <span className="font-medium text-slate-700">
              {quote.summary.totalWeight}
            </span>
            {" · "}Total Yards{" "}
            <span className="font-medium text-slate-700">
              {quote.summary.totalYards}
            </span>
          </p>
          <dl className="w-64 max-w-full space-y-1 text-xs">
            {summaryRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3"
              >
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium text-slate-700">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-slate-300 pt-1">
              <dt className="font-semibold text-slate-900">Total</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {quote.summary.total}
              </dd>
            </div>
          </dl>
        </div>
      </SectionCard>

      {quote.status === "WON" || quote.relatedStructures.length > 0 ? (
        <SectionCard
          id="structures-submittals"
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
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Structure</th>
                    <th className={tableHeaderCellClassName}>Description</th>
                    <th className={tableHeaderCellClassName}>Status</th>
                    <th className={tableHeaderCellClassName}>Docs</th>
                    <th className={tableHeaderCellClassName}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {quote.relatedStructures.map((structure) => (
                    <tr key={structure.id} className={tableRowClassName}>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        <StructureManageLink
                          jobId={structure.jobId}
                          structureId={structure.id}
                        >
                          {structure.structureNumber}
                        </StructureManageLink>
                      </td>
                      <td className={`${tableCellClassName} text-slate-700`}>
                        {structure.description}
                      </td>
                      <td className={tableCellClassName}>
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
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {structure.documentCount}
                      </td>
                      <td className={tableCellClassName}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {structure.drillSheetId ? (
                            <>
                              <DrillSheetPdfLink
                                drillSheetId={structure.drillSheetId}
                                label="PDF"
                              />
                              <Link
                                href={`/drill-sheets/${structure.drillSheetId}`}
                                className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Drill Sheet
                              </Link>
                            </>
                          ) : null}
                          {structure.jobId ? (
                            <JobStructureSubmittalActions
                              jobId={structure.jobId}
                              jobStructureId={structure.id}
                              status={structure.status}
                              needsSubmittal={structure.needsSubmittal}
                              folderPath={structure.folderPath}
                            />
                          ) : structure.drillSheetId ? null : (
                            "—"
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CollapsibleSectionCard title="Quote Details">
          <dl className="grid gap-5 sm:grid-cols-2">
            <DetailField label="Quote Number" value={quote.quoteNumber} />
            <DetailField label="Revision Number" value={quote.revision} />
            <DetailField label="Original Quote" value={quote.originalQuote} />
            <DetailField label="Job Number" value={quote.jobNumber} />
            {quote.scopeLabel ? (
              <DetailField label="Scope / Area" value={quote.scopeLabel} />
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
            {quote.jobId ? (
              <div className="sm:col-span-2">
                <Link
                  href={`/jobs/${quote.jobId}?tab=production`}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
                >
                  View job production →
                </Link>
              </div>
            ) : null}
          </dl>
        </CollapsibleSectionCard>

        <CollapsibleSectionCard
          title="Notes and Terms"
          summaryExtra={noteBadges.map((badge) => (
            <StatusBadge
              key={badge.label}
              label={badge.label}
              variant={badge.label === "internal notes" ? "warning" : "neutral"}
            />
          ))}
        >
          <dl className="grid gap-5">
            <DetailField
              label="Customer-Facing Notes"
              value={quote.customerNotes}
            />
            <DetailField label="Internal Notes" value={quote.internalNotes} />
            <DetailField label="Delivery Notes" value={quote.deliveryNotes} />
            <div className="grid gap-5 sm:grid-cols-2">
              <DetailField label="Lead Time" value={quote.leadTime} />
              <DetailField label="F.O.B." value={quote.fob} />
              <DetailField
                label="Terms and Conditions"
                value={quote.terms}
              />
            </div>
          </dl>
        </CollapsibleSectionCard>
      </div>
    </div>
  );
}
