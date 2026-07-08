import Link from "next/link";
import { CustomerContactsPanel } from "@/components/customers/customer-contacts-panel";
import { CollapsibleSectionCard } from "@/components/dashboard/collapsible-section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import type { CustomerDetailView } from "@/components/customers/customer-utils";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

function StatTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex-1 border-r border-slate-100 px-4 py-2 last:border-r-0 hover:bg-slate-50"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
    </Link>
  );
}

function sectionCount(open: number, openLabel: string, total: number) {
  return (
    <span className="text-xs font-normal text-slate-500">
      {open} {openLabel} · {total} total
    </span>
  );
}

type CustomerDetailContentProps = {
  customer: CustomerDetailView;
};

export function CustomerDetailContent({ customer }: CustomerDetailContentProps) {
  const contextParts = [
    customer.address !== "—" ? customer.address : null,
    [
      customer.town !== "—" ? customer.town : null,
      customer.state !== "—" ? customer.state : null,
      customer.zip !== "—" ? customer.zip : null,
    ]
      .filter(Boolean)
      .join(", ") || null,
    customer.phone !== "—" ? `Office ${customer.phone}` : null,
    `Customer since ${customer.createdAt}`,
  ].filter(Boolean);

  const search = encodeURIComponent(customer.name);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <Link
            href="/customers"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Customers
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/customers/${customer.id}/edit`}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
            >
              Edit Customer
            </Link>
            <details className="group relative">
              <summary className="cursor-pointer list-none rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                Actions ▾
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <Link
                  href="/jobs/new"
                  className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  New Job
                </Link>
                <Link
                  href="/quotes/new"
                  className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  New Quote
                </Link>
                <Link
                  href={`/files?q=${search}`}
                  className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Search Files
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <div className="px-3 py-1.5">
                  <DeleteCustomerButton
                    customerId={customer.id}
                    customerName={customer.name}
                  />
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="px-4 pt-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              {customer.name}
            </h2>
            <StatusBadge
              label={customer.status}
              variant={customer.statusVariant}
            />
          </div>
          <p className="mt-1 pb-3 text-xs text-slate-500">
            {contextParts.join(" · ")}
          </p>
          {customer.notes !== "—" ? (
            <p className="-mt-1 pb-3 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Notes:</span>{" "}
              {customer.notes}
            </p>
          ) : null}
        </div>

        <div className="flex divide-slate-100 border-t border-slate-100">
          <StatTile
            label="Open Jobs"
            value={String(customer.stats.openJobs)}
            href={`/jobs?q=${search}`}
          />
          <StatTile
            label="Open Quotes"
            value={String(customer.stats.openQuotes)}
            href={`/quotes?q=${search}`}
          />
          <StatTile
            label="Unpaid Invoices"
            value={customer.stats.unpaidTotal}
            href={`/invoices?q=${search}`}
          />
          <StatTile
            label="Last Activity"
            value={customer.updatedAt}
            href={`/jobs?q=${search}`}
          />
        </div>
      </section>

      <CustomerContactsPanel
        customerId={customer.id}
        contacts={customer.contacts}
      />

      <CollapsibleSectionCard
        title="Jobs"
        summaryExtra={sectionCount(
          customer.stats.openJobs,
          "open",
          customer.stats.totalJobs,
        )}
        defaultOpen={customer.stats.openJobs > 0}
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Job Number</th>
                <th className={tableHeaderCellClassName}>Project Name</th>
                <th className={tableHeaderCellClassName}>Status</th>
                <th className={tableHeaderCellClassName}>Last Activity</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {customer.relatedJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}
                  >
                    No related jobs yet.
                  </td>
                </tr>
              ) : (
                customer.relatedJobs.map((job) => (
                  <tr key={job.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium text-slate-900 hover:text-slate-700"
                      >
                        {job.jobNumber}
                      </Link>
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {job.projectName}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge
                        label={job.status}
                        variant={job.statusVariant}
                      />
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {job.lastActivity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title="Quotes"
        summaryExtra={sectionCount(
          customer.stats.openQuotes,
          "open",
          customer.stats.totalQuotes,
        )}
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Quote Number</th>
                <th className={tableHeaderCellClassName}>Project Name</th>
                <th className={tableHeaderCellClassName}>Status</th>
                <th className={tableHeaderCellClassName}>Total</th>
                <th className={tableHeaderCellClassName}>Last Updated</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {customer.relatedQuotes.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}
                  >
                    No related quotes yet.
                  </td>
                </tr>
              ) : (
                customer.relatedQuotes.map((quote) => (
                  <tr key={quote.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="font-medium text-slate-900 hover:text-slate-700"
                      >
                        {quote.quoteNumber}
                      </Link>
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {quote.projectName}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title="Delivery Tickets"
        summaryExtra={sectionCount(
          customer.stats.scheduledTickets,
          "scheduled",
          customer.stats.totalTickets,
        )}
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Ticket</th>
                <th className={tableHeaderCellClassName}>Project</th>
                <th className={tableHeaderCellClassName}>Delivery Date</th>
                <th className={tableHeaderCellClassName}>Status</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {customer.relatedDeliveryTickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}
                  >
                    No delivery tickets yet.
                  </td>
                </tr>
              ) : (
                customer.relatedDeliveryTickets.map((ticket) => (
                  <tr key={ticket.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link
                        href={`/delivery-tickets/${ticket.id}`}
                        className="font-medium text-slate-900 hover:text-slate-700"
                      >
                        {ticket.ticketNumber}
                      </Link>
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {ticket.projectName}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {ticket.deliveryDate}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge label={ticket.statusLabel} variant="info" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title="Invoices"
        summaryExtra={sectionCount(
          customer.stats.unpaidInvoices,
          "unpaid",
          customer.stats.totalInvoices,
        )}
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Invoice</th>
                <th className={tableHeaderCellClassName}>Status</th>
                <th className={tableHeaderCellClassName}>Total</th>
                <th className={tableHeaderCellClassName}>Invoice Date</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {customer.relatedInvoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}
                  >
                    No invoices for this customer yet.
                  </td>
                </tr>
              ) : (
                customer.relatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-slate-900 hover:text-slate-700"
                      >
                        {invoice.invoiceNumber}
                      </Link>
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
      </CollapsibleSectionCard>
    </div>
  );
}
