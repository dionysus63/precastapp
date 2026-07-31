import Link from "next/link";
import type { ReactNode } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import { OpenJobFolderButton } from "@/components/jobs/open-job-folder-button";
import { JobInvoiceActions } from "@/components/jobs/job-invoice-actions";
import { JobStructureImportButton } from "@/components/jobs/job-structure-import-dialog";
import { JobCustomStructureImportButton } from "@/components/jobs/job-custom-structure-import-dialog";
import { JobStructuresProductionTable } from "@/components/jobs/job-structures-production-table";
import { JobFavoriteStar } from "@/components/jobs/job-favorite-star";
import { QuotePoInline } from "@/components/quotes/quote-po-inline";
import {
  JobCustomerEditor,
  JobStatusSelect,
  type AssignableCustomer,
} from "@/components/jobs/job-quick-edit";
import { JobDrillSheetsPdfButtons } from "@/components/drill-sheets/job-drill-sheets-pdf-buttons";
import { MarkAllSubmittedButton } from "@/components/drill-sheets/mark-all-submitted-button";
import { JobDeliveriesTable } from "@/components/jobs/job-deliveries-table";
import {
  groupJobRelatedQuotes,
  type JobAttentionItem,
  type JobDetailTab,
  type JobDetailView,
  type JobInvoiceableDelivery,
  type JobOverviewData,
  type JobRelatedDelivery,
  type JobRelatedInvoice,
  type JobRelatedQuote,
  type JobRelatedStructure,
} from "@/components/jobs/job-utils";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellWrapClassName,
  tableRowClassName,
} from "@/lib/table-styles";
import { BackButton } from "@/components/dashboard/back-button";
type JobDetailContentProps = {
  detail: JobDetailView;
  activeTab: JobDetailTab;
  isFavorited: boolean;
  assignableCustomers: AssignableCustomer[];
  children: ReactNode;
};

const TAB_ORDER: JobDetailTab[] = [
  "overview",
  "bidding",
  "quotes",
  "deliveries",
  "progress",
  "production",
  "invoices",
  "construction-plans",
  "purchase-orders",
  "tax-exempt-cert",
  "files",
];

const TAB_LABELS: Record<JobDetailTab, string> = {
  overview: "Overview",
  bidding: "Bidding",
  quotes: "Quotes",
  deliveries: "Deliveries",
  progress: "Progress",
  production: "Production",
  invoices: "Invoices",
  "construction-plans": "Construction Plans",
  "purchase-orders": "Purchase Orders",
  "tax-exempt-cert": "Tax Exempt Cert",
  files: "Files",
};

/** Which tab each summary stat card links to. */
const STAT_TABS: Record<string, JobDetailTab> = {
  Quotes: "quotes",
  "Won Value": "quotes",
  Structures: "production",
  Deliveries: "deliveries",
  Invoices: "invoices",
};

function NewRecordLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800"
    >
      {label}
    </Link>
  );
}

function tabHref(jobId: string, tab: JobDetailTab) {
  return tab === "overview" ? `/jobs/${jobId}` : `/jobs/${jobId}?tab=${tab}`;
}

