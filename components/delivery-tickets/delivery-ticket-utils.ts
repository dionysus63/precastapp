export type DeliveryTicketStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LOADING"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type DeliveryTicketRow = {
  id: string;
  ticketNumber: string;
  jobNumber: string;
  projectName: string;
  customer: string;
  deliveryDate: string;
  deliveryDateIso: string | null;
  deliveryTime: string | null;
  truck: string;
  driver: string;
  status: DeliveryTicketStatus;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default" | "danger";
  items: number;
  totalWeight: string;
};

export const deliveryTicketStatusFilterOptions = [
  "All",
  "Draft",
  "Scheduled",
  "Loading",
  "In Transit",
  "Delivered",
  "Cancelled",
];

export const deliveryDateFilterOptions = [
  "All",
  "Today",
  "This Week",
  "Next 7 Days",
  "Past Due",
];

export const deliveryDriverFilterOptions = [
  "All",
  "Mike",
  "Anthony",
  "TBD",
];

export const deliveryTruckFilterOptions = [
  "All",
  "Truck 1",
  "Truck 3",
  "Lowboy",
];

export const deliveryJobFilterOptions = [
  "All",
  "26-001",
  "26-002",
  "26-004",
];

export const deliveryTicketStatusLabels: Record<DeliveryTicketStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  LOADING: "Loading",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function parseDeliveryDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

export const deliveryTicketInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const deliveryTicketReadOnlyClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-sm";

