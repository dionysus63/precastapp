"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  addJobBidder,
  awardJob,
  generateQuotesFromMaster,
  removeJobBidder,
} from "@/app/jobs/bid-actions";
import { isAwardableQuoteStatus } from "@/lib/job-bid-utils";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type {
  JobBidListCustomerOption,
  JobBidderRow,
  JobMasterQuoteOption,
} from "@/components/jobs/job-utils";

type JobBiddingPanelProps = {
  jobId: string;
  isAwarded: boolean;
  bidders: JobBidderRow[];
  masterQuoteOptions: JobMasterQuoteOption[];
  customers: JobBidListCustomerOption[];
};

function buildDefaultContactMap(bidders: JobBidderRow[]) {
  return Object.fromEntries(
    bidders
      .filter((bidder) => !bidder.quoteId && bidder.defaultContactId)
      .map((bidder) => [bidder.id, bidder.defaultContactId as string]),
  );
}

function mergeContactSelections(
  bidders: JobBidderRow[],
  current: Record<string, string>,
) {
  const next = buildDefaultContactMap(bidders);

  for (const bidder of bidders) {
    if (bidder.quoteId) {
      continue;
    }

    const selectedId = current[bidder.id];
    if (
      selectedId &&
      bidder.contacts.some((contact) => contact.id === selectedId)
    ) {
      next[bidder.id] = selectedId;
    }
  }

  return next;
}

function buildContactMapForGenerate(
  bidders: JobBidderRow[],
  contactByBidderId: Record<string, string>,
) {
  const map: Record<string, string> = {};

  for (const bidder of bidders) {
    if (bidder.quoteId) {
      continue;
    }

    const contactId =
      contactByBidderId[bidder.id] ?? bidder.defaultContactId ?? null;
    if (contactId) {
      map[bidder.id] = contactId;
    }
  }

  return map;
}

