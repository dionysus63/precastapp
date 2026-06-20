export type QuoteStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "SENT"
  | "REVISED"
  | "WON"
  | "LOST"
  | "EXPIRED"
  | "CANCELLED";

export type QuoteType =
  | "STOCK_ONLY"
  | "CONFIGURABLE_STRUCTURES"
  | "CUSTOM_STRUCTURES"
  | "MIXED";

export type QuoteRow = {
  id: string;
  quoteNumber: string;
  revision: string;
  jobNumber: string;
  projectName: string;
  customer: string;
  quoteType: QuoteType;
  quoteTypeLabel: string;
  status: QuoteStatus;
  statusLabel: string;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default";
  bidDueDate: string;
  total: string;
  estimator: string;
  lastUpdated: string;
  year: number;
};

export type QuoteActivityItem = {
  id: string;
  message: string;
  timestamp: string;
};

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  SENT: "Sent",
  REVISED: "Revised",
  WON: "Won",
  LOST: "Lost",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const quoteTypeLabels: Record<QuoteType, string> = {
  STOCK_ONLY: "Stock Only",
  CONFIGURABLE_STRUCTURES: "Configurable Structures",
  CUSTOM_STRUCTURES: "Custom Structures",
  MIXED: "Mixed",
};

export const quoteStatusFilterOptions = [
  "All",
  "Draft",
  "In Review",
  "Sent",
  "Revised",
  "Won",
  "Lost",
  "Expired",
  "Cancelled",
];

export const quoteTypeFilterOptions = [
  "All",
  "Stock Only",
  "Configurable Structures",
  "Custom Structures",
  "Mixed",
];

export const quoteEstimatorFilterOptions = [
  "All",
  "Nick",
  "Mike",
];

export const quoteYearFilterOptions = ["All", "2026", "2025"];

export const quoteDueDateFilterOptions = [
  "All",
  "Due This Week",
  "Overdue",
  "Next 30 Days",
];

export const quoteSummaryCards = [
  {
    label: "Open Quotes",
    value: "4",
    detail: "Active bids in progress",
    accent: "sky" as const,
  },
  {
    label: "Quotes Due This Week",
    value: "2",
    detail: "Need estimator follow-up",
    accent: "amber" as const,
  },
  {
    label: "Awaiting Customer",
    value: "1",
    detail: "Sent and pending response",
    accent: "rose" as const,
  },
  {
    label: "Won This Month",
    value: "3",
    detail: "$142,600 awarded",
    accent: "emerald" as const,
  },
  {
    label: "Total Open Value",
    value: "$212,200",
    detail: "Across open quotes",
    accent: "sky" as const,
  },
];

export const placeholderQuotes: QuoteRow[] = [
  {
    id: "quote-1",
    quoteNumber: "Q-26-001-R0",
    revision: "R0",
    jobNumber: "26-001",
    projectName: "Main Street Drainage",
    customer: "ABC Construction",
    quoteType: "MIXED",
    quoteTypeLabel: "Mixed",
    status: "SENT",
    statusLabel: "Sent",
    statusVariant: "info",
    bidDueDate: "02/14/2026",
    total: "$48,750",
    estimator: "Nick",
    lastUpdated: "Feb 12, 2026",
    year: 2026,
  },
  {
    id: "quote-2",
    quoteNumber: "Q-26-002-R1",
    revision: "R1",
    jobNumber: "26-002",
    projectName: "Suffolk Sewer Manholes",
    customer: "Town of Brookhaven",
    quoteType: "CONFIGURABLE_STRUCTURES",
    quoteTypeLabel: "Configurable Structures",
    status: "REVISED",
    statusLabel: "Revised",
    statusVariant: "warning",
    bidDueDate: "02/20/2026",
    total: "$86,400",
    estimator: "Nick",
    lastUpdated: "Feb 18, 2026",
    year: 2026,
  },
  {
    id: "quote-3",
    quoteNumber: "Q-26-003-R0",
    revision: "R0",
    jobNumber: "26-003",
    projectName: "Yard Stock Order",
    customer: "XYZ Sitework",
    quoteType: "STOCK_ONLY",
    quoteTypeLabel: "Stock Only",
    status: "DRAFT",
    statusLabel: "Draft",
    statusVariant: "neutral",
    bidDueDate: "02/22/2026",
    total: "$12,850",
    estimator: "Mike",
    lastUpdated: "Feb 19, 2026",
    year: 2026,
  },
  {
    id: "quote-4",
    quoteNumber: "Q-26-004-R0",
    revision: "R0",
    jobNumber: "26-004",
    projectName: "Custom Valve Vault",
    customer: "Long Island Developers",
    quoteType: "CUSTOM_STRUCTURES",
    quoteTypeLabel: "Custom Structures",
    status: "IN_REVIEW",
    statusLabel: "In Review",
    statusVariant: "info",
    bidDueDate: "03/01/2026",
    total: "$64,200",
    estimator: "Nick",
    lastUpdated: "Feb 20, 2026",
    year: 2026,
  },
];

