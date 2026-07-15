import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TicketOperationsPanel } from "@/components/delivery-tickets/ticket-operations-panel";
import { TicketPdfButton } from "@/components/delivery-tickets/ticket-pdf-button";
import { TicketStatusActions } from "@/components/delivery-tickets/ticket-status-actions";
import { TicketSubmittalButton } from "@/components/delivery-tickets/ticket-submittal-button";
import { RichTextContent } from "@/components/ui/rich-text-content";
import type { DeliveryTicketDetailView } from "@/components/delivery-tickets/delivery-ticket-utils";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "" || value.trim() === "—";
}

/** Labeled field that simply doesn't render when the value is empty. */
function OptionalField({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string | null;
}) {
  if (isBlank(value)) {
    return null;
  }
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">
        {href ? (
          <Link href={href} className="font-medium text-sky-700 hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function StatItem({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-slate-900">
        {value}
        {detail && !isBlank(detail) ? (
          <span className="ml-1.5 text-xs font-normal text-slate-500">
            {detail}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const RELATED_PLACEHOLDERS = new Set(["—", "Not created", "None", "Not uploaded"]);

function RelatedRecordRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string | null;
}) {
  // Placeholder rows without a destination are noise, not information.
  if (!href && RELATED_PLACEHOLDERS.has(value)) {
    return null;
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">
        {href ? (
          <Link href={href} className="text-sky-700 hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

type PickupInfo = {
  fulfillmentMethod: "DELIVERY" | "PICKUP";
  paymentMethod: "PAY_NOW" | "ON_ACCOUNT" | null;
  paymentReceived: boolean;
  pickedUpBy: string | null;
};

type DeliveryTicketDetailContentProps = {
  ticket: DeliveryTicketDetailView;
  ticketId?: string;
  ticketStatus?: string;
  hasInvoice?: boolean;
  invoiceId?: string | null;
  pickupInfo?: PickupInfo | null;
  canManageInvoices?: boolean;
};

function paymentMethodLabel(method: PickupInfo["paymentMethod"]): string {
  if (method === "PAY_NOW") return "Pay now";
  if (method === "ON_ACCOUNT") return "Charge to account";
  return "Not specified";
}

function formatLineType(value: string): string {
  return value.replace(/_/g, " ");
}

export function DeliveryTicketDetailContent({
  ticket,
  ticketId,
  ticketStatus,
  hasInvoice = false,
  invoiceId = null,
  pickupInfo = null,
  canManageInvoices = false,
}: DeliveryTicketDetailContentProps) {
  const isPickup = pickupInfo?.fulfillmentMethod === "PICKUP";

  const noteEntries = [
    ["Driver Notes", ticket.driverNotes],
    ["Internal Notes", ticket.internalNotes],
    ["Customer Notes", ticket.customerNotes],
    ["Loading Notes", ticket.loadingNotes],
    ["Site Instructions", ticket.siteInstructions],
  ].filter(([, value]) => !isBlank(value));

  const equipmentBadges = [
    ticket.craneRequired === "Yes" ? "Crane required" : null,
    ticket.forkliftRequired === "Yes" ? "Forklift required" : null,
  ].filter((badge): badge is string => Boolean(badge));

  const jobLine = !isBlank(ticket.jobNumber)
    ? `${ticket.jobNumber} — ${ticket.projectName}`
    : ticket.projectName;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/delivery-tickets"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Delivery Hub
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link
            href={ticketId ? `/delivery-tickets/${ticketId}/edit` : "#"}
            className={`rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold ${ticketId ? "text-slate-700 hover:bg-slate-50" : "pointer-events-none text-slate-400"}`}
          >
            Edit Ticket
          </Link>
          {ticketId ? (
            <>
              <Link
                href={`/delivery-tickets/${ticketId}/preview`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Preview/Print
              </Link>
              <TicketPdfButton ticketId={ticketId} />
              <TicketSubmittalButton ticketId={ticketId} />
            </>
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
              {canManageInvoices ? (
                <TicketOperationsPanel
                  ticketId={ticketId}
                  status={ticketStatus}
                  hasInvoice={hasInvoice}
                />
              ) : null}
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <StatusBadge label={ticket.statusLabel} variant={ticket.statusVariant} />
        <StatItem
          label={isPickup ? "Pickup" : "Delivery"}
          value={ticket.deliveryDate}
          detail={ticket.deliveryTime}
        />
        <StatItem
          label="Driver"
          value={isBlank(ticket.driver) ? "—" : ticket.driver}
        />
        <StatItem
          label="Trailer"
          value={isBlank(ticket.trailer) ? "—" : ticket.trailer}
        />
        <StatItem
          label="Load"
          value={ticket.totalWeight}
          detail={`${ticket.summary.totalItems} item${ticket.summary.totalItems === "1" ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard title="Details">
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <OptionalField
                label="Customer"
                value={ticket.customer}
                href={ticket.relatedRecords.customerHref}
              />
              <OptionalField
                label={!isBlank(ticket.jobNumber) ? "Job" : "Project"}
                value={jobLine}
                href={ticket.relatedRecords.jobHref}
              />
              <OptionalField
                label="Delivery Address"
                value={ticket.deliveryAddress}
              />
              <OptionalField
                label="Site Contact"
                value={
                  isBlank(ticket.siteContactName)
                    ? ticket.siteContactPhone
                    : isBlank(ticket.siteContactPhone)
                      ? ticket.siteContactName
                      : `${ticket.siteContactName} · ${ticket.siteContactPhone}`
                }
              />
              <OptionalField label="Requested By" value={ticket.requestedBy} />
              <OptionalField label="Created By" value={ticket.createdBy} />
              <OptionalField label="Load Sequence" value={ticket.loadSequence} />
              <OptionalField
                label="Special Equipment"
                value={ticket.specialEquipmentNeeded}
              />
            </dl>
            {equipmentBadges.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {equipmentBadges.map((badge) => (
                  <StatusBadge key={badge} label={badge} variant="warning" />
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Delivery Items" noPadding>
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Item/Structure</th>
                    <th className={tableHeaderCellClassName}>Description</th>
                    <th className={tableHeaderCellClassName}>Qty</th>
                    <th className={tableHeaderCellClassName}>Weight Each</th>
                    <th className={tableHeaderCellClassName}>Total Weight</th>
                    <th className={tableHeaderCellClassName}>Yard</th>
                    <th className={tableHeaderCellClassName}>Status</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {ticket.lineItems.map((line) => (
                    <tr key={line.id} className={tableRowClassName}>
                      <td className={`${tableCellClassName} align-top`}>
                        <div className="font-medium text-slate-900">
                          {line.item}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          {formatLineType(line.type)}
                        </div>
                      </td>
                      <td className={`${tableCellClassName} align-top text-slate-600`}>
                        <RichTextContent value={line.description} />
                        {!isBlank(line.notes) ? (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {line.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className={`${tableCellClassName} align-top whitespace-nowrap text-slate-600`}>
                        {line.qty} {line.unit}
                      </td>
                      <td className={`${tableCellClassName} align-top text-slate-600`}>
                        {line.weightEach}
                      </td>
                      <td className={`${tableCellClassName} align-top font-medium text-slate-900`}>
                        {line.totalWeight}
                      </td>
                      <td className={`${tableCellClassName} align-top text-slate-600`}>
                        {line.yardLocation}
                      </td>
                      <td className={`${tableCellClassName} align-top`}>
                        <StatusBadge
                          label={line.status}
                          variant={line.statusVariant}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50/80">
                  <tr>
                    <td
                      colSpan={2}
                      className={`${tableCellClassName} text-right font-medium text-slate-700`}
                    >
                      Total
                    </td>
                    <td className={`${tableCellClassName} whitespace-nowrap text-slate-700`}>
                      {ticket.summary.totalItems} item
                      {ticket.summary.totalItems === "1" ? "" : "s"}
                    </td>
                    <td className={tableCellClassName} />
                    <td className={`${tableCellClassName} font-semibold text-slate-900`}>
                      {ticket.summary.totalWeight}
                    </td>
                    <td colSpan={2} className={tableCellClassName} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>

          {noteEntries.length > 0 ? (
            <SectionCard title="Notes">
              <dl className="grid gap-5">
                {noteEntries.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          ) : null}
        </div>

        <aside className="space-y-4">
          {isPickup && pickupInfo ? (
            <SectionCard title="Pickup & Payment">
              <dl className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Fulfillment</dt>
                  <dd className="font-medium text-slate-900">
                    Customer pickup
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Payment</dt>
                  <dd className="font-medium text-slate-900">
                    {paymentMethodLabel(pickupInfo.paymentMethod)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Payment received</dt>
                  <dd>
                    <StatusBadge
                      label={pickupInfo.paymentReceived ? "Paid" : "Unpaid"}
                      variant={
                        pickupInfo.paymentReceived ? "success" : "warning"
                      }
                    />
                  </dd>
                </div>
                {pickupInfo.pickedUpBy ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Picked up by</dt>
                    <dd className="font-medium text-slate-900">
                      {pickupInfo.pickedUpBy}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </SectionCard>
          ) : null}

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
