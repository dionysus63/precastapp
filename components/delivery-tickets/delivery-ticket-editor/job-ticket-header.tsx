"use client";

import type { Dispatch, ReactNode, Ref, SetStateAction } from "react";
import { searchJobsForDeliveryTicket } from "@/app/delivery-tickets/actions";
import { FormTypeahead } from "@/components/common/form-typeahead";
import { compactInputClass, compactLabelClass } from "./editor-styles";
import { formatWeight } from "./editor-utils";
import type { JobOption } from "./types";

type JobTicketHeaderProps = {
  stickyRef: Ref<HTMLDivElement>;
  ticketTypeButtons: ReactNode;
  actionButtons: ReactNode;
  selectedLineCount: number;
  totalWeight: number;
  isPickup: boolean;
  loadCapacityLabel: string;
  selectedJob: JobOption | undefined;
  onJobChange: (nextJob: JobOption | null) => void;
  quoteId: string;
  onQuoteChange: (nextQuoteId: string) => void;
  hasQuote: boolean;
  fulfillmentMethod: "DELIVERY" | "PICKUP";
  setFulfillmentMethod: Dispatch<SetStateAction<"DELIVERY" | "PICKUP">>;
  deliveryDate: string;
  setDeliveryDate: Dispatch<SetStateAction<string>>;
  drivers: string[];
  driver: string;
  setDriver: Dispatch<SetStateAction<string>>;
  driverOther: string;
  setDriverOther: Dispatch<SetStateAction<string>>;
  trailers: string[];
  trailer: string;
  setTrailer: Dispatch<SetStateAction<string>>;
  trailerOther: string;
  setTrailerOther: Dispatch<SetStateAction<string>>;
  error: string | null;
  markDirty: () => void;
};

/** Sticky JOB-ticket bar: line count / weight, actions, job + quote pickers,
 * fulfillment method, date, driver and trailer. */