export const recentQuoteActivity: QuoteActivityItem[] = [
  {
    id: "activity-1",
    message: "Q-26-002-R1 revised and sent to Town of Brookhaven",
    timestamp: "Feb 18, 2026 · 3:40 PM",
  },
  {
    id: "activity-2",
    message: "Q-26-001-R0 marked as Sent",
    timestamp: "Feb 12, 2026 · 11:15 AM",
  },
  {
    id: "activity-3",
    message: "Q-26-004-R0 created for Custom Valve Vault",
    timestamp: "Feb 20, 2026 · 9:05 AM",
  },
  {
    id: "activity-4",
    message: "Q-26-003-R0 saved as Draft",
    timestamp: "Feb 19, 2026 · 4:20 PM",
  },
];

export type QuoteLineItemType =
  | "STOCK_PRODUCT"
  | "CONFIGURABLE_STRUCTURE"
  | "CUSTOM_STRUCTURE"
  | "SERVICE"
  | "MISC";

export type QuoteLineItemRow = {
  id: string;
  lineNumber: number;
  type: QuoteLineItemType;
  typeLabel: string;
  item: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  weight: string;
  yards: string;
  taxable: boolean;
  total: string;
};

export const quoteInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const quoteReadOnlyClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-sm";

export const quoteStatusFormOptions: { value: QuoteStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "SENT", label: "Sent" },
  { value: "REVISED", label: "Revised" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
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

export const quoteEstimatorFormOptions = ["Nick", "Mike"];

export const quoteCustomerFormOptions = [
  "ABC Construction",
  "Town of Brookhaven",
  "XYZ Sitework",
  "Long Island Developers",
  "Walk-In Customer",
];

export type MockQuoteCustomer = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export const mockQuoteCustomers: MockQuoteCustomer[] = [
  {
    name: "ABC Construction",
    contactName: "John Smith",
    contactEmail: "john@abcconstruction.com",
    contactPhone: "(631) 555-0101",
  },
  {
    name: "Town of Brookhaven",
    contactName: "Patricia Cole",
    contactEmail: "pcole@brookhaven.gov",
    contactPhone: "(631) 555-0188",
  },
  {
    name: "XYZ Sitework",
    contactName: "Maria Lopez",
    contactEmail: "maria@xyzsitework.com",
    contactPhone: "(631) 555-0142",
  },
  {
    name: "Long Island Developers",
    contactName: "David Chen",
    contactEmail: "dchen@lidevelopers.com",
    contactPhone: "(631) 555-0199",
  },
  {
    name: "Walk-In Customer",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  },
];

export const quoteJobFormOptions = [
  "26-001 - Main Street Drainage",
  "26-002 - Suffolk Sewer Manholes",
  "26-003 - Yard Stock Order",
  "26-004 - Custom Valve Vault",
];

export type MockQuoteJob = {
  id: string;
  label: string;
  projectName: string;
  projectAddress: string;
};

export const mockQuoteJobs: MockQuoteJob[] = [
  {
    id: "26-001",
    label: "26-001 - Main Street Drainage",
    projectName: "Main Street Drainage",
    projectAddress: "120 Main Street, Riverhead, NY 11901",
  },
  {
    id: "26-002",
    label: "26-002 - Suffolk Sewer Manholes",
    projectName: "Suffolk Sewer Manholes",
    projectAddress: "Patchogue Road, Brookhaven, NY 11772",
  },
  {
    id: "26-003",
    label: "26-003 - Yard Stock Order",
    projectName: "Yard Stock Order",
    projectAddress: "Precast Yard, Calverton, NY 11933",
  },
  {
    id: "26-004",
    label: "26-004 - Custom Valve Vault",
    projectName: "Custom Valve Vault",
    projectAddress: "Industrial Park Drive, Hauppauge, NY 11788",
  },
];

export type MockStockProduct = {
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  weightLb: number;
  yards: number;
};

export const mockStockProducts: MockStockProduct[] = [
  {
    code: "CB-4X4",
    description: "4'x4' Catch Basin",
    unit: "EA",
    unitPrice: 2800,
    weightLb: 8500,
    yards: 2.5,
  },
  {
    code: "RISER-24",
    description: '24" Manhole Riser',
    unit: "EA",
    unitPrice: 450,
    weightLb: 1200,
    yards: 0.35,
  },
  {
    code: "FRAME-30-SAN",
    description: '30" Sanitary Frame and Cover',
    unit: "EA",
    unitPrice: 725,
    weightLb: 310,
    yards: 0,
  },
];

export type MockConfigurableProduct = {
  code: string;
  description: string;
};

export const mockConfigurableProducts: MockConfigurableProduct[] = [
  {
    code: "SMH-SUFFOLK",
    description: "Suffolk County Sanitary Sewer Manhole",
  },
  {
    code: "DMH-STANDARD",
    description: "Standard Drainage Manhole",
  },
  {
    code: "CB-CUSTOM-OPENINGS",
    description: "Catch Basin with Job-Specific Openings",
  },
];

export type MockServiceOption = {
  item: string;
  description: string;
  lineType: "SERVICE" | "MISC";
  defaultUnitPrice: number;
  taxable: boolean;
};

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
};