function TabLink({
  jobId,
  tab,
  active,
  count,
}: {
  jobId: string;
  tab: JobDetailTab;
  active: boolean;
  count?: number;
}) {
  return (
    <Link
      href={tabHref(jobId, tab)}
      className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
      }`}
    >
      {TAB_LABELS[tab]}
      {typeof count === "number" ? (
        <span
          className={`ml-1.5 ${active ? "text-slate-500" : "text-slate-400"}`}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}>
        {message}
      </td>
    </tr>
  );
}

export function JobDetailTabSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-9 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function JobDetailContent({
  detail,
  activeTab,
  isFavorited,
  assignableCustomers,
  children,
}: JobDetailContentProps) {
  const tabCounts: Partial<Record<JobDetailTab, number>> = {
    bidding: detail.counts.bidders,
    quotes: detail.counts.quotes,
    deliveries: detail.counts.deliveries,
    production: detail.counts.structures,
    invoices: detail.counts.invoices,
  };

  // Customer moved out of the context line — the header's quick contractor
  // select shows (and edits) it.
  const contextLine = [
    detail.projectAddress !== "—" ? detail.projectAddress : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <BackButton href="/jobs" label="Back to Jobs" />

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/jobs/${detail.id}/edit`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit Job
            </Link>
            {detail.customerId ? (
              <Link
                href={`/customers/${detail.customerId}`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                View Customer
              </Link>
            ) : null}
            <Link
              href={`/quotes/new?jobId=${detail.id}`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              New Quote
            </Link>
            {detail.folderPath ? (
              <OpenJobFolderButton
                jobId={detail.id}
                folderPath={detail.folderPath}
              />
            ) : (
              <CreateJobFolderButton jobId={detail.id} />
            )}
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <JobFavoriteStar
              jobId={detail.id}
              initialFavorited={isFavorited}
            />
            <h2 className="font-mono text-lg font-semibold text-slate-900">
              {detail.jobNumber}
            </h2>
            <JobStatusSelect
              jobId={detail.id}
              jobNumber={detail.jobNumber}
              statusValue={detail.statusValue}
              statusVariant={detail.statusVariant}
            />
            <JobCustomerEditor
              jobId={detail.id}
              jobNumber={detail.jobNumber}
              customerId={detail.customerId}
              customerName={detail.customer}
              customers={assignableCustomers}
            />
            {detail.poQuoteId ? (
              <span className="rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1 text-xs text-slate-700">
                <QuotePoInline
                  quoteId={detail.poQuoteId}
                  customerPo={detail.customerPO}
                />
              </span>
            ) : null}
          </div>

          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">
              {detail.projectName}
            </span>
            {contextLine.length > 0 ? ` · ${contextLine.join(" · ")}` : ""}
          </p>

          <div className="flex flex-wrap divide-x divide-slate-200 rounded-lg border border-slate-200/80 bg-slate-50/60">
            {detail.stats.map((stat) => {
              const statTab = STAT_TABS[stat.label];
              const body = (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {stat.value}
                    <span className="ml-1.5 text-xs font-normal text-slate-500">
                      {stat.detail}
                    </span>
                  </p>
                </>
              );

              return statTab ? (
                <Link
                  key={stat.label}
                  href={tabHref(detail.id, statTab)}
                  title={`Open ${TAB_LABELS[statTab]}`}
                  className="px-4 py-2 transition-colors hover:bg-slate-100/70"
                >
                  {body}
                </Link>
              ) : (
                <div key={stat.label} className="px-4 py-2">
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="border-b border-slate-200">
        <div className="-mb-px flex flex-wrap items-center gap-1">
          {TAB_ORDER.map((tab) => (
            <TabLink
              key={tab}
              jobId={detail.id}
              tab={tab}
              active={activeTab === tab}
              count={tabCounts[tab]}
            />
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}

const attentionToneClassName: Record<JobAttentionItem["tone"], string> = {
  warning: "bg-amber-400",
  danger: "bg-red-500",
  info: "bg-sky-500",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 text-xs last:border-b-0">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="break-words text-right font-medium text-slate-800">
        {value}
      </dd>
    </div>
  );
}

export function JobOverviewSection({
  detail,
  overview,
}: {
  detail: JobDetailView;
  overview: JobOverviewData;
}) {
  const shippedPercent =
    overview.structuresTotal > 0
      ? Math.round(
          (overview.structuresShipped / overview.structuresTotal) * 100,
        )
      : 0;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <SectionCard title="Needs Attention" noPadding>
          {overview.attentionItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Nothing needs attention on this job right now.
            </p>
          ) : (
            <div>
              {overview.attentionItems.map((item) => (
                <Link
                  key={item.key}
                  href={tabHref(detail.id, item.tab)}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2.5 text-sm text-slate-800">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${attentionToneClassName[item.tone]}`}
                    />
                    {item.label}
                  </span>
                  <span className="whitespace-nowrap text-[11px] text-slate-400">
                    {TAB_LABELS[item.tab]} →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent Activity" noPadding>
          {overview.recentActivity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No quotes, deliveries, structures, or invoices on this job yet.
            </p>
          ) : (
            <div>
              {overview.recentActivity.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                    <span className="w-14 shrink-0 text-slate-400">
                      {item.typeLabel}
                    </span>
                    <Link
                      href={item.href}
                      className="font-mono text-[11px] font-medium text-slate-900 hover:underline"
                    >
                      {item.recordNumber}
                    </Link>
                    <StatusBadge
                      label={item.statusLabel}
                      variant={item.statusVariant}
                    />
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-slate-500">
                    {item.updated}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard title="Job Information">
          <dl>
            <InfoRow label="Contact" value={detail.contactName} />
            <InfoRow label="Phone" value={detail.contactPhone} />
            <InfoRow label="Email" value={detail.contactEmail} />
            <InfoRow label="Bid Date" value={detail.bidDate} />
            <InfoRow label="Awarded Date" value={detail.awardedDate} />
            <InfoRow label="Year" value={String(detail.year)} />
            <InfoRow
              label="Bidding"
              value={detail.biddingSummary.summaryText}
            />
            <InfoRow label="Created" value={detail.createdAt} />
            <InfoRow label="Last Updated" value={detail.updatedAt} />
            <InfoRow
              label="Folder"
              value={detail.folderPath ?? "No folder yet"}
            />
          </dl>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
              {detail.notes}
            </p>
          </div>
        </SectionCard>

        {overview.structuresTotal > 0 ? (
          <SectionCard title="Production Progress">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${shippedPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {overview.structuresShipped} of {overview.structuresTotal}{" "}
              structure{overview.structuresTotal === 1 ? "" : "s"} shipped
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.structureStatusBreakdown.map((entry) => (
                <span
                  key={entry.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                >
                  {entry.label}
                  <span className="rounded-full bg-white px-1.5 text-[10px] font-semibold text-slate-600">
                    {entry.count}
                  </span>
                </span>
              ))}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}

export function JobQuotesSection({
  jobId,
  quotes,
}: {
  jobId: string;
  quotes: JobRelatedQuote[];
}) {
  const quoteGroups = groupJobRelatedQuotes(quotes);

  return (
    <SectionCard
      title="Quotes"
      description={`${quotes.length} quote${quotes.length === 1 ? "" : "s"}`}
      action={
        <NewRecordLink href={`/quotes/new?jobId=${jobId}`} label="New Quote" />
      }
      noPadding
    >
      {quotes.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          No quotes linked to this job yet.
        </p>
      ) : (
        <div className="divide-y divide-slate-200">
          {quoteGroups.map((group) => (
            <div key={group.groupKey}>
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                {group.scopeLabel ? (
                  <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-900">
                    {group.scopeLabel}
                  </span>
                ) : null}
                <span className="font-mono text-sm font-semibold text-slate-900">
                  {group.masterQuoteNumber}
                </span>
                {group.quoteCount > 1 ? (
                  <span className="text-[11px] text-slate-500">
                    {group.quoteCount} customer
                    {group.quoteCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <div className={tableFlushWrapperClassName}>
                <table className={tableClassName}>
                  <thead>
                    <tr>
                      <th className={tableHeaderCellWrapClassName}>
                        Quote Number
                      </th>
                      <th className={tableHeaderCellWrapClassName}>
                        Customer
                      </th>
                      <th className={tableHeaderCellWrapClassName}>Status</th>
                      <th className={tableHeaderCellWrapClassName}>Total</th>
                      <th className={tableHeaderCellWrapClassName}>
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className={tableBodyClassName}>
                    {group.quotes.map((quote) => (
                      <tr key={quote.id} className={tableRowClassName}>
                        <td className={tableCellClassName}>
                          <Link
                            href={`/quotes/${quote.id}`}
                            className="font-medium text-slate-900 hover:text-slate-700"
                          >
                            {quote.quoteNumber}
                          </Link>
                          {quote.isMaster && group.quoteCount > 1 ? (
                            <span className="ml-2 text-[10px] font-medium uppercase text-slate-400">
                              Master
                            </span>
                          ) : null}
                        </td>
                        <td className={`${tableCellClassName} text-slate-700`}>
                          {quote.customerName}
                        </td>
                        <td className={tableCellClassName}>
                          <StatusBadge
                            label={quote.statusLabel}
                            variant={quote.statusVariant}
                          />
                        </td>
                        <td className={`${tableCellClassName} font-medium text-slate-900`}>
                          {quote.total}
                        </td>
                        <td className={`${tableCellClassName} text-slate-600`}>
                          {quote.lastUpdated}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function JobDeliveriesSection({
  jobId,
  deliveries,
}: {
  jobId: string;
  deliveries: JobRelatedDelivery[];
}) {
  return (
    <SectionCard
      title="Tickets"
      description={`${deliveries.length} ticket${
        deliveries.length === 1 ? "" : "s"
      }`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/delivery-tickets/plan?jobId=${jobId}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Plan Loads
          </Link>
          <Link
            href={`/delivery-tickets/schedule?jobId=${jobId}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Schedule Loads
          </Link>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
              New Ticket
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3 text-white/70"
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
            <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <Link
                href={`/delivery-tickets/new?jobId=${jobId}`}
                className="rounded-lg px-3 py-1.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Delivery Ticket
              </Link>
              <Link
                href={`/delivery-tickets/new?jobId=${jobId}&fulfillment=pickup`}
                className="rounded-lg px-3 py-1.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Pickup Ticket
              </Link>
            </div>
          </details>
        </div>
      }
      noPadding
    >
      <div className={tableFlushWrapperClassName}>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellWrapClassName}>Ticket</th>
              <th className={tableHeaderCellWrapClassName}>Project</th>
              <th className={tableHeaderCellWrapClassName}>Delivery Date</th>
              <th className={tableHeaderCellWrapClassName}>Status</th>
              <th className={tableHeaderCellWrapClassName}>Last Updated</th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            <JobDeliveriesTable deliveries={deliveries} />
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function JobProductionSection({
  jobId,
  folderPath,
  structures,
  completeDrillSheetsHref,
  jobStatusValue,
}: {
  jobId: string;
  folderPath: string | null;
  structures: JobRelatedStructure[];
  completeDrillSheetsHref?: string | null;
  jobStatusValue: string;
}) {
  return (
    <SectionCard
      title="Structures & Production"
      description={`${structures.length} structure${
        structures.length === 1 ? "" : "s"
      }`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {structures.some((structure) => structure.drillSheetId) ? (
            <JobDrillSheetsPdfButtons jobId={jobId} />
          ) : null}
          <MarkAllSubmittedButton
            jobId={jobId}
            count={
              structures.filter(
                (structure) =>
                  structure.drillSheetId &&
                  structure.status === "NOT_SUBMITTED",
              ).length
            }
          />
          {completeDrillSheetsHref ? (
            <Link
              href={completeDrillSheetsHref}
              className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
            >
              Complete Drill Sheets
            </Link>
          ) : null}
          <Link
            href="/production"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Production queue
          </Link>
          {structures.some((structure) => structure.drillSheetId) ? (
            <Link
              href={`/jobs/${jobId}/structures/bulk-edit`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Bulk Edit
            </Link>
          ) : null}
          <JobStructureImportButton jobId={jobId} />
          <Link
            href={`/drill-sheets/new?jobId=${jobId}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Circular Drill Sheet
          </Link>
          <Link
            href={`/drill-sheets/rect/new?jobId=${jobId}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            New Rectangular Drill Sheet
          </Link>
          <JobCustomStructureImportButton jobId={jobId} />
          <NewRecordLink
            href={`/jobs/${jobId}/structures/new`}
            label="New Custom Structure"
          />
        </div>
      }
      noPadding
    >
      <JobStructuresProductionTable
        jobId={jobId}
        folderPath={folderPath}
        structures={structures}
        jobStatusValue={jobStatusValue}
      />
    </SectionCard>
  );
}

export type JobDeliveryChargesSummary = {
  quotedLoads: number;
  quotedAmount: number;
  invoicedLoads: number;
  invoicedAmount: number;
  pickupTicketCount: number;
};

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatLoads(value: number): string {
  return `${value % 1 === 0 ? value : value.toFixed(2)} load${value === 1 ? "" : "s"}`;
}

export function JobInvoicesSection({
  invoices,
  invoiceableDeliveries,
  canManageInvoices,
  deliveryCharges,
}: {
  invoices: JobRelatedInvoice[];
  invoiceableDeliveries: JobInvoiceableDelivery[];
  canManageInvoices: boolean;
  deliveryCharges?: JobDeliveryChargesSummary | null;
}) {
  const showDeliveryCharges =
    deliveryCharges &&
    (deliveryCharges.quotedLoads > 0 ||
      deliveryCharges.invoicedAmount > 0 ||
      deliveryCharges.pickupTicketCount > 0);
  const deliveryRemaining = deliveryCharges
    ? deliveryCharges.quotedAmount - deliveryCharges.invoicedAmount
    : 0;
  return (
    <div className="space-y-4">
      {canManageInvoices && invoiceableDeliveries.length > 0 ? (
        <JobInvoiceActions deliveries={invoiceableDeliveries} />
      ) : null}
      {showDeliveryCharges ? (
        <SectionCard
          title="Delivery charges"
          description="Freight quoted vs invoiced — loads the customer picks up shouldn't bill delivery."
        >
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Quoted
              </div>
              <div className="mt-0.5 font-semibold text-slate-900">
                {formatLoads(deliveryCharges.quotedLoads)} ·{" "}
                {formatMoney(deliveryCharges.quotedAmount)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Invoiced
              </div>
              <div className="mt-0.5 font-semibold text-slate-900">
                {formatLoads(deliveryCharges.invoicedLoads)} ·{" "}
                {formatMoney(deliveryCharges.invoicedAmount)}
              </div>
            </div>
            {deliveryCharges.pickupTicketCount > 0 ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Customer pickups
                </div>
                <div className="mt-0.5 font-semibold text-slate-900">
                  {deliveryCharges.pickupTicketCount} ticket
                  {deliveryCharges.pickupTicketCount === 1 ? "" : "s"}
                </div>
              </div>
            ) : null}
            {deliveryRemaining > 0.004 ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Not yet invoiced
                </div>
                <div className="mt-0.5 font-semibold text-amber-700">
                  {formatMoney(deliveryRemaining)}
                  {deliveryCharges.pickupTicketCount > 0
                    ? " — review before final invoice"
                    : ""}
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
      <SectionCard
        title="Invoices"
        description={`${invoices.length} invoice${
          invoices.length === 1 ? "" : "s"
        }`}
        noPadding
      >
      <div className={tableFlushWrapperClassName}>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellWrapClassName}>Invoice</th>
              <th className={tableHeaderCellWrapClassName}>Ticket</th>
              <th className={tableHeaderCellWrapClassName}>Status</th>
              <th className={tableHeaderCellWrapClassName}>Total</th>
              <th className={tableHeaderCellWrapClassName}>Invoice Date</th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {invoices.length === 0 ? (
              <EmptyRow
                colSpan={5}
                message="No invoices for this job yet."
              />
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className={tableRowClassName}>
                  <td className={tableCellClassName}>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-slate-900 hover:text-slate-700"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className={`${tableCellClassName} text-slate-700`}>
                    {invoice.ticketNumber}
                  </td>
                  <td className={tableCellClassName}>
                    <StatusBadge
                      label={invoice.statusLabel}
                      variant={invoice.statusVariant}
                    />
                  </td>
                  <td className={`${tableCellClassName} font-medium text-slate-900`}>
                    {invoice.total}
                  </td>
                  <td className={`${tableCellClassName} text-slate-600`}>
                    {invoice.invoiceDate}
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
