import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { TicketOperationsPanel } from "@/components/delivery-tickets/ticket-operations-panel";
import { TicketPdfButton } from "@/components/delivery-tickets/ticket-pdf-button";
import { TicketStatusActions } from "@/components/delivery-tickets/ticket-status-actions";
import type { DeliveryTicketDetailView } from "@/components/delivery-tickets/delivery-ticket-utils";

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

function RelatedRecordRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">
        {href ? (
          <Link href={href} className="hover:text-slate-700">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

type DeliveryTicketDetailContentProps = {
  ticket: DeliveryTicketDetailView;
  ticketId?: string;
  ticketStatus?: string;
  hasInvoice?: boolean;
  invoiceId?: string | null;
};

export function DeliveryTicketDetailContent({
  ticket,
  ticketId,
  ticketStatus,
  hasInvoice = false,
  invoiceId = null,
}: DeliveryTicketDetailContentProps) {
  const topSummaryCards = [
    {
      label: "Status",
      value: ticket.status,
      detail: ticket.statusLabel,
      accent: "amber" as const,
    },
    {
      label: "Delivery Date",
      value: ticket.deliveryDate,
      detail: ticket.deliveryTime,
      accent: "sky" as const,
    },
    {
      label: "Truck",
      value: ticket.truck,
      detail: ticket.trailer,
      accent: "emerald" as const,
    },
    {
      label: "Driver",
      value: ticket.driver,
      detail: "Assigned driver",
      accent: "sky" as const,
    },
    {
      label: "Total Weight",
      value: ticket.totalWeight,
      detail: `${ticket.summary.totalItems} items on ticket`,
      accent: "rose" as const,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/delivery-tickets"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Delivery Tickets
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link
            href={ticketId ? `/delivery-tickets/${ticketId}/edit` : "#"}
            className={`rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold ${ticketId ? "text-slate-700 hover:bg-slate-50" : "pointer-events-none text-slate-400"}`}
          >
            Edit Ticket
          </Link>
          {ticketId ? (
            <TicketPdfButton ticketId={ticketId} />
          ) : (
            <button
              type="button"
              disabled
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
            >
              Preview/Print
            </button>
          )}
          {ticketId && ticketStatus ? (
            <>
              <TicketStatusActions
                ticketId={ticketId}
                status={ticketStatus}
                hasInvoice={hasInvoice}
              />
              <TicketOperationsPanel
                ticketId={ticketId}
                status={ticketStatus}
                hasInvoice={hasInvoice}
              />
            </>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
            >
              Mark Delivered
            </button>
          )}
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
          <SectionCard title="Ticket Information">
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Ticket Number" value={ticket.ticketNumber} />
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={ticket.status}
                    variant={ticket.statusVariant}
                  />
                </dd>
              </div>
              <DetailField label="Delivery Date" value={ticket.deliveryDate} />
              <DetailField label="Delivery Time" value={ticket.deliveryTime} />
              <DetailField label="Job Number" value={ticket.jobNumber} />
              <DetailField label="Project Name" value={ticket.projectName} />
              <DetailField label="Customer" value={ticket.customer} />
              <DetailField
                label="Delivery Address"
                value={ticket.deliveryAddress}
              />
              <DetailField
                label="Site Contact Name"
                value={ticket.siteContactName}
              />
              <DetailField
                label="Site Contact Phone"
                value={ticket.siteContactPhone}
              />
              <DetailField label="Requested By" value={ticket.requestedBy} />
              <DetailField label="Created By" value={ticket.createdBy} />
            </dl>
          </SectionCard>

          <SectionCard title="Truck and Driver">
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Truck" value={ticket.truck} />
              <DetailField label="Trailer" value={ticket.trailer} />
              <DetailField label="Driver" value={ticket.driver} />
              <DetailField label="Load Sequence" value={ticket.loadSequence} />
              <DetailField label="Crane Required" value={ticket.craneRequired} />
              <DetailField
                label="Forklift Required"
                value={ticket.forkliftRequired}
              />
              <DetailField
                label="Special Equipment Needed"
                value={ticket.specialEquipmentNeeded}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Delivery Items" noPadding>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Line #</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">
                      Item/Structure
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Description</th>
                    <th className="px-3 py-2.5 font-semibold">Qty</th>
                    <th className="px-3 py-2.5 font-semibold">Unit</th>
                    <th className="px-3 py-2.5 font-semibold">Weight Each</th>
                    <th className="px-3 py-2.5 font-semibold">Total Weight</th>
                    <th className="px-3 py-2.5 font-semibold">Yard Location</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ticket.lineItems.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 text-slate-700">
                        {line.lineNumber}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">
                        {line.type}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {line.item}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {line.description}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{line.qty}</td>
                      <td className="px-3 py-2.5 text-slate-600">{line.unit}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {line.weightEach}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {line.totalWeight}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {line.yardLocation}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          label={line.status}
                          variant={line.statusVariant}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {line.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Notes">
            <dl className="grid gap-5">
              <DetailField label="Driver Notes" value={ticket.driverNotes} />
              <DetailField label="Internal Notes" value={ticket.internalNotes} />
              <DetailField label="Customer Notes" value={ticket.customerNotes} />
              <DetailField label="Loading Notes" value={ticket.loadingNotes} />
              <DetailField
                label="Site Instructions"
                value={ticket.siteInstructions}
              />
            </dl>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard title="Delivery Summary">
            <dl className="space-y-3 text-xs">
              {[
                ["Total Items", ticket.summary.totalItems],
                ["Total Weight", ticket.summary.totalWeight],
                ["Truck Capacity", ticket.summary.truckCapacity],
                ["Remaining Capacity", ticket.summary.remainingCapacity],
                ["Delivery Date", ticket.summary.deliveryDate],
                ["Status", ticket.summary.status],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd
                    className={`font-medium ${
                      label === "Total Weight" ? "text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Related Records">
            <dl className="space-y-3 text-xs">
              <RelatedRecordRow
                label="Job"
                value={ticket.relatedRecords.jobNumber}
                href={ticket.relatedRecords.jobHref}
              />
              <RelatedRecordRow
                label="Quote"
                value={ticket.relatedRecords.quoteNumber}
                href={ticket.relatedRecords.quoteHref}
              />
              <RelatedRecordRow
                label="Customer"
                value={ticket.relatedRecords.customer}
                href={ticket.relatedRecords.customerHref}
              />
              <RelatedRecordRow
                label="Invoice"
                value={ticket.relatedRecords.invoice}
                href={invoiceId ? `/invoices/${invoiceId}` : null}
              />
              <RelatedRecordRow
                label="Photos"
                value={ticket.relatedRecords.photos}
                href={null}
              />
              <RelatedRecordRow
                label="Signed Ticket"
                value={ticket.relatedRecords.signedTicket}
                href={null}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Workflow / Status History">
            <ul className="space-y-2">
              {ticket.statusHistory.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center gap-2 text-xs text-slate-700"
                >
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 rounded-full border ${
                      step.current
                        ? "border-amber-300 bg-amber-500"
                        : step.complete
                          ? "border-emerald-300 bg-emerald-500"
                          : "border-slate-200 bg-white"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={
                      step.current ? "font-semibold text-slate-900" : undefined
                    }
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
