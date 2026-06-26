"use client";

import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  deliveryTicketCustomerOptions,
  deliveryTicketDriverOptions,
  deliveryTicketInputClassName,
  deliveryTicketJobOptions,
  deliveryTicketReadOnlyClassName,
  deliveryTicketStatusFormOptions,
  deliveryTicketTrailerOptions,
  deliveryTicketTruckOptions,
  deliveryTicketWorkflowSteps,
  placeholderDeliveryTicketFormItems,
  placeholderDeliveryTicketFormSummary,
} from "@/components/delivery-tickets/delivery-ticket-utils";

const disabledButtonClassName =
  "rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400";

const primaryDisabledButtonClassName =
  "rounded-lg bg-slate-300 px-4 py-2 text-xs font-semibold text-white";

export function DeliveryTicketForm() {
  const summary = placeholderDeliveryTicketFormSummary;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <SectionCard title="Ticket Information">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Ticket Number
              </label>
              <input
                readOnly
                value="Auto assigned after saving"
                className={deliveryTicketReadOnlyClassName}
              />
            </div>
            <div>
              <label
                htmlFor="status"
                className="block text-xs font-medium text-slate-700"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="DRAFT"
                className={deliveryTicketInputClassName}
              >
                {deliveryTicketStatusFormOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="deliveryDate"
                className="block text-xs font-medium text-slate-700"
              >
                Delivery Date
              </label>
              <input
                id="deliveryDate"
                name="deliveryDate"
                type="date"
                defaultValue="2026-02-20"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="deliveryTime"
                className="block text-xs font-medium text-slate-700"
              >
                Delivery Time
              </label>
              <input
                id="deliveryTime"
                name="deliveryTime"
                type="time"
                defaultValue="07:00"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="requestedBy"
                className="block text-xs font-medium text-slate-700"
              >
                Requested By
              </label>
              <input
                id="requestedBy"
                name="requestedBy"
                type="text"
                defaultValue="Nick"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="createdBy"
                className="block text-xs font-medium text-slate-700"
              >
                Created By
              </label>
              <input
                id="createdBy"
                name="createdBy"
                type="text"
                defaultValue="Nick"
                className={deliveryTicketInputClassName}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Job and Customer">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="jobId"
                className="block text-xs font-medium text-slate-700"
              >
                Job
              </label>
              <select
                id="jobId"
                name="jobId"
                defaultValue="26-001"
                className={deliveryTicketInputClassName}
              >
                {deliveryTicketJobOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="customerId"
                className="block text-xs font-medium text-slate-700"
              >
                Customer
              </label>
              <select
                id="customerId"
                name="customerId"
                defaultValue="abc"
                className={deliveryTicketInputClassName}
              >
                {deliveryTicketCustomerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="projectName"
                className="block text-xs font-medium text-slate-700"
              >
                Project Name
              </label>
              <input
                id="projectName"
                name="projectName"
                type="text"
                defaultValue="Main Street Drainage"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="deliveryAddress"
                className="block text-xs font-medium text-slate-700"
              >
                Delivery Address
              </label>
              <input
                id="deliveryAddress"
                name="deliveryAddress"
                type="text"
                defaultValue="120 Main Street, Riverhead, NY 11901"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="siteContactName"
                className="block text-xs font-medium text-slate-700"
              >
                Site Contact Name
              </label>
              <input
                id="siteContactName"
                name="siteContactName"
                type="text"
                defaultValue="John Smith"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="siteContactPhone"
                className="block text-xs font-medium text-slate-700"
              >
                Site Contact Phone
              </label>
              <input
                id="siteContactPhone"
                name="siteContactPhone"
                type="tel"
                defaultValue="(631) 555-0142"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="siteContactEmail"
                className="block text-xs font-medium text-slate-700"
              >
                Site Contact Email
              </label>
              <input
                id="siteContactEmail"
                name="siteContactEmail"
                type="email"
                defaultValue="john.smith@abcconstruction.com"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="siteInstructions"
                className="block text-xs font-medium text-slate-700"
              >
                Site Instructions
              </label>
              <textarea
                id="siteInstructions"
                name="siteInstructions"
                rows={3}
                defaultValue="Enter from south gate. Crane access required on east side of site."
                className={deliveryTicketInputClassName}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Truck and Driver">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="truckId"
                className="block text-xs font-medium text-slate-700"
              >
                Truck
              </label>
              <select
                id="truckId"
                name="truckId"
                defaultValue="truck-3"
                className={deliveryTicketInputClassName}
              >
                {deliveryTicketTruckOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="driverId"
                className="block text-xs font-medium text-slate-700"
              >
                Driver
              </label>
              <select
                id="driverId"
                name="driverId"
                defaultValue="mike"
                className={deliveryTicketInputClassName}
              >
                {deliveryTicketDriverOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="trailerId"
                className="block text-xs font-medium text-slate-700"
              >
                Trailer
              </label>
              <select
                id="trailerId"
                name="trailerId"
                defaultValue="flatbed"
                className={deliveryTicketInputClassName}
              >
                {deliveryTicketTrailerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="loadSequence"
                className="block text-xs font-medium text-slate-700"
              >
                Load Sequence
              </label>
              <input
                id="loadSequence"
                name="loadSequence"
                type="text"
                defaultValue="1. Catch basins, 2. Manhole, 3. Valve vault"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div className="lg:col-span-2">
              <label
                htmlFor="specialEquipment"
                className="block text-xs font-medium text-slate-700"
              >
                Special Equipment Needed
              </label>
              <input
                id="specialEquipment"
                name="specialEquipment"
                type="text"
                defaultValue="Chains, rigging straps, blocking"
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="craneRequired"
                className="block text-xs font-medium text-slate-700"
              >
                Crane Required
              </label>
              <select
                id="craneRequired"
                name="craneRequired"
                defaultValue="yes"
                className={deliveryTicketInputClassName}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="forkliftRequired"
                className="block text-xs font-medium text-slate-700"
              >
                Forklift Required
              </label>
              <select
                id="forkliftRequired"
                name="forkliftRequired"
                defaultValue="no"
                className={deliveryTicketInputClassName}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Delivery Items"
          description="Products and structures scheduled for this delivery."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled className={disabledButtonClassName}>
                Add Stock Product
              </button>
              <button type="button" disabled className={disabledButtonClassName}>
                Add Configurable Structure
              </button>
              <button type="button" disabled className={disabledButtonClassName}>
                Add Custom Structure
              </button>
              <button type="button" disabled className={disabledButtonClassName}>
                Add Misc Item
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Line #</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Item/Structure</th>
                    <th className="px-3 py-2.5 font-semibold">Description</th>
                    <th className="px-3 py-2.5 font-semibold">Qty</th>
                    <th className="px-3 py-2.5 font-semibold">Unit</th>
                    <th className="px-3 py-2.5 font-semibold">Weight Each</th>
                    <th className="px-3 py-2.5 font-semibold">Total Weight</th>
                    <th className="px-3 py-2.5 font-semibold">Yard Location</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {placeholderDeliveryTicketFormItems.map((line) => (
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
                      <td className="px-3 py-2.5 text-slate-700">
                        <RichTextContent value={line.description} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{line.qty}</td>
                      <td className="px-3 py-2.5 text-slate-700">{line.unit}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {line.weightEach}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {line.totalWeight}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {line.yardLocation}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          label={line.status}
                          variant={line.statusVariant}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled
                            className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled
                            className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Notes">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="driverNotes"
                className="block text-xs font-medium text-slate-700"
              >
                Driver Notes
              </label>
              <textarea
                id="driverNotes"
                name="driverNotes"
                rows={3}
                defaultValue="Unload manhole last. Call site contact 30 minutes before arrival."
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="internalNotes"
                className="block text-xs font-medium text-slate-700"
              >
                Internal Notes
              </label>
              <textarea
                id="internalNotes"
                name="internalNotes"
                rows={3}
                defaultValue="Confirm crane availability before scheduling."
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="customerNotes"
                className="block text-xs font-medium text-slate-700"
              >
                Customer Notes
              </label>
              <textarea
                id="customerNotes"
                name="customerNotes"
                rows={3}
                defaultValue="Please deliver before 9:00 AM."
                className={deliveryTicketInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="loadingNotes"
                className="block text-xs font-medium text-slate-700"
              >
                Loading Notes
              </label>
              <textarea
                id="loadingNotes"
                name="loadingNotes"
                rows={3}
                defaultValue="Load catch basins first. Secure valve vault with extra straps."
                className={deliveryTicketInputClassName}
              />
            </div>
          </div>
        </SectionCard>

        <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <button type="button" disabled className={disabledButtonClassName}>
            Save Draft
          </button>
          <button type="button" disabled className={disabledButtonClassName}>
            Schedule Delivery
          </button>
          <Link
            href="/delivery-tickets"
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </div>

      <aside className="space-y-4">
        <SectionCard title="Delivery Summary">
          <dl className="space-y-3 text-xs">
            {[
              ["Total Items", summary.totalItems],
              ["Total Weight", summary.totalWeight],
              ["Truck Capacity", summary.truckCapacity],
              ["Delivery Date", summary.deliveryDate],
              ["Status", summary.status],
              ["Job Number", summary.jobNumber],
              ["Customer", summary.customer],
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

        <SectionCard title="Workflow">
          <ul className="space-y-2">
            {deliveryTicketWorkflowSteps.map((step) => (
              <li
                key={step.id}
                className="flex items-center gap-2 text-xs text-slate-700"
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 rounded-full border ${
                    step.complete
                      ? "border-emerald-300 bg-emerald-500"
                      : "border-slate-200 bg-white"
                  }`}
                  aria-hidden="true"
                />
                {step.label}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Quick Actions">
          <div className="flex flex-col gap-2">
            <button type="button" disabled className={primaryDisabledButtonClassName}>
              Save Draft
            </button>
            <button type="button" disabled className={disabledButtonClassName}>
              Schedule Delivery
            </button>
            <button type="button" disabled className={disabledButtonClassName}>
              Preview Ticket
            </button>
            <button type="button" disabled className={disabledButtonClassName}>
              Print Ticket
            </button>
            <Link
              href="/delivery-tickets"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </SectionCard>
      </aside>
    </div>
  );
}