export function JobBiddingPanel({
  jobId,
  isAwarded,
  bidders,
  masterQuoteOptions,
  customers,
}: JobBiddingPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [templateQuoteId, setTemplateQuoteId] = useState(
    masterQuoteOptions[0]?.id ?? "",
  );
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [awardBidderId, setAwardBidderId] = useState("");
  const [awardQuoteId, setAwardQuoteId] = useState("");
  const [contactByBidderId, setContactByBidderId] = useState<
    Record<string, string>
  >(() => buildDefaultContactMap(bidders));

  useEffect(() => {
    setContactByBidderId((current) => mergeContactSelections(bidders, current));
  }, [bidders]);

  useEffect(() => {
    setTemplateQuoteId((current) => {
      if (current && masterQuoteOptions.some((quote) => quote.id === current)) {
        return current;
      }

      return masterQuoteOptions[0]?.id ?? "";
    });
  }, [masterQuoteOptions]);

  const existingCustomerIds = useMemo(
    () => new Set(bidders.map((bidder) => bidder.customerId)),
    [bidders],
  );

  const availableCustomers = customers.filter(
    (customer) => !existingCustomerIds.has(customer.id),
  );

  const awardableBidders = bidders.filter(
    (bidder) =>
      bidder.quoteId &&
      bidder.quoteStatus &&
      isAwardableQuoteStatus(bidder.quoteStatus),
  );

  const selectedAwardBidder = awardableBidders.find(
    (bidder) => bidder.id === awardBidderId,
  );

  function refreshAfterAction(message?: string) {
    setError(null);
    if (message) {
      setSuccess(message);
    }
    router.refresh();
  }

  function handleAddBidder() {
    if (!selectedCustomerId) {
      setError("Select a contractor to add to the bid list.");
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await addJobBidder(jobId, selectedCustomerId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelectedCustomerId("");
      refreshAfterAction("Contractor added to bid list.");
    });
  }

  function handleRemoveBidder(jobBidderId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await removeJobBidder(jobBidderId);
      if (result.error) {
        setError(result.error);
        return;
      }
      refreshAfterAction("Contractor removed from bid list.");
    });
  }

  function handleGenerateQuotes() {
    if (!templateQuoteId) {
      setError("Select a master quote to copy from.");
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await generateQuotesFromMaster(jobId, templateQuoteId, {
        contactByBidderId: buildContactMapForGenerate(
          bidders,
          contactByBidderId,
        ),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      const count = result.createdQuoteIds?.length ?? 0;
      refreshAfterAction(
        count === 1
          ? "Generated 1 quote for bidders missing one."
          : `Generated ${count} quotes for bidders missing one.`,
      );
    });
  }

  function handleAward() {
    if (!awardBidderId || !awardQuoteId) {
      setError("Select the winning contractor and quote.");
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await awardJob(jobId, awardBidderId, awardQuoteId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAwardDialogOpen(false);
      refreshAfterAction("Job awarded. Winning quote marked Won; others marked Lost-BC.");
    });
  }

  return (
    <div className="space-y-4">
      {!isAwarded ? (
        <SectionCard title="Add Contractor">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label
                htmlFor="bidListCustomer"
                className="block text-xs font-medium text-slate-700"
              >
                Contractor
              </label>
              <select
                id="bidListCustomer"
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
                disabled={pending}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm"
              >
                <option value="">Select contractor</option>
                {availableCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={pending || !selectedCustomerId}
              onClick={handleAddBidder}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Add to Bid List
            </button>
          </div>
        </SectionCard>
      ) : null}

      {!isAwarded && masterQuoteOptions.length > 0 ? (
        <SectionCard
          title="Generate Quotes"
          description="Copy line items from a master quote to every bidder who does not have a quote yet."
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label
                htmlFor="masterQuote"
                className="block text-xs font-medium text-slate-700"
              >
                Master Quote
              </label>
              <select
                id="masterQuote"
                value={templateQuoteId}
                onChange={(event) => setTemplateQuoteId(event.target.value)}
                disabled={pending}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm"
              >
                {masterQuoteOptions.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.quoteNumber}
                    {quote.scopeLabel ? ` — ${quote.scopeLabel}` : ""}
                    ({quote.lineItemCount} lines)
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={pending || bidders.length === 0}
              onClick={handleGenerateQuotes}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Generate Quotes for All Bidders
            </button>
          </div>
        </SectionCard>
      ) : null}

      {!isAwarded && awardableBidders.length > 0 ? (
        <SectionCard title="Award Job">
          <p className="text-xs text-slate-600">
            Select the winning contractor. Their quote will be marked Won, the job
            customer will be updated, and all other quotes on this job will be
            marked Lost-BC.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setAwardBidderId(awardableBidders[0]?.id ?? "");
              setAwardQuoteId(awardableBidders[0]?.quoteId ?? "");
              setAwardDialogOpen(true);
            }}
            className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Award Job…
          </button>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Bid List"
        description={`${bidders.length} contractor${bidders.length === 1 ? "" : "s"}`}
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Contractor</th>
                <th className="px-3 py-2.5 font-semibold">Contact</th>
                <th className="px-3 py-2.5 font-semibold">Quote #</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Sent</th>
                <th className="px-3 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bidders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No contractors on the bid list yet.
                  </td>
                </tr>
              ) : (
                bidders.map((bidder) => (
                  <tr key={bidder.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {bidder.customerName}
                        </span>
                        {bidder.isWinner ? (
                          <StatusBadge label="Winner" variant="success" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {bidder.quoteId || isAwarded ? (
                        <>
                          <div>{bidder.contactName}</div>
                          <div className="text-[11px] text-slate-500">
                            {bidder.contactEmail}
                          </div>
                        </>
                      ) : bidder.contacts.length > 0 ? (
                        <>
                          <select
                            value={
                              contactByBidderId[bidder.id] ??
                              bidder.defaultContactId ??
                              ""
                            }
                            onChange={(event) =>
                              setContactByBidderId((current) => ({
                                ...current,
                                [bidder.id]: event.target.value,
                              }))
                            }
                            disabled={pending}
                            className="block w-full min-w-[10rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm"
                          >
                            {bidder.contacts.map((contact) => (
                              <option key={contact.id} value={contact.id}>
                                {contact.name}
                                {contact.title ? ` — ${contact.title}` : ""}
                                {contact.isPrimary ? " (Primary)" : ""}
                              </option>
                            ))}
                          </select>
                          {(() => {
                            const selectedId =
                              contactByBidderId[bidder.id] ??
                              bidder.defaultContactId;
                            const selected = bidder.contacts.find(
                              (contact) => contact.id === selectedId,
                            );
                            if (!selected) {
                              return null;
                            }
                            return (
                              <div className="mt-1 text-[11px] text-slate-500">
                                {selected.email || selected.phone
                                  ? [selected.email, selected.phone]
                                      .filter(Boolean)
                                      .join(" · ")
                                  : "—"}
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          <div>—</div>
                          <div className="text-[11px] text-slate-500">
                            Add contacts on the customer record.
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {bidder.quoteId ? (
                        <Link
                          href={`/quotes/${bidder.quoteId}`}
                          className="font-medium text-slate-900 hover:text-slate-700"
                        >
                          {bidder.quoteNumber}
                        </Link>
                      ) : (
                        <Link
                          href={`/quotes/new?jobId=${jobId}&customerId=${bidder.customerId}&bidderId=${bidder.id}`}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          Create quote
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {bidder.quoteStatusLabel ? (
                        <StatusBadge
                          label={bidder.quoteStatusLabel}
                          variant={bidder.quoteStatusVariant}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {bidder.sentAt ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {!isAwarded && !bidder.quoteId ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleRemoveBidder(bidder.id)}
                          className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700">{success}</p> : null}

      {awardDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-900">Award Job</h3>
            <p className="mt-1 text-xs text-slate-600">
              Confirm the winning contractor and quote. This cannot be undone
              from this dialog.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="awardBidder"
                  className="block text-xs font-medium text-slate-700"
                >
                  Winning Contractor
                </label>
                <select
                  id="awardBidder"
                  value={awardBidderId}
                  onChange={(event) => {
                    const bidderId = event.target.value;
                    setAwardBidderId(bidderId);
                    const bidder = awardableBidders.find(
                      (entry) => entry.id === bidderId,
                    );
                    setAwardQuoteId(bidder?.quoteId ?? "");
                  }}
                  disabled={pending}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm"
                >
                  {awardableBidders.map((bidder) => (
                    <option key={bidder.id} value={bidder.id}>
                      {bidder.customerName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAwardBidder ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Quote:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedAwardBidder.quoteNumber}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setAwardDialogOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !awardBidderId || !awardQuoteId}
                onClick={handleAward}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {pending ? "Awarding…" : "Confirm Award"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
