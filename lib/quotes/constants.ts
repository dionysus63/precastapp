import { DEFAULT_ESTIMATORS } from "@/lib/app-settings-defaults";
import type {
  MockServiceOption,
  QuoteLineItemType,
  QuoteStatus,
  QuoteType,
} from "@/lib/quotes/types";

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  SENT: "Sent",
  REVISED: "Revised",
  WON: "Won",
  LOST: "Lost",
  LOST_BC: "Lost-BC",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const quoteTypeLabels: Record<QuoteType, string> = {
  STOCK_ONLY: "Stock Only",
  CONFIGURABLE_STRUCTURES: "Configurable Structures",
  CUSTOM_STRUCTURES: "Custom Structures",
  MIXED: "Mixed",
};

export const quoteEstimatorFormOptions = [...DEFAULT_ESTIMATORS];

export const quoteYearFilterOptions = ["All", "2026", "2025"];

export const quoteDueDateFilterOptions = [
  "All",
  "Due This Week",
  "Overdue",
  "Next 30 Days",
];

export const quoteStatusFormOptions: { value: QuoteStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "SENT", label: "Sent" },
  { value: "REVISED", label: "Revised" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "LOST_BC", label: "Lost-BC" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const quoteTypeFormOptions: { value: QuoteType; label: string }[] = [
  { value: "STOCK_ONLY", label: "STOCK_ONLY — Stock Only" },
  {
    value: "CONFIGURABLE_STRUCTURES",
    label: "CONFIGURABLE_STRUCTURES — Configurable Structures",
  },
  {
    value: "CUSTOM_STRUCTURES",
    label: "CUSTOM_STRUCTURES — Custom Structures",
  },
  { value: "MIXED", label: "MIXED — Mixed" },
];

/** Fallback service lines when no SERVICE products exist in the catalog. */
export const mockServiceOptions: MockServiceOption[] = [
  {
    item: "Delivery",
    description: "Delivery to job site",
    lineType: "SERVICE",
    defaultUnitPrice: 1500,
    taxable: false,
  },
  {
    item: "Crane Service",
    description: "Crane service on site",
    lineType: "SERVICE",
    defaultUnitPrice: 2200,
    taxable: true,
  },
  {
    item: "Engineering",
    description: "Engineering fee",
    lineType: "SERVICE",
    defaultUnitPrice: 1800,
    taxable: true,
  },
  {
    item: "Miscellaneous",
    description: "Miscellaneous charge",
    lineType: "MISC",
    defaultUnitPrice: 0,
    taxable: true,
  },
];

export const quoteLineItemTypeLabels: Record<QuoteLineItemType, string> = {
  STOCK_PRODUCT: "Stock Product",
  CONFIGURABLE_STRUCTURE: "Configurable Structure",
  CUSTOM_STRUCTURE: "Custom Structure",
  SERVICE: "Service",
  MISC: "Misc",
  CATEGORY: "Category",
};

export function isCategoryLineItem(type: QuoteLineItemType | string): boolean {
  return type === "CATEGORY";
}

export const DEFAULT_QUOTE_TAX_RATE = 8.625;

export const DEFAULT_QUOTE_CUSTOMER_NAME = "Unassigned";

export const quotePriceListFormOptions = [
  "Standard 2026",
  "Contractor Preferred",
  "Municipal / Public Works",
];

export const quoteTermsFormOptions = [
  "Standard Precast Terms",
  "Net 30",
  "50% Deposit / Balance on Delivery",
];

export const quoteLineItemTypeOptions: {
  value: QuoteLineItemType;
  label: string;
  hint: string;
}[] = [
  {
    value: "STOCK_PRODUCT",
    label: "Add Stock Product",
    hint: "Stock products pull from inventory.",
  },
  {
    value: "CONFIGURABLE_STRUCTURE",
    label: "Add Configurable Structure",
    hint: "Configurable structures need job-specific cut sheets after award.",
  },
  {
    value: "CUSTOM_STRUCTURE",
    label: "Add Custom Structure",
    hint: "Custom structures need custom details, cut sheets, and submittals.",
  },
  {
    value: "SERVICE",
    label: "Add Service / Misc Item",
    hint: "Services do not affect inventory.",
  },
];

export const quoteWorkflowSteps = [
  { id: "draft", label: "Draft created", complete: true },
  { id: "review", label: "Internal review", complete: false },
  { id: "sent", label: "Sent to customer", complete: false },
  { id: "response", label: "Customer response", complete: false },
  { id: "won-lost", label: "Won/Lost", complete: false },
];

export const drainRingDiameterFeetOptions = [4, 6, 8, 10, 12];
