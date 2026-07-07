import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  BulkLoadPlanner,
  type DraftLoadColumn,
} from "@/components/delivery-tickets/bulk-load-planner";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  getQuoteLineFulfillmentAndScheduled,
  getQuoteLineScheduledQuantities,
  OPEN_TICKET_STATUSES,
  type QuoteLineFulfillment,
} from "@/lib/delivery-fulfillment";

type CandidateDraft = {
  id: string;
  ticketNumber: string;
  updatedAt: Date;
  lineItems: {
    quoteLineItemId: string | null;
    productId: string | null;
    quantity: { toString(): string };
    notes: string | null;
    yardLocation: string | null;
  }[];
};

/**
 * A draft is grid-manageable only when every line maps onto a planner row
 * (plain quote line, or a drain-ring/ADS option) and carries no per-line
 * annotations — saving regenerates lines from the grid cells, so anything
 * the grid can't represent would be silently destroyed. Non-manageable
 * drafts stay in the read-only strip and keep reducing availability.
 */
function mapDraftToCells(
  draft: CandidateDraft,
  metaById: Map<string, QuoteLineFulfillment>,
): Record<string, string> | null {
  const cells: Record<string, number> = {};
  for (const line of draft.lineItems) {
    if (!line.quoteLineItemId) return null;
    const meta = metaById.get(line.quoteLineItemId);
    if (!meta || meta.isCastingAssembly || meta.lineType === "CATEGORY") {
      return null;
    }
    if (line.notes != null || line.yardLocation != null) return null;

    let rowKey: string;
    if (meta.isDrainRing || meta.isAdsPipe) {
      const options = meta.isDrainRing ? meta.drainRingOptions : meta.adsPipeOptions;
      if (
        !line.productId ||
        !options.some((option) => option.productId === line.productId)
      ) {
        return null;
      }
      rowKey = `${line.quoteLineItemId}::${line.productId}`;
    } else {
      rowKey = line.quoteLineItemId;
    }
    cells[rowKey] = (cells[rowKey] ?? 0) + Number(line.quantity);
  }
  return Object.fromEntries(
    Object.entries(cells).map(([key, qty]) => [key, String(qty)]),
  );
}

type PlanLoadsPageProps = {
  searchParams: Promise<{ jobId?: string; quoteId?: string }>;
};

function EmptyState({ message, jobId }: { message: string; jobId?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
      <p>{message}</p>
      <Link
        href={jobId ? `/jobs/${jobId}?tab=deliveries` : "/delivery-tickets"}
        className="mt-3 inline-block text-xs font-medium text-sky-700 hover:text-sky-900"
      >
        {jobId ? "← Back to job deliveries" : "← Back to Delivery Hub"}
      </Link>
    </div>
  );
}

