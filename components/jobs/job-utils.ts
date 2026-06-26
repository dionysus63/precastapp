import type { QuoteStatus } from "@/components/quotes/quote-utils";

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

export type JobDetailTab =
  | "overview"
  | "bidding"
  | "quotes"
  | "deliveries"
  | "progress"
  | "production"
  | "invoices"
  | "construction-plans"
  | "files";

export type JobRelatedQuote = {
  id: string;
  quoteNumber: string;
  projectName: string;
  customerName: string;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  total: string;
  lastUpdated: string;
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

export type JobDetailView = {
  id: string;
  jobNumber: string;
  projectName: string;
  customer: string;
  customerId: string | null;
  status: string;
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
  bidders: JobBidderRow[];
  masterQuoteOptions: JobMasterQuoteOption[];
  relatedQuotes: JobRelatedQuote[];
  relatedDeliveries: JobRelatedDelivery[];
  relatedStructures: JobRelatedStructure[];
  relatedInvoices: JobRelatedInvoice[];
  invoiceableDeliveries: JobInvoiceableDelivery[];
};

export const jobStatusLabels: Record<string, string> = {
  LEAD: "Lead",
  QUOTING: "Quoting",
  SUBMITTED: "Submitted",
  AWARDED: "Awarded",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETE: "Complete",
  LOST: "Lost",
  CANCELLED: "Cancelled",
};

export const jobInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const jobStatusFilterOptions = [
  "All",
  "Lead",
  "Quoting",
  "Submitted",
  "Awarded",
  "Active",
  "On Hold",
  "Complete",
  "Lost",
  "Cancelled",
];

export const jobStatusFormOptions = [
  { value: "LEAD", label: "Lead" },
  { value: "QUOTING", label: "Quoting" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "AWARDED", label: "Awarded" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETE", label: "Complete" },
  { value: "LOST", label: "Lost" },
  { value: "CANCELLED", label: "Cancelled" },
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
