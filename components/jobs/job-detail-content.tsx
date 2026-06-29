import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { JobBiddingPanel } from "@/components/jobs/job-bidding-panel";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import { OpenJobFolderButton } from "@/components/jobs/open-job-folder-button";
import { JobInvoiceActions } from "@/components/jobs/job-invoice-actions";
import { JobStructureSubmittalActions } from "@/components/jobs/job-structure-submittal-actions";
import { JobFavoriteStar } from "@/components/jobs/job-favorite-star";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";
import {
  JobFilesBrowser,
} from "@/components/files/job-files-browser";
import type { JobFileBrowserItem } from "@/lib/job-file-mapper";
import { JobDeliveriesTable } from "@/components/jobs/job-deliveries-table";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";
import type { JobDetailTab, JobDetailView, JobProgressView } from "@/components/jobs/job-utils";

const CONSTRUCTION_PLANS_CATEGORY = "01 Construction Plans";

type JobDetailFiles = JobFileBrowserItem[];

type JobDetailContentProps = {
  detail: JobDetailView;
  activeTab: JobDetailTab;
  files: JobDetailFiles;
  fileCategory: string;
  isFavorited: boolean;
  bidListCustomers?: { id: string; name: string }[];
  progress?: JobProgressView | null;
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
  files: "Files",
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
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {TAB_LABELS[tab]}
      {typeof count === "number" ? (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
          }`}
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
      <td colSpan={colSpan} className="px-3 py-6 text-center text-slate-500">
        {message}
      </td>
    </tr>
  );
}

export function JobDetailContent({
  detail,
  activeTab,
  files,
  fileCategory,
  isFavorited,
  bidListCustomers = [],
  progress = null,
}: JobDetailContentProps) {
  const tabCounts: Partial<Record<JobDetailTab, number>> = {
    bidding: detail.bidders.length,
    quotes: detail.relatedQuotes.length,
    deliveries: detail.relatedDeliveries.length,
    progress: progress?.lines.length,
    production: detail.relatedStructures.length,
    invoices: detail.relatedInvoices.length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/jobs"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Jobs
        </Link>

        <div className="flex flex-wrap gap-2">
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
            href="/quotes/new"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            New Quote
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <JobFavoriteStar
                jobId={detail.id}
                initialFavorited={isFavorited}
              />
              <h2 className="font-mono text-lg font-semibold text-slate-900">
                {detail.jobNumber}
              </h2>
              <StatusBadge
                label={detail.status}
                variant={detail.statusVariant}
              />
            </div>
            <p className="text-sm font-medium text-slate-900">
              {detail.projectName}
            </p>
            <p className="text-xs text-slate-600">{detail.customer}</p>
          </div>

          <div className="flex flex-col items-end gap-1">
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
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {detail.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {stat.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{stat.detail}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
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

      {activeTab === "overview" ? (
        <SectionCard title="Job Information">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Job Number" value={detail.jobNumber} />
            <DetailField label="Project Name" value={detail.projectName} />
            <DetailField label="Awarded Contractor" value={detail.customer} />
            <DetailField
              label="Bidding"
              value={detail.biddingSummary.summaryText}
            />
            <DetailField label="Status" value={detail.status} />
            <DetailField label="Year" value={String(detail.year)} />
            <DetailField label="Project Address" value={detail.projectAddress} />
            <DetailField label="Contact Name" value={detail.contactName} />
            <DetailField label="Contact Phone" value={detail.contactPhone} />
            <DetailField label="Contact Email" value={detail.contactEmail} />
            <DetailField label="Bid Date" value={detail.bidDate} />
            <DetailField label="Awarded Date" value={detail.awardedDate} />
            <DetailField label="Created" value={detail.createdAt} />
            <DetailField label="Last Updated" value={detail.updatedAt} />
            <DetailField
              label="Folder"
              value={detail.folderPath ?? "No folder yet"}
            />
            <DetailField label="Notes" value={detail.notes} />
          </dl>
          {detail.structureStatusBreakdown.length > 0 ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Production Progress
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
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
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {activeTab === "bidding" ? (
        <JobBiddingPanel
          jobId={detail.id}
          isAwarded={detail.biddingSummary.isAwarded}
          bidders={detail.bidders}
          masterQuoteOptions={detail.masterQuoteOptions}
          customers={bidListCustomers}
        />
      ) : null}

      {activeTab === "quotes" ? (
        <SectionCard
          title="Quotes"
          description={`${detail.relatedQuotes.length} quote${
            detail.relatedQuotes.length === 1 ? "" : "s"
          }`}
          action={
            <NewRecordLink
              href={`/quotes/new?jobId=${detail.id}`}
              label="New Quote"
            />
          }
          noPadding
        >
          {detail.relatedQuotes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No quotes linked to this job yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {detail.relatedQuoteGroups.map((group) => (
                <div key={group.groupKey} className="p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
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
                      {group.scopeLabel ? (
                        <p className="text-[11px] text-slate-500">
                          Master quote {group.masterQuoteNumber}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2.5 font-semibold">
                            Quote Number
                          </th>
                          <th className="px-3 py-2.5 font-semibold">
                            Customer
                          </th>
                          <th className="px-3 py-2.5 font-semibold">Status</th>
                          <th className="px-3 py-2.5 font-semibold">Total</th>
                          <th className="px-3 py-2.5 font-semibold">
                            Last Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.quotes.map((quote) => (
                          <tr key={quote.id} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2.5">
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
                            <td className="px-3 py-2.5 text-slate-700">
                              {quote.customerName}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge
                                label={quote.statusLabel}
                                variant={quote.statusVariant}
                              />
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {quote.total}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
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
      ) : null}

      {activeTab === "deliveries" ? (
        <SectionCard
          title="Delivery Tickets"
          description={`${detail.relatedDeliveries.length} ticket${
            detail.relatedDeliveries.length === 1 ? "" : "s"
          }`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/delivery-tickets/new?jobId=${detail.id}&fulfillment=pickup`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                New Pickup Ticket
              </Link>
              <NewRecordLink
                href={`/delivery-tickets/new?jobId=${detail.id}`}
                label="New Delivery Ticket"
              />
            </div>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Ticket</th>
                  <th className="px-3 py-2.5 font-semibold">Project</th>
                  <th className="px-3 py-2.5 font-semibold">Delivery Date</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <JobDeliveriesTable deliveries={detail.relatedDeliveries} />
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "progress" && progress ? (
        <JobProgressPanel jobId={detail.id} progress={progress} />
      ) : null}

      {activeTab === "production" ? (
        <SectionCard
          title="Structures & Production"
          description={`${detail.relatedStructures.length} structure${
            detail.relatedStructures.length === 1 ? "" : "s"
          }`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/production"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Production queue
              </Link>
              <NewRecordLink
                href={`/jobs/${detail.id}/structures/new`}
                label="New Structure"
              />
            </div>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Structure</th>
                  <th className="px-3 py-2.5 font-semibold">Description</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 font-semibold">Qty</th>
                  <th className="px-3 py-2.5 font-semibold">Docs</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Submitted</th>
                  <th className="px-3 py-2.5 font-semibold">Made</th>
                  <th className="px-3 py-2.5 font-semibold">Shipped</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.relatedStructures.length === 0 ? (
                  <EmptyRow
                    colSpan={10}
                    message="No structures recorded for this job yet."
                  />
                ) : (
                  detail.relatedStructures.map((structure) => (
                    <tr key={structure.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        <StructureManageLink
                          jobId={detail.id}
                          structureId={structure.id}
                        >
                          {structure.structureNumber}
                        </StructureManageLink>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {structure.description}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {structure.typeLabel}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {structure.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {structure.documentCount}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          label={structure.statusLabel}
                          variant={structure.statusVariant}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {structure.submittedDate}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {structure.madeDate}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {structure.shippedDate}
                      </td>
                      <td className="px-3 py-2.5">
                        <JobStructureSubmittalActions
                          jobId={detail.id}
                          jobStructureId={structure.id}
                          status={structure.status}
                          needsSubmittal={structure.needsSubmittal}
                          folderPath={detail.folderPath}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "invoices" ? (
        <div className="space-y-4">
          <JobInvoiceActions deliveries={detail.invoiceableDeliveries} />
          <SectionCard
            title="Invoices"
            description={`${detail.relatedInvoices.length} invoice${
              detail.relatedInvoices.length === 1 ? "" : "s"
            }`}
            noPadding
          >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Invoice</th>
                  <th className="px-3 py-2.5 font-semibold">Ticket</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Total</th>
                  <th className="px-3 py-2.5 font-semibold">Invoice Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.relatedInvoices.length === 0 ? (
                  <EmptyRow
                    colSpan={5}
                    message="No invoices for this job yet."
                  />
                ) : (
                  detail.relatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="font-medium text-slate-900 hover:text-slate-700"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {invoice.ticketNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          label={invoice.statusLabel}
                          variant={invoice.statusVariant}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {invoice.total}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
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
      ) : null}

      {activeTab === "construction-plans" ? (
        <JobFilesBrowser
          jobId={detail.id}
          jobNumber={detail.jobNumber}
          customerName={detail.customer}
          projectName={detail.projectName}
          folderPath={detail.folderPath}
          files={files}
          activeCategory={CONSTRUCTION_PLANS_CATEGORY}
          basePath={`/jobs/${detail.id}`}
          baseQuery={{ tab: "construction-plans" }}
          lockedCategory={CONSTRUCTION_PLANS_CATEGORY}
        />
      ) : null}

      {activeTab === "files" ? (
        <JobFilesBrowser
          jobId={detail.id}
          jobNumber={detail.jobNumber}
          customerName={detail.customer}
          projectName={detail.projectName}
          folderPath={detail.folderPath}
          files={files}
          activeCategory={fileCategory}
          basePath={`/jobs/${detail.id}`}
          baseQuery={{ tab: "files" }}
        />
      ) : null}
    </div>
  );
}