export default async function PlanLoadsPage({ searchParams }: PlanLoadsPageProps) {
  const { jobId, quoteId } = await searchParams;

  if (!jobId) {
    return (
      <DashboardShell title="Plan Loads" subtitle="Lay out every load for a job at once.">
        <EmptyState message="Open the load planner from a job's Deliveries tab so it knows which job to plan." />
      </DashboardShell>
    );
  }

  const [job, settings] = await Promise.all([
    withDatabaseRetry((client) =>
      client.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          jobNumber: true,
          projectName: true,
          customerName: true,
          quotes: {
            where: { status: "WON" },
            orderBy: { createdAt: "desc" },
            select: { id: true, quoteNumber: true },
          },
        },
      }),
    ),
    getAppSettings(),
  ]);

  if (!job) {
    return (
      <DashboardShell title="Plan Loads" subtitle="Lay out every load for a job at once.">
        <EmptyState message="Job not found." />
      </DashboardShell>
    );
  }

  const wonQuotes = job.quotes;
  if (wonQuotes.length === 0) {
    return (
      <DashboardShell
        title={`Plan Loads — ${job.jobNumber}`}
        subtitle={job.projectName}
      >
        <EmptyState
          jobId={job.id}
          message="Loads are planned against a won quote, and this job doesn't have one yet. Mark the quote as won first."
        />
      </DashboardShell>
    );
  }

  const selectedQuoteId =
    quoteId && wonQuotes.some((quote) => quote.id === quoteId)
      ? quoteId
      : wonQuotes[0].id;

  // Drafts for this quote may become editable planner columns. They must be
  // queried first so the availability rollup can exclude them — their
  // quantities appear in the grid cells instead of the Available deduction.
  const candidateDrafts: CandidateDraft[] = await withDatabaseRetry((client) =>
    client.deliveryTicket.findMany({
      where: {
        jobId: job.id,
        quoteId: selectedQuoteId,
        ticketType: "JOB",
        fulfillmentMethod: "DELIVERY",
        status: "DRAFT",
      },
      // createdAt, not loadSequence — the sequence is a string and "10 of 12"
      // sorts before "2 of 12".
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        ticketNumber: true,
        updatedAt: true,
        lineItems: {
          orderBy: { sortOrder: "asc" },
          select: {
            quoteLineItemId: true,
            productId: true,
            quantity: true,
            notes: true,
            yardLocation: true,
          },
        },
      },
    }),
  );
  const candidateIds = candidateDrafts.map((draft) => draft.id);

  const [{ fulfillment, scheduled: scheduledExcludingCandidates }, openTickets] =
    await Promise.all([
      withDatabaseRetry((client) =>
        // OPEN_TICKET_STATUSES so "available" matches what validateLines will
        // enforce on save: quoted − delivered − committed-on-open-tickets.
        getQuoteLineFulfillmentAndScheduled(
          client,
          selectedQuoteId,
          candidateIds,
          OPEN_TICKET_STATUSES,
        ),
      ),
      withDatabaseRetry((client) =>
        client.deliveryTicket.findMany({
          where: { jobId: job.id, status: { in: OPEN_TICKET_STATUSES } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            ticketNumber: true,
            status: true,
            deliveryDate: true,
            loadSequence: true,
            totalWeight: true,
          },
        }),
      ),
    ]);

  const metaById = new Map(
    fulfillment.map((line) => [line.quoteLineItemId, line]),
  );
  const draftColumns: DraftLoadColumn[] = [];
  const managedIds = new Set<string>();
  for (const draft of candidateDrafts) {
    const cells = mapDraftToCells(draft, metaById);
    if (cells) {
      draftColumns.push({
        ticketId: draft.id,
        ticketNumber: draft.ticketNumber,
        expectedUpdatedAt: draft.updatedAt.toISOString(),
        cells,
      });
      managedIds.add(draft.id);
    }
  }

  // Non-manageable drafts must keep deducting availability, so recompute the
  // scheduled map excluding only the managed set. (Exclusion never changes
  // the fulfillment array — it aggregates DELIVERED tickets only.)
  const scheduled =
    managedIds.size === candidateIds.length
      ? scheduledExcludingCandidates
      : await withDatabaseRetry((client) =>
          getQuoteLineScheduledQuantities(
            client,
            selectedQuoteId,
            [...managedIds],
            OPEN_TICKET_STATUSES,
          ),
        );

  const existingTickets = openTickets.filter(
    (ticket) => !managedIds.has(ticket.id),
  );

  const capacityDigits = Number(
    settings.truckCapacityLabel.replace(/[^0-9.]/g, ""),
  );
  const truckCapacityLbs =
    Number.isFinite(capacityDigits) && capacityDigits > 0 ? capacityDigits : null;

  return (
    <DashboardShell
      title={`Plan Loads — ${job.jobNumber}`}
      subtitle={`${job.projectName} · ${job.customerName}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/jobs/${job.id}?tab=deliveries`}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to job deliveries
        </Link>
        {wonQuotes.length > 1 ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Quote:</span>
            {wonQuotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/delivery-tickets/plan?jobId=${job.id}&quoteId=${quote.id}`}
                className={
                  quote.id === selectedQuoteId
                    ? "rounded-full bg-sky-100 px-2.5 py-0.5 font-semibold text-sky-800"
                    : "rounded-full border border-slate-200 px-2.5 py-0.5 text-slate-600 hover:bg-slate-50"
                }
              >
                {quote.quoteNumber}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <BulkLoadPlanner
          jobId={job.id}
          quoteId={selectedQuoteId}
          fulfillment={fulfillment}
          scheduled={Object.fromEntries(scheduled)}
          draftColumns={draftColumns}
          existingTickets={existingTickets.map((ticket) => ({
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            status: ticket.status,
            deliveryDate: ticket.deliveryDate
              ? ticket.deliveryDate.toISOString().slice(0, 10)
              : null,
            loadSequence: ticket.loadSequence,
            totalWeight:
              ticket.totalWeight != null ? Number(ticket.totalWeight) : null,
          }))}
          truckCapacityLabel={settings.truckCapacityLabel}
          truckCapacityLbs={truckCapacityLbs}
        />
      </div>
    </DashboardShell>
  );
}
