import type { QuoteStatus } from "@/components/quotes/quote-utils";

/** Jobs still alive — the default view on the jobs list. */
export const OPEN_JOB_STATUSES = [
  "QUOTING",
  "DETAILING",
  "AWARDED",
  "ACTIVE",
  "ON_HOLD",
] as const;

/** Terminal non-complete statuses, grouped under the Closed tab. */
export const CLOSED_JOB_STATUSES = ["CLOSED"] as const;

export type JobStatusVariant =
  | "success"
  | "info"
  | "warning"
  | "neutral"
  | "default"
  | "danger";

export type JobRow = {
  id: string;
  jobNumber: string;
  projectName: string;
  customer: string;
  projectAddress: string;
  status: string;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default";
  year: number;
  bidDate: string;
  awardedDate: string;
  folderPath: string | null;
  lastActivity: string;
};

/** Actionable row on the job overview tab, linking to the tab that resolves it. */
export type JobAttentionItem = {
  key: string;
  label: string;
  tab: JobDetailTab;
  tone: "warning" | "danger" | "info";
};

/** One row of the job overview's cross-record activity feed. */
export type JobActivityItem = {
  key: string;
  typeLabel: string;
  recordNumber: string;
  href: string;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  updated: string;
};

export type JobOverviewData = {
  attentionItems: JobAttentionItem[];
  recentActivity: JobActivityItem[];
  structuresTotal: number;
  structuresShipped: number;
};

export type JobDetailTab =
  | "overview"
  | "bidding"
  | "quotes"
  | "deliveries"
  | "progress"
  | "production"
  | "invoices"
  | "construction-plans"
  | "purchase-orders"
  | "tax-exempt-cert"
  | "files";

export type JobRelatedQuote = {
  id: string;
  quoteNumber: string;
  projectName: string;
  scopeLabel: string | null;
  customerName: string;
  masterQuoteId: string | null;
  groupKey: string;
  isMaster: boolean;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  total: string;
  lastUpdated: string;
};

export type JobQuoteGroup = {
  groupKey: string;
  scopeLabel: string | null;
  masterQuoteNumber: string;
  masterQuoteId: string;
  quoteCount: number;
  quotes: JobRelatedQuote[];
};

export type JobBidderContactOption = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

export type JobBidderRow = {
  id: string;
  customerId: string;
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contacts: JobBidderContactOption[];
  defaultContactId: string | null;
  isWinner: boolean;
  quoteId: string | null;
  quoteNumber: string | null;
  quoteStatus: QuoteStatus | null;
  quoteStatusLabel: string | null;
  quoteStatusVariant: JobStatusVariant;
  sentAt: string | null;
};

export type JobMasterQuoteOption = {
  id: string;
  quoteNumber: string;
  scopeLabel: string | null;
  lineItemCount: number;
};

export type JobBiddingSummary = {
  bidderCount: number;
  quotesSentCount: number;
  summaryText: string;
  isAwarded: boolean;
};

export type JobBidListCustomerOption = {
  id: string;
  name: string;
};

export type JobDeliveryLineItem = {
  id: string;
  lineNumber: number;
  itemCode: string;
  description: string;
  quantity: string;
  unit: string;
  totalWeight: string;
  yardLocation: string;
  statusLabel: string;
  statusVariant: JobStatusVariant;
};

export type JobRelatedDelivery = {
  id: string;
  ticketNumber: string;
  projectName: string;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  deliveryDate: string;
  lastUpdated: string;
  lineItems: JobDeliveryLineItem[];
};

export type JobProgressLine = {
  quoteLineItemId: string;
  lineNumber: number;
  itemCode: string;
  description: string;
  displayName: string;
  unit: string;
  awardedQty: string;
  shippedQty: string;
  scheduledQty: string;
  remainingQty: string;
  stockLevel: string;
  submittalStatus: string;
  submittalStatusVariant: JobStatusVariant;
  submittalDocCount: number;
  structureStatus: string;
  structureStatusVariant: JobStatusVariant;
  lineType: string;
  jobStructureId: string | null;
  /** Quote-only structure whose cut sheet hasn't been created yet. */
  needsDrillSheet: boolean;
  createDrillSheetHref: string | null;
};

export type JobProgressSummary = {
  totalLines: number;
  fullyShippedLines: number;
  partiallyShippedLines: number;
  notShippedLines: number;
};