export const deliveryTicketStatusFormOptions: {
  value: DeliveryTicketStatus;
  label: string;
}[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "LOADING", label: "Loading" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export type DeliveryTicketLineItemType =
  | "STOCK_PRODUCT"
  | "CONFIGURABLE_STRUCTURE"
  | "CUSTOM_STRUCTURE"
  | "MISC";

export type DeliveryTicketFormLineItem = {
  id: string;
  lineNumber: number;
  type: DeliveryTicketLineItemType;
  typeLabel: string;
  item: string;
  description: string;
  qty: string;
  unit: string;
  weightEach: string;
  totalWeight: string;
  yardLocation: string;
  status: string;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default";
};

export const placeholderDeliveryTicketFormItems: DeliveryTicketFormLineItem[] = [
  {
    id: "dt-line-1",
    lineNumber: 1,
    type: "STOCK_PRODUCT",
    typeLabel: "Stock Product",
    item: "CB-4X4",
    description: "4'x4' Catch Basin",
    qty: "2",
    unit: "EA",
    weightEach: "8,500 lb",
    totalWeight: "17,000 lb",
    yardLocation: "Yard A",
    status: "Ready",
    statusVariant: "success",
  },
  {
    id: "dt-line-2",
    lineNumber: 2,
    type: "CONFIGURABLE_STRUCTURE",
    typeLabel: "Configurable Structure",
    item: "MH-1",
    description: "Suffolk County Sanitary Sewer Manhole MH-1",
    qty: "1",
    unit: "EA",
    weightEach: "18,200 lb",
    totalWeight: "18,200 lb",
    yardLocation: "Production Area",
    status: "Made",
    statusVariant: "info",
  },
  {
    id: "dt-line-3",
    lineNumber: 3,
    type: "CUSTOM_STRUCTURE",
    typeLabel: "Custom Structure",
    item: "CV-1",
    description: "Custom 8'x12' Valve Vault",
    qty: "1",
    unit: "EA",
    weightEach: "28,500 lb",
    totalWeight: "28,500 lb",
    yardLocation: "Yard B",
    status: "Approved",
    statusVariant: "neutral",
  },
];

export const deliveryTicketWorkflowSteps = [
  { id: "created", label: "Ticket created", complete: true },
  { id: "confirmed", label: "Items confirmed", complete: false },
  { id: "truck", label: "Truck assigned", complete: false },
  { id: "loaded", label: "Loaded", complete: false },
  { id: "delivered", label: "Delivered", complete: false },
  { id: "signed", label: "Signed ticket returned", complete: false },
];

export const placeholderDeliveryTicketFormSummary = {
  totalItems: "3",
  totalWeight: "63,700 lb",
  truckCapacity: "80,000 lb",
  deliveryDate: "02/20/2026",
  status: "Draft",
  jobNumber: "26-001",
  customer: "ABC Construction",
};

export const deliveryTicketJobOptions = [
  { value: "", label: "Select job..." },
  { value: "26-001", label: "26-001 - Main Street Drainage" },
  { value: "26-002", label: "26-002 - Suffolk Sewer Manholes" },
  { value: "26-004", label: "26-004 - Custom Valve Vault" },
];

export const deliveryTicketCustomerOptions = [
  { value: "", label: "Select customer..." },
  { value: "abc", label: "ABC Construction" },
  { value: "brookhaven", label: "Town of Brookhaven" },
  { value: "lid", label: "Long Island Developers" },
];

export const deliveryTicketTruckOptions = [
  { value: "", label: "Select truck..." },
  { value: "truck-1", label: "Truck 1" },
  { value: "truck-3", label: "Truck 3" },
  { value: "lowboy", label: "Lowboy" },
];

export const deliveryTicketDriverOptions = [
  { value: "", label: "Select driver..." },
  { value: "mike", label: "Mike" },
  { value: "anthony", label: "Anthony" },
  { value: "tbd", label: "TBD" },
];

export const deliveryTicketTrailerOptions = [
  { value: "", label: "Select trailer..." },
  { value: "flatbed", label: "Flatbed Trailer" },
  { value: "lowboy", label: "Lowboy Trailer" },
  { value: "none", label: "None" },
];

export type DeliveryTicketDetailLineItem = {
  id: string;
  lineNumber: number;
  type: DeliveryTicketLineItemType;
  item: string;
  description: string;
  qty: string;
  unit: string;
  weightEach: string;
  totalWeight: string;
  yardLocation: string;
  status: string;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default";
  notes: string;
};

export type DeliveryTicketStatusHistoryStep = {
  id: string;
  label: string;
  complete: boolean;
  current?: boolean;
};

export type DeliveryTicketDetailView = {
  id: string;
  ticketNumber: string;
  title: string;
  subtitle: string;
  status: DeliveryTicketStatus;
  statusLabel: string;
  statusVariant: DeliveryTicketRow["statusVariant"];
  deliveryDate: string;
  deliveryTime: string;
  truck: string;
  driver: string;
  totalWeight: string;
  jobNumber: string;
  projectName: string;
  customer: string;
  deliveryAddress: string;
  siteContactName: string;
  siteContactPhone: string;
  requestedBy: string;
  createdBy: string;
  trailer: string;
  loadSequence: string;
  craneRequired: string;
  forkliftRequired: string;
  specialEquipmentNeeded: string;
  driverNotes: string;
  internalNotes: string;
  customerNotes: string;
  loadingNotes: string;
  siteInstructions: string;
  lineItems: DeliveryTicketDetailLineItem[];
  summary: {
    totalItems: string;
    totalWeight: string;
    truckCapacity: string;
    remainingCapacity: string;
    deliveryDate: string;
    status: string;
  };
  relatedRecords: {
    jobNumber: string;
    jobHref: string | null;
    quoteNumber: string;
    quoteHref: string | null;
    customer: string;
    customerHref: string | null;
    invoice: string;
    photos: string;
    signedTicket: string;
  };
  statusHistory: DeliveryTicketStatusHistoryStep[];
};

export function matchesDeliveryDateFilter(
  deliveryDate: string,
  dateFilter: string,
) {
  if (dateFilter === "All") {
    return true;
  }

  const delivery = parseDeliveryDate(deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const nextWeekEnd = new Date(today);
  nextWeekEnd.setDate(today.getDate() + 7);

  if (dateFilter === "Today") {
    return (
      delivery.getFullYear() === today.getFullYear() &&
      delivery.getMonth() === today.getMonth() &&
      delivery.getDate() === today.getDate()
    );
  }

  if (dateFilter === "This Week") {
    return delivery >= today && delivery <= weekEnd;
  }

  if (dateFilter === "Next 7 Days") {
    return delivery >= today && delivery <= nextWeekEnd;
  }

  if (dateFilter === "Past Due") {
    return delivery < today;
  }

  return true;
}
