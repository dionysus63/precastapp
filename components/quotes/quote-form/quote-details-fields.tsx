"use client";

import Link from "next/link";
import { searchJobsForQuoteForm } from "@/app/quotes/actions";
import { suggestShippingAddresses } from "@/app/shipping/actions";
import { AddressAutocomplete } from "@/components/shipping/address-autocomplete";
import type { AddressSuggestion } from "@/lib/shipping/geocode";
import { QuoteFormTypeahead } from "@/components/quotes/quote-form-typeahead";
import {
  type QuoteFormCustomerOption,
  type QuoteFormJobOption,
  type QuoteFormPriceListOption,
  type QuoteStatus,
  type QuoteType,
  formatQuoteCurrency,
  quoteCompactInputClassName,
  quoteStatusFormOptions,
  quoteTypeFormOptions,
} from "@/components/quotes/quote-utils";
import type {
  ShippingHint,
  ShippingStatus,
} from "@/components/quotes/quote-form/quote-form-utils";

/** "Quote" block of the Quote Details card: status, type, estimator, dates. */
export function QuoteMetaFields({
  isEditing,
  status,
  onStatusChange,
  quoteType,
  onQuoteTypeChange,
  estimator,
  onEstimatorChange,
  estimatorOptions,
  bidDueDate,
  onBidDueDateChange,
  quoteDate,
  onQuoteDateChange,
  expirationDate,
  onExpirationDateChange,
}: {
  isEditing: boolean;
  status: QuoteStatus;
  onStatusChange: (value: QuoteStatus) => void;
  quoteType: QuoteType;
  onQuoteTypeChange: (value: QuoteType) => void;
  estimator: string;
  onEstimatorChange: (value: string) => void;
  estimatorOptions: string[];
  bidDueDate: string;
  onBidDueDateChange: (value: string) => void;
  quoteDate: string;
  onQuoteDateChange: (value: string) => void;
  expirationDate: string;
  onExpirationDateChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Quote
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Quote Number
          </label>
          <input
            readOnly
            value="Auto assigned after saving"
            className="block w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 shadow-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Revision
          </label>
          <input
            readOnly
            value="R0"
            className="block w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 shadow-sm"
          />
        </div>
        <div>
          <label
            htmlFor="status"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Quote Status
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as QuoteStatus)
            }
            className={quoteCompactInputClassName}
          >
            {quoteStatusFormOptions
              .filter((option) => isEditing || option.value !== "WON")
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="quoteType"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Quote Type
          </label>
          <select
            id="quoteType"
            name="quoteType"
            value={quoteType}
            onChange={(event) =>
              onQuoteTypeChange(event.target.value as QuoteType)
            }
            className={quoteCompactInputClassName}
          >
            {quoteTypeFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="estimator"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Estimator
          </label>
          <select
            id="estimator"
            name="estimator"
            value={estimator}
            onChange={(event) => onEstimatorChange(event.target.value)}
            className={quoteCompactInputClassName}
          >
            {estimatorOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="bidDueDate"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Bid Due Date
          </label>
          <input
            id="bidDueDate"
            name="bidDueDate"
            type="date"
            value={bidDueDate}
            onChange={(event) => onBidDueDateChange(event.target.value)}
            className={quoteCompactInputClassName}
          />
        </div>
        <div>
          <label
            htmlFor="quoteDate"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Quote Date
          </label>
          <input
            id="quoteDate"
            name="quoteDate"
            type="date"
            value={quoteDate}
            onChange={(event) => onQuoteDateChange(event.target.value)}
            className={quoteCompactInputClassName}
          />
        </div>
        <div>
          <label
            htmlFor="expirationDate"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Expiration Date
          </label>
          <input
            id="expirationDate"
            name="expirationDate"
            type="date"
            value={expirationDate}
            onChange={(event) =>
              onExpirationDateChange(event.target.value)
            }
            className={quoteCompactInputClassName}
          />
        </div>
      </div>
    </div>
  );
}

type ContactOverride = {
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
};

/**
 * "Job & Contact" block of the Quote Details card: job typeahead, project
 * address with the shipping-zone hint, and the contact picker + fields.
 */
export function QuoteJobContactFields({
  jobId,
  selectedJobLabel,
  jobNumber,
  projectName,
  initialJob,
  onJobSelect,
  projectAddress,
  onProjectAddressChange,
  onAddressSuggestionSelect,
  onAddressSettled,
  shippingStatus,
  shippingHint,
  customerId,
  selectedCustomer,
  contactId,
  onContactPickerChange,
  clearContactLinkIfCustomized,
  contactName,
  onContactNameChange,
  contactEmail,
  onContactEmailChange,
  contactPhone,
  onContactPhoneChange,
  contactTitle,
  onContactTitleChange,
}: {
  jobId: string;
  selectedJobLabel: string;
  jobNumber: string;
  projectName: string;
  initialJob: QuoteFormJobOption | null;
  onJobSelect: (job: QuoteFormJobOption | null) => void;
  projectAddress: string;
  onProjectAddressChange: (value: string) => void;
  onAddressSuggestionSelect: (suggestion: AddressSuggestion) => void;
  onAddressSettled: () => void;
  shippingStatus: ShippingStatus;
  shippingHint: ShippingHint | null;
  customerId: string;
  selectedCustomer: QuoteFormCustomerOption | null;
  contactId: string;
  onContactPickerChange: (value: string) => void;
  clearContactLinkIfCustomized: (
    next: ContactOverride,
    linkedContactId: string,
  ) => void;
  contactName: string;
  onContactNameChange: (value: string) => void;
  contactEmail: string;
  onContactEmailChange: (value: string) => void;
  contactPhone: string;
  onContactPhoneChange: (value: string) => void;
  contactTitle: string;
  onContactTitleChange: (value: string) => void;
}) {
  return (
    <div className="border-t border-slate-100 pt-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Job &amp; Contact
      </p>
      <div className="space-y-2">
        <div className="grid gap-2 lg:grid-cols-2">
          <div>
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <label
                htmlFor="job"
                className="text-[10px] font-medium uppercase tracking-wide text-slate-500"
              >
                Job
              </label>
              <Link
                href="/jobs/new"
                className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:underline"
              >
                Create New Job
              </Link>
            </div>
            <QuoteFormTypeahead
              inputId="job"
              selectedLabel={
                jobId
                  ? selectedJobLabel ||
                    [jobNumber, projectName]
                      .filter(Boolean)
                      .join(" - ")
                  : ""
              }
              placeholder="Search by job number, project, or customer"
              initialItems={initialJob ? [initialJob] : []}
              searchItems={searchJobsForQuoteForm}
              itemKey={(job) => job.id}
              itemLabel={(job) => job.label}
              onSelect={onJobSelect}
              clearLabel="No linked job"
              emptyLabel="No jobs match."
              inputClassName={quoteCompactInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="projectAddress"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Project Address
            </label>
            <AddressAutocomplete
              inputId="projectAddress"
              value={projectAddress}
              onChangeText={onProjectAddressChange}
              onSelectSuggestion={onAddressSuggestionSelect}
              onSettled={onAddressSettled}
              suggest={suggestShippingAddresses}
              placeholder="120 Main Street, Riverhead, NY"
              inputClassName={quoteCompactInputClassName}
            />
            {shippingStatus !== "idle" ? (
              <p className="mt-1 text-[11px]">
                {shippingStatus === "loading" ? (
                  <span className="text-slate-400">
                    Checking shipping zone…
                  </span>
                ) : shippingStatus === "matched" && shippingHint ? (
                  <span className="font-medium text-slate-600">
                    <span
                      className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                      style={{
                        backgroundColor: shippingHint.color,
                      }}
                    />
                    {shippingHint.zoneName} —{" "}
                    {formatQuoteCurrency(shippingHint.ratePerLoad)}
                    /load
                    {shippingHint.distanceMiles !== null
                      ? ` (${shippingHint.distanceMiles.toFixed(0)} mi)`
                      : ""}
                  </span>
                ) : shippingStatus === "outside" ? (
                  <span className="text-amber-600">
                    Outside shipping zones — price delivery manually
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Shipping zone lookup unavailable
                  </span>
                )}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label
            htmlFor="quoteContactPicker"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Contact
          </label>
          <select
            id="quoteContactPicker"
            value={contactId}
            onChange={(event) =>
              onContactPickerChange(event.target.value)
            }
            disabled={!customerId}
            className={quoteCompactInputClassName}
          >
            <option value="">
              {customerId
                ? "Custom / enter manually"
                : "Select a customer first"}
            </option>
            {selectedCustomer?.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
                {contact.title ? ` — ${contact.title}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="contactName"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Contact Name
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              value={contactName}
              onChange={(event) => {
                const value = event.target.value;
                clearContactLinkIfCustomized({ name: value }, contactId);
                onContactNameChange(value);
              }}
              className={quoteCompactInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="contactEmail"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Contact Email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(event) => {
                const value = event.target.value;
                clearContactLinkIfCustomized(
                  { email: value },
                  contactId,
                );
                onContactEmailChange(value);
              }}
              className={quoteCompactInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="contactPhone"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Contact Phone
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(event) => {
                const value = event.target.value;
                clearContactLinkIfCustomized(
                  { phone: value },
                  contactId,
                );
                onContactPhoneChange(value);
              }}
              className={quoteCompactInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="contactTitle"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Contact Role
            </label>
            <input
              id="contactTitle"
              name="contactTitle"
              type="text"
              value={contactTitle}
              onChange={(event) => {
                const value = event.target.value;
                clearContactLinkIfCustomized(
                  { title: value },
                  contactId,
                );
                onContactTitleChange(value);
              }}
              placeholder="Estimator, PM, etc."
              className={quoteCompactInputClassName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Pricing" block of the Quote Details card: price list, tax rate, PO. */
export function QuotePricingFields({
  priceLists,
  priceListId,
  onPriceListChange,
  taxRate,
  onTaxRateChange,
  customerPo,
  onCustomerPoChange,
}: {
  priceLists: QuoteFormPriceListOption[];
  priceListId: string;
  onPriceListChange: (value: string) => void;
  taxRate: string;
  onTaxRateChange: (value: string) => void;
  customerPo: string;
  onCustomerPoChange: (value: string) => void;
}) {
  return (
    <div className="border-t border-slate-100 pt-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Pricing
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label
            htmlFor="priceList"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Price List
          </label>
          <select
            id="priceList"
            name="priceList"
            value={priceListId}
            onChange={(event) => onPriceListChange(event.target.value)}
            className={quoteCompactInputClassName}
            required
          >
            {priceLists.map((priceList) => (
              <option key={priceList.id} value={priceList.id}>
                {priceList.name}
                {priceList.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="taxRate"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Tax Rate
          </label>
          <input
            id="taxRate"
            name="taxRate"
            type="text"
            value={taxRate}
            onChange={(event) => onTaxRateChange(event.target.value)}
            className={quoteCompactInputClassName}
          />
        </div>
        <div>
          <label
            htmlFor="customerPo"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Customer PO
          </label>
          <input
            id="customerPo"
            name="customerPo"
            type="text"
            value={customerPo}
            onChange={(event) => onCustomerPoChange(event.target.value)}
            placeholder="Optional"
            className={quoteCompactInputClassName}
          />
        </div>
      </div>
    </div>
  );
}