export type JobProgressView = {
  quoteId: string | null;
  quoteNumber: string | null;
  lines: JobProgressLine[];
  summary: JobProgressSummary;
};

export type JobRelatedStructure = {
  id: string;
  structureNumber: string;
  description: string;
  typeLabel: string;
  quantity: string;
  status: string;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  needsSubmittal: boolean;
  documentCount: number;
  submittedDate: string;
  madeDate: string;
  shippedDate: string;
  /** Set when this structure is a drill sheet (has a structure template). */
  drillSheetId: string | null;
  /** Quote-only structure whose cut sheet hasn't been created yet. */
  needsDrillSheet: boolean;
  createDrillSheetHref: string | null;
};

export type JobRelatedInvoice = {
  id: string;
  invoiceNumber: string;
  ticketNumber: string;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  total: string;
  invoiceDate: string;
};

export type JobInvoiceableDelivery = {
  id: string;
  ticketNumber: string;
  projectName: string;
  deliveryDate: string;
};

export type JobSummaryStat = {
  label: string;
  value: string;
  detail: string;
};

export type JobRelationCounts = {
  quotes: number;
  bidders: number;
  deliveries: number;
  structures: number;
  invoices: number;
};

export type JobDetailView = {
  id: string;
  jobNumber: string;
  projectName: string;
  customer: string;
  customerId: string | null;
  status: string;
  /** Raw JobStatus enum value backing the quick status select. */
  statusValue: string;
  statusVariant: JobStatusVariant;
  year: number;
  projectAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  bidDate: string;
  awardedDate: string;
  folderPath: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  stats: JobSummaryStat[];
  structureStatusBreakdown: { label: string; count: number }[];
  biddingSummary: JobBiddingSummary;
  counts: JobRelationCounts;
};

export const jobStatusLabels: Record<string, string> = {
  QUOTING: "Quoting",
  DETAILING: "Detailing",
  AWARDED: "Awarded",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETE: "Complete",
  CLOSED: "Closed",
};

export const jobInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const jobStatusFilterOptions = [
  "All",
  "Quoting",
  "Detailing",
  "Awarded",
  "Active",
  "On Hold",
  "Complete",
  "Closed",
];

export const jobStatusFormOptions = [
  { value: "QUOTING", label: "Quoting" },
  { value: "DETAILING", label: "Detailing" },
  { value: "AWARDED", label: "Awarded" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETE", label: "Complete" },
  { value: "CLOSED", label: "Closed" },
];

export function buildJobYearFilterOptions(years: number[]) {
  const uniqueYears = [...new Set(years)].sort((a, b) => b - a);
  return ["All", ...uniqueYears.map(String)];
}

export function buildJobCustomerFilterOptions(customers: string[]) {
  const uniqueCustomers = [...new Set(customers)].sort((a, b) =>
    a.localeCompare(b),
  );
  return ["All", ...uniqueCustomers];
}

export function formatJobDateInput(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function groupJobRelatedQuotes(quotes: JobRelatedQuote[]): JobQuoteGroup[] {
  const byKey = new Map<string, JobRelatedQuote[]>();

  for (const quote of quotes) {
    const existing = byKey.get(quote.groupKey) ?? [];
    existing.push(quote);
    byKey.set(quote.groupKey, existing);
  }

  return [...byKey.entries()]
    .map(([groupKey, groupQuotes]) => {
      const master =
        groupQuotes.find((quote) => quote.id === groupKey) ??
        groupQuotes.find((quote) => quote.isMaster) ??
        groupQuotes[0];
      const scopeLabel =
        master.scopeLabel ??
        groupQuotes.find((quote) => quote.scopeLabel)?.scopeLabel ??
        null;

      return {
        groupKey,
        scopeLabel,
        masterQuoteNumber: master.quoteNumber,
        masterQuoteId: groupKey,
        quoteCount: groupQuotes.length,
        quotes: [...groupQuotes].sort((a, b) =>
          a.customerName.localeCompare(b.customerName),
        ),
      };
    })
    .sort((a, b) => {
      const aScope = a.scopeLabel ?? a.masterQuoteNumber;
      const bScope = b.scopeLabel ?? b.masterQuoteNumber;
      return aScope.localeCompare(bScope);
    });
}
