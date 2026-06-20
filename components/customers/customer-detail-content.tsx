import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { CustomerDetailView } from "@/components/customers/customer-utils";

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

function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SectionCard title={title}>
      <p className="text-xs text-slate-500">{description}</p>
    </SectionCard>
  );
}

type CustomerDetailContentProps = {
  customer: CustomerDetailView;
};

export function CustomerDetailContent({ customer }: CustomerDetailContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/customers"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Customers
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/customers/${customer.id}/edit`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit Customer
          </Link>
          <Link
            href="/jobs/new"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            New Job
          </Link>
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
            <h2 className="text-lg font-semibold text-slate-900">
              {customer.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={customer.type} variant={customer.typeVariant} />
              <StatusBadge
                label={customer.status}
                variant={customer.statusVariant}
              />
            </div>
          </div>

          <dl className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Primary Contact
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {customer.primaryContact}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Phone
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {customer.phone}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Email
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {customer.email}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard title="Customer Information">
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Customer Name" value={customer.name} />
              <DetailField label="Customer Type" value={customer.type} />
              <DetailField label="Status" value={customer.status} />
              <DetailField
                label="Primary Contact Name"
                value={customer.primaryContact}
              />
              <DetailField label="Phone" value={customer.phone} />
              <DetailField label="Email" value={customer.email} />
              <DetailField
                label="Billing Address"
                value={customer.billingAddress}
              />
              <DetailField label="Notes" value={customer.notes} />
              <DetailField label="Created Date" value={customer.createdAt} />
              <DetailField label="Updated Date" value={customer.updatedAt} />
            </dl>
          </SectionCard>

          <SectionCard title="Related Jobs" noPadding>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Job Number</th>
                    <th className="px-3 py-2.5 font-semibold">Project Name</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.relatedJobs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No related jobs yet.
                      </td>
                    </tr>
                  ) : (
                    customer.relatedJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/jobs/${job.id}/edit`}
                            className="font-medium text-slate-900 hover:text-slate-700"
                          >
                            {job.jobNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {job.projectName}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            label={job.status}
                            variant={job.statusVariant}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {job.lastActivity}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Related Quotes" noPadding>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Quote Number</th>
                    <th className="px-3 py-2.5 font-semibold">Project Name</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Total</th>
                    <th className="px-3 py-2.5 font-semibold">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.relatedQuotes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No related quotes yet.
                      </td>
                    </tr>
                  ) : (
                    customer.relatedQuotes.map((quote) => (
                      <tr key={quote.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/quotes/${quote.id}`}
                            className="font-medium text-slate-900 hover:text-slate-700"
                          >
                            {quote.quoteNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {quote.projectName}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
          <SectionCard title="Related Delivery Tickets" noPadding>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Ticket</th>
                    <th className="px-3 py-2.5 font-semibold">Project</th>
                    <th className="px-3 py-2.5 font-semibold">Delivery Date</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.relatedDeliveryTickets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No delivery tickets yet.
                      </td>
                    </tr>
                  ) : (
                    customer.relatedDeliveryTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/delivery-tickets/${ticket.id}`}
                            className="font-medium text-slate-900 hover:text-slate-700"
                          >
                            {ticket.ticketNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {ticket.projectName}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {ticket.deliveryDate}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge label={ticket.statusLabel} variant="info" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <PlaceholderCard
            title="Jobs"
            description={
              customer.relatedJobs.length > 0
                ? `${customer.relatedJobs.length} job${customer.relatedJobs.length === 1 ? "" : "s"} linked to this customer.`
                : "Job history and quick actions coming soon."
            }
          />
          <PlaceholderCard
            title="Quotes"
            description={
              customer.relatedQuotes.length > 0
                ? `${customer.relatedQuotes.length} quote${customer.relatedQuotes.length === 1 ? "" : "s"} linked to this customer.`
                : "Quote history and quick actions coming soon."
            }
          />
          <PlaceholderCard
            title="Invoices"
            description="Customer invoices will appear here."
          />
          <PlaceholderCard
            title="Delivery Tickets"
            description={
              customer.relatedDeliveryTickets.length > 0
                ? `${customer.relatedDeliveryTickets.length} ticket${customer.relatedDeliveryTickets.length === 1 ? "" : "s"} on record.`
                : "Delivery tickets for this customer will appear here."
            }
          />
          <SectionCard title="Files">
            {customer.relatedJobs.length === 0 ? (
              <p className="text-xs text-slate-500">
                No jobs linked to this customer yet.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {customer.relatedJobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{job.jobNumber}</span>
                    <span className="text-slate-600">{job.projectName}</span>
                    <Link
                      href={`/files/jobs/${job.id}`}
                      className="text-slate-700 underline hover:text-slate-900"
                    >
                      Files
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/files?q=${encodeURIComponent(customer.name)}`}
              className="mt-3 inline-block text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Search all files for this customer →
            </Link>
          </SectionCard>
          <PlaceholderCard
            title="Activity"
            description="Recent account activity will appear here."
          />
        </aside>
      </div>
    </div>
  );
}