export function JobTicketHeader({
  stickyRef,
  ticketTypeButtons,
  actionButtons,
  selectedLineCount,
  totalWeight,
  isPickup,
  loadCapacityLabel,
  selectedJob,
  onJobChange,
  quoteId,
  onQuoteChange,
  hasQuote,
  fulfillmentMethod,
  setFulfillmentMethod,
  deliveryDate,
  setDeliveryDate,
  drivers,
  driver,
  setDriver,
  driverOther,
  setDriverOther,
  trailers,
  trailer,
  setTrailer,
  trailerOther,
  setTrailerOther,
  error,
  markDirty,
}: JobTicketHeaderProps) {
  return (
    <div
      ref={stickyRef}
      className={`sticky top-[74px] z-[9] border border-slate-300 bg-white/95 shadow-lg shadow-slate-900/5 backdrop-blur ${
        hasQuote ? "rounded-t-xl" : "rounded-xl"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-3">
          {ticketTypeButtons}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-900 px-2 py-0.5 font-semibold text-white">
              {selectedLineCount} {selectedLineCount === 1 ? "line" : "lines"}
            </span>
            <span>
              {totalWeight > 0
                ? formatWeight(totalWeight)
                : "No load weight yet"}
            </span>
            {!isPickup ? (
              <span className="text-slate-400">
                Capacity {loadCapacityLabel}
              </span>
            ) : null}
          </div>
        </div>
        {actionButtons}
      </div>

      <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 px-3 py-1.5">
        <div className="w-64 max-w-full min-w-0 shrink-0">
          <label htmlFor="deliveryJobId" className={compactLabelClass}>
            Job
          </label>
          <FormTypeahead<JobOption>
            inputId="deliveryJobId"
            selectedLabel={
              selectedJob
                ? `${selectedJob.jobNumber} - ${selectedJob.projectName}`
                : ""
            }
            placeholder="Search job number, project, or customer..."
            initialItems={selectedJob ? [selectedJob] : []}
            searchItems={searchJobsForDeliveryTicket}
            itemKey={(job) => job.id}
            itemLabel={(job) => `${job.jobNumber} - ${job.projectName}`}
            clearLabel="Clear job selection"
            onSelect={onJobChange}
            inputClassName={`${compactInputClass} min-w-0`}
            preventEnterSubmit={false}
          />
        </div>

        <div className="w-44 max-w-full shrink-0">
          <span className={compactLabelClass}>Contractor</span>
          <div
            title={selectedJob?.customerName}
            className="flex h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700"
          >
            <span className="truncate">
              {selectedJob?.customerName ?? "—"}
            </span>
          </div>
        </div>

        <div className="w-32 max-w-full shrink-0">
          <label htmlFor="quoteId" className={compactLabelClass}>
            Won quote
          </label>
          <select
            id="quoteId"
            value={quoteId}
            disabled={!selectedJob || selectedJob.quotes.length === 0}
            onChange={(event) => onQuoteChange(event.target.value)}
            className={`${compactInputClass} disabled:bg-slate-100 disabled:text-slate-400`}
          >
            {!selectedJob || selectedJob.quotes.length === 0 ? (
              <option value="">No won quote</option>
            ) : null}
            {selectedJob?.quotes.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.quoteNumber}
              </option>
            ))}
          </select>
        </div>

        <div className="w-44 max-w-full shrink-0">
          <span className={compactLabelClass}>Fulfillment</span>
          <div
            role="group"
            aria-label="Fulfillment method"
            className="grid h-8 grid-cols-2 overflow-hidden rounded-md border border-slate-300 bg-white text-xs shadow-sm"
          >
            <button
              type="button"
              aria-pressed={fulfillmentMethod === "DELIVERY"}
              onClick={() => {
                setFulfillmentMethod("DELIVERY");
                markDirty();
              }}
              className={
                fulfillmentMethod === "DELIVERY"
                  ? "bg-slate-900 px-2 font-semibold text-white"
                  : "px-2 text-slate-600 hover:bg-slate-50"
              }
            >
              Delivery
            </button>
            <button
              type="button"
              aria-pressed={fulfillmentMethod === "PICKUP"}
              onClick={() => {
                setFulfillmentMethod("PICKUP");
                markDirty();
              }}
              className={
                fulfillmentMethod === "PICKUP"
                  ? "bg-slate-900 px-2 font-semibold text-white"
                  : "border-l border-slate-200 px-2 text-slate-600 hover:bg-slate-50"
              }
            >
              Pickup
            </button>
          </div>
        </div>

        <div className="w-32 max-w-full shrink-0">
          <label htmlFor="deliveryDate" className={compactLabelClass}>
            {isPickup ? "Pickup date" : "Delivery date"}
          </label>
          <input
            id="deliveryDate"
            type="date"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
            className={compactInputClass}
          />
        </div>

        {!isPickup && drivers.length > 0 ? (
          <div
            className={`max-w-full shrink-0 ${
              driver === "__other__" ? "w-72" : "w-36"
            }`}
          >
            <label htmlFor="deliveryDriver" className={compactLabelClass}>
              Driver
            </label>
            <div className="flex gap-1.5">
              <select
                id="deliveryDriver"
                value={driver}
                onChange={(event) => setDriver(event.target.value)}
                className={`${compactInputClass} min-w-0 flex-1`}
              >
                <option value="">Driver...</option>
                {drivers.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="__other__">Other...</option>
              </select>
              {driver === "__other__" ? (
                <input
                  aria-label="Other driver name"
                  value={driverOther}
                  onChange={(event) => setDriverOther(event.target.value)}
                  placeholder="Driver name"
                  className={`${compactInputClass} min-w-0 flex-1`}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {!isPickup && trailers.length > 0 ? (
          <div
            className={`max-w-full shrink-0 ${
              trailer === "__other__" ? "w-72" : "w-36"
            }`}
          >
            <label htmlFor="deliveryTrailer" className={compactLabelClass}>
              Trailer
            </label>
            <div className="flex gap-1.5">
              <select
                id="deliveryTrailer"
                value={trailer}
                onChange={(event) => setTrailer(event.target.value)}
                className={`${compactInputClass} min-w-0 flex-1`}
              >
                <option value="">Trailer...</option>
                {trailers.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="__other__">Other...</option>
              </select>
              {trailer === "__other__" ? (
                <input
                  aria-label="Other trailer name"
                  value={trailerOther}
                  onChange={(event) => setTrailerOther(event.target.value)}
                  placeholder="Trailer type"
                  className={`${compactInputClass} min-w-0 flex-1`}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="border-t border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700"
        >
          {error}
        </p>
      ) : null}

      {hasQuote ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-slate-200 bg-white px-3 py-1.5">
          <h3 className="text-sm font-semibold text-slate-900">
            Quote lines for this load
          </h3>
          <p className="text-[11px] text-slate-500">
            Enter a load quantity to select an item. All quote lines stay visible as
            you scroll the page.
          </p>
        </div>
      ) : null}
    </div>
  );
}
