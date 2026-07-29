import type { StatusVariant } from "@/lib/status-variants";
import type {
  QuoteStructureConfig,
  StructureDrillSheetStatus,
} from "@/lib/quotes/structure-workbook";
import type { RectQuoteStructureConfig } from "@/lib/quotes/rect-structure-workbook";

export type QuoteStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "SENT"
  | "REVISED"
  | "WON"
  | "LOST"
  | "LOST_BC"
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
  jobId: string | null;
  jobNumber: string;
  projectName: string;
  scopeLabel: string | null;
  customer: string;
  quoteType: QuoteType;
  quoteTypeLabel: string;
  status: QuoteStatus;
  statusLabel: string;
  statusVariant: StatusVariant;
  bidDueDate: string;
  /** Overdue/soon flags for open quotes so the list can color the due date. */
  bidDueUrgency: "overdue" | "soon" | null;
  total: string;
  estimator: string;
  lastUpdated: string;
  year: number;
};

export type QuoteLineItemType =
  | "STOCK_PRODUCT"
  | "CONFIGURABLE_STRUCTURE"
  | "CUSTOM_STRUCTURE"
  | "SERVICE"
  | "MISC"
  | "CATEGORY"
  | "NOTE"
  | "PAGE_BREAK";

export type CustomStructureCostItem = {
  id: string;
  label: string;
  qty: string;
  unitCost: string;
};

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
  isDrainRing?: boolean;
  ringDiameterFeet?: number | null;
  poolHeightFeet?: number | null;
  drainRingStyle?: "DRAIN" | "SANITARY" | "SOLID";
  structureConfig?: QuoteStructureConfig | null;
  rectStructureConfig?: RectQuoteStructureConfig | null;
  costBreakdown?: CustomStructureCostItem[] | null;
};

export type QuoteFormInitialValues = {
  quoteNumber: string;
  customerId: string;
  customerName: string;
  jobId: string;
  jobBidderId: string;
  jobNumber: string;
  projectName: string;
  scopeLabel: string;
  projectAddress: string;
  contactId: string;
  contactTitle: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: QuoteStatus;
  quoteType: QuoteType;
  estimator: string;
  quoteDate: string;
  bidDueDate: string;
  expirationDate: string;
  customerPo: string;
  priceListId: string;
  taxRate: string;
  internalNotes: string;
  customerNotes: string;
  leadTime: string;
  deliveryNotes: string;
  termsAndConditions: string;
  fob: string;
  lineItems: EditableQuoteLineItem[];
};

export type QuoteFormCustomerContactOption = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

export type QuoteFormCustomerOption = {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contacts: QuoteFormCustomerContactOption[];
  /** Contact the customer marked as their estimating default, if any. */
  estimatingContactId: string | null;
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
  name: string;
  description: string;
  category: string;
  subcategory: string;
  unit: string;
  unitPrice: number;
  weightLb: number;
  yards: number;
  taxable: boolean;
  isCastingAssembly?: boolean;
  isCastingComponent?: boolean;
  castingOrigin?: "DOMESTIC" | "IMPORTED" | null;
  castingSoldAsUnit?: boolean;
};

export type QuotePipeProductOption = {
  id: string;
  code: string;
  name: string;
  description: string;
  productType: "ADS_PIPE" | "PRECAST_PIPE";
  pipeDiameterInches: number;
  pipeLengthFeet: number;
  pipeClass: string | null;
  pipeJointType: string | null;
  unit: string;
  unitPrice: number;
  weightLb: number;
  taxable: boolean;
};

export type MockServiceOption = {
  item: string;
  description: string;
  lineType: "SERVICE" | "MISC";
  defaultUnitPrice: number;
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
  /** Default F.O.B. wording for quotes on this list; null means "Factory". */
  fobDefault: string | null;
};

import type { RingBuilderConfig } from "@/lib/ring-builder-settings";

export type QuoteFormProps = {
  customers: QuoteFormCustomerOption[];
  jobs: QuoteFormJobOption[];
  stockProducts: QuoteFormProductOption[];
  configurableProducts: QuoteFormProductOption[];
  serviceOptions: QuoteFormServiceOption[];
  priceLists?: QuoteFormPriceListOption[];
  ringBuilderConfig?: RingBuilderConfig;
  ringSlabProducts?: QuoteFormProductOption[];
  pipeProducts?: QuotePipeProductOption[];
  initialJobId?: string;
  initialCustomerId?: string;
  initialJobBidderId?: string;
  quoteId?: string;
  initialValues?: QuoteFormInitialValues;
  quoteDefaults?: {
    defaultTaxRate: number;
    defaultLeadTime: string | null;
    defaultExpirationDate: string;
    estimators: string[];
    paymentTerms: string[];
    defaultEstimator?: string | null;
  };
};

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
  qtyOnHand: string;
  taxable: boolean;
  total: string;
  statusNotes: string;
  structureDrillSheetStatus?: StructureDrillSheetStatus | null;
  jobStructureId?: string | null;
  costBreakdown?: CustomStructureCostItem[] | null;
};

export type QuoteRelatedStructure = {
  id: string;
  structureNumber: string;
  description: string;
  status: string;
  statusLabel: string;
  needsSubmittal: boolean;
  documentCount: number;
  jobId: string;
  folderPath: string | null;
  /** Set when this structure is a drill sheet (has a structure template). */
  drillSheetId: string | null;
};

export type QuoteCustomerTab = {
  id: string;
  customerName: string;
  quoteNumber: string;
  statusLabel: string;
  statusVariant: StatusVariant;
  total: string;
  isCurrent: boolean;
};

export type QuoteDetailView = {
  id: string;
  quoteNumber: string;
  originalQuote: string;
  title: string;
  subtitle: string;
  status: QuoteStatus;
  statusLabel: string;
  statusVariant: StatusVariant;
  total: string;
  bidDueDate: string;
  revision: string;
  estimator: string;
  createdBy: string;
  jobId: string | null;
  jobNumber: string;
  projectName: string;
  scopeLabel: string | null;
  projectAddress: string;
  customer: string;
  contactName: string;
  contactEmail: string;
  contactEmailAddress: string;
  contactPhone: string;
  contactTitle: string;
  quoteDate: string;
  sentAt: string;
  bidListContractor: string | null;
  expirationDate: string;
  priceList: string;
  taxRate: string;
  customerPo: string;
  customerNotes: string;
  internalNotes: string;
  deliveryNotes: string;
  leadTime: string;
  terms: string;
  fob: string;
  lineItems: QuoteDetailLineItem[];
  drillSheetReadyCount: number;
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
  revisionHistory: {
    id: string;
    label: string;
    isCurrent: boolean;
  }[];
  canRevise: boolean;
  canEdit: boolean;
  canSend: boolean;
  canDelete: boolean;
  supersededBy: {
    id: string;
    quoteNumber: string;
    revision: string;
  } | null;
  relatedStructures: QuoteRelatedStructure[];
  relatedRecords: {
    jobNumber: string;
    customer: string;
    structures: string;
    documents: string;
    submittals: string;
    invoice: string;
    deliveryTickets: string;
  };
  customerTabs: QuoteCustomerTab[];
};