export const DEFAULT_QUOTE_TAX_RATE = 8.625;

export function parseQuoteNumber(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatQuoteCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatQuoteWeight(value: number): string {
  if (value <= 0) {
    return "—";
  }

  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })} lb`;
}

export function formatQuoteYards(value: number): string {
  if (value <= 0) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export type EditableQuoteLineItem = {
  id: string;
  lineNumber: number;
  type: QuoteLineItemType;
  typeLabel: string;
  item: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  weight: string;
  yards: string;
  taxable: boolean;
  productId?: string | null;
  statusNote?: string | null;
};

export type QuoteFormCustomerOption = {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export type QuoteFormJobOption = {
  id: string;
  jobNumber: string;
  label: string;
  projectName: string;
  projectAddress: string;
  customerId: string | null;
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export type QuoteFormProductOption = {
  id: string;
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  weightLb: number;
  yards: number;
  taxable: boolean;
};

export type QuoteFormServiceOption = {
  id: string | null;
  item: string;
  description: string;
  lineType: "SERVICE" | "MISC";
  defaultUnitPrice: number;
  taxable: boolean;
  unit: string;
};

export type QuoteFormPriceListOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type QuoteFormProps = {
  customers: QuoteFormCustomerOption[];
  jobs: QuoteFormJobOption[];
  stockProducts: QuoteFormProductOption[];
  configurableProducts: QuoteFormProductOption[];
  serviceOptions: QuoteFormServiceOption[];
  priceLists?: QuoteFormPriceListOption[];
  quoteDefaults?: {
    defaultTaxRate: number;
    defaultLeadTime: string | null;
    defaultExpirationDate: string;
    estimators: string[];
    paymentTerms: string[];
  };
};

export function getLineItemTotal(line: EditableQuoteLineItem): number {
  return parseQuoteNumber(line.qty) * parseQuoteNumber(line.unitPrice);
}

export function calculateQuoteTotals(
  lineItems: EditableQuoteLineItem[],
  taxRatePercent: number,
) {
  const subtotal = lineItems.reduce(
    (sum, line) => sum + getLineItemTotal(line),
    0,
  );

  const delivery = lineItems
    .filter(
      (line) =>
        line.type === "SERVICE" &&
        line.item.toLowerCase().includes("delivery"),
    )
    .reduce((sum, line) => sum + getLineItemTotal(line), 0);

  const taxableAmount = lineItems
    .filter((line) => line.taxable)
    .reduce((sum, line) => sum + getLineItemTotal(line), 0);

  const salesTax = taxableAmount * (taxRatePercent / 100);
  const total = subtotal + salesTax;

  const totalWeight = lineItems.reduce((sum, line) => {
    const qty = parseQuoteNumber(line.qty);
    const weight = parseQuoteNumber(line.weight);
    return sum + qty * weight;
  }, 0);

  const totalYards = lineItems.reduce((sum, line) => {
    const qty = parseQuoteNumber(line.qty);
    const yards = parseQuoteNumber(line.yards);
    return sum + qty * yards;
  }, 0);

  return {
    subtotal,
    discount: 0,
    delivery,
    taxableAmount,
    salesTax,
    total,
    totalWeight,
    totalYards,
  };
}

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

export const placeholderQuoteLineItems: QuoteLineItemRow[] = [
  {
    id: "line-1",
    lineNumber: 1,
    type: "STOCK_PRODUCT",
    typeLabel: "Stock Product",
    item: "CB-4X4",
    description: "4'x4' Catch Basin",
    qty: "3",
    unit: "EA",
    unitPrice: "$2,800",
    weight: "8,500 lb",
    yards: "2.5",
    taxable: true,
    total: "$8,400",
  },
  {
    id: "line-2",
    lineNumber: 2,
    type: "CONFIGURABLE_STRUCTURE",
    typeLabel: "Configurable Structure",
    item: "SMH-SUFFOLK",
    description: "Suffolk County Sanitary Sewer Manhole MH-1",
    qty: "1",
    unit: "EA",
    unitPrice: "$14,250",
    weight: "18,200 lb",
    yards: "5.8",
    taxable: true,
    total: "$14,250",
  },
  {
    id: "line-3",
    lineNumber: 3,
    type: "CUSTOM_STRUCTURE",
    typeLabel: "Custom Structure",
    item: "Custom Vault",
    description: "Custom 8'x12' valve vault with aluminum hatch",
    qty: "1",
    unit: "EA",
    unitPrice: "$32,500",
    weight: "28,500 lb",
    yards: "9.2",
    taxable: true,
    total: "$32,500",
  },
  {
    id: "line-4",
    lineNumber: 4,
    type: "SERVICE",
    typeLabel: "Service",
    item: "Delivery",
    description: "Delivery to job site",
    qty: "1",
    unit: "EA",
    unitPrice: "$1,200",
    weight: "—",
    yards: "—",
    taxable: false,
    total: "$1,200",
  },
];

export const placeholderQuoteSummary = {
  subtotal: "$56,350",
  discount: "$0",
  delivery: "$1,200",
  taxableAmount: "$55,150",
  salesTax: "$4,412",
  total: "$61,762",
  totalWeight: "55,200 lb",
  totalYards: "17.5",
};

export const quoteWorkflowSteps = [
  { id: "draft", label: "Draft created", complete: true },
  { id: "review", label: "Internal review", complete: false },
  { id: "sent", label: "Sent to customer", complete: false },
  { id: "response", label: "Customer response", complete: false },
  { id: "won-lost", label: "Won/Lost", complete: false },
];

export type QuoteDetailLineItem = {
  id: string;
  lineNumber: number;
  type: QuoteLineItemType;
  typeLabel: string;
  item: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  weight: string;
  yards: string;
  taxable: boolean;
  total: string;
  statusNotes: string;
};

export type QuoteDetailView = {
  id: string;
  quoteNumber: string;
  originalQuote: string;
  title: string;
  subtitle: string;
  status: QuoteStatus;
  statusLabel: string;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default";
  total: string;
  bidDueDate: string;
  revision: string;
  estimator: string;
  jobNumber: string;
  projectName: string;
  projectAddress: string;
  customer: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  quoteDate: string;
  expirationDate: string;
  priceList: string;
  taxRate: string;
  customerPo: string;
  customerNotes: string;
  internalNotes: string;
  deliveryNotes: string;
  leadTime: string;
  terms: string;
  lineItems: QuoteDetailLineItem[];
  summary: {
    subtotal: string;
    discount: string;
    delivery: string;
    taxableAmount: string;
    salesTax: string;
    total: string;
    totalWeight: string;
    totalYards: string;
  };
  revisionHistory: { id: string; label: string }[];
  relatedRecords: {
    jobNumber: string;
    customer: string;
    structures: string;
    documents: string;
    submittals: string;
    invoice: string;
    deliveryTickets: string;
  };
};

export const sampleQuoteDetail: QuoteDetailView = {
  id: "sample",
  quoteNumber: "Q-26-002-R1",
  originalQuote: "Q-26-002-R0",
  title: "Quote Q-26-002-R1",
  subtitle: "Suffolk Sewer Manholes — Town of Brookhaven",
  status: "REVISED",
  statusLabel: "Revised",
  statusVariant: "warning",
  total: "$86,400",
  bidDueDate: "02/20/2026",
  revision: "R1",
  estimator: "Nick",
  jobNumber: "26-002",
  projectName: "Suffolk Sewer Manholes",
  projectAddress: "Patchogue Road, Brookhaven, NY 11772",
  customer: "Town of Brookhaven",
  contactName: "Patricia Cole",
  contactEmail: "pcole@brookhaven.gov",
  contactPhone: "(631) 555-0188",
  quoteDate: "02/10/2026",
  expirationDate: "03/12/2026",
  priceList: "Municipal / Public Works",
  taxRate: "8.0%",
  customerPo: "—",
  customerNotes:
    "Pricing includes standard Suffolk County sanitary sewer manhole configuration. Final cut sheets required after award.",
  internalNotes:
    "Revision R1 updates MH-2 invert per revised plan set received 02/17/2026.",
  deliveryNotes: "Deliver to Patchogue job site. Crane access required.",
  leadTime: "6–8 weeks ARO",
  terms: "Net 30",
  lineItems: [
    {
      id: "detail-line-1",
      lineNumber: 1,
      type: "CONFIGURABLE_STRUCTURE",
      typeLabel: "Configurable Structure",
      item: "SMH-SUFFOLK",
      description: "Suffolk County Sanitary Sewer Manhole MH-1",
      qty: "1",
      unit: "EA",
      unitPrice: "$14,250",
      weight: "18,200 lb",
      yards: "5.8",
      taxable: true,
      total: "$14,250",
      statusNotes: "Cut sheet required after award",
    },
    {
      id: "detail-line-2",
      lineNumber: 2,
      type: "CONFIGURABLE_STRUCTURE",
      typeLabel: "Configurable Structure",
      item: "SMH-SUFFOLK",
      description: "Suffolk County Sanitary Sewer Manhole MH-2",
      qty: "1",
      unit: "EA",
      unitPrice: "$15,600",
      weight: "19,400 lb",
      yards: "6.1",
      taxable: true,
      total: "$15,600",
      statusNotes: "Cut sheet required after award",
    },
    {
      id: "detail-line-3",
      lineNumber: 3,
      type: "STOCK_PRODUCT",
      typeLabel: "Stock Product",
      item: "FRAME-30-SAN",
      description: "30 inch sanitary frame and cover",
      qty: "2",
      unit: "EA",
      unitPrice: "$725",
      weight: "310 lb",
      yards: "—",
      taxable: true,
      total: "$1,450",
      statusNotes: "Pulls from inventory",
    },
    {
      id: "detail-line-4",
      lineNumber: 4,
      type: "SERVICE",
      typeLabel: "Service",
      item: "Delivery",
      description: "Delivery to job site",
      qty: "1",
      unit: "EA",
      unitPrice: "$1,500",
      weight: "—",
      yards: "—",
      taxable: false,
      total: "$1,500",
      statusNotes: "Non-inventory item",
    },
  ],
  summary: {
    subtotal: "$84,900",
    discount: "$0",
    delivery: "$1,500",
    taxableAmount: "$83,400",
    salesTax: "$6,672",
    total: "$86,400",
    totalWeight: "38,220 lb",
    totalYards: "11.9",
  },
  revisionHistory: [
    { id: "rev-1", label: "R0 created" },
    { id: "rev-2", label: "R0 sent to customer" },
    { id: "rev-3", label: "R1 revised after plan change" },
    { id: "rev-4", label: "R1 sent to customer" },
  ],
  relatedRecords: {
    jobNumber: "26-002",
    customer: "Town of Brookhaven",
    structures: "2",
    documents: "3",
    submittals: "Not generated",
    invoice: "Not created",
    deliveryTickets: "None",
  },
};

export function getQuoteDetailById(id: string) {
  if (id === "sample") {
    return sampleQuoteDetail;
  }

  return null;
}
