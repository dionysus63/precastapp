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

export type DeliveryTicketActivityItem = {
  id: string;
  message: string;
  timestamp: string;
};

export type UpcomingDeliveryGroup = {
  date: string;
  deliveries: {
    id: string;
    ticketNumber: string;
    projectName: string;
    truck: string;
    driver: string;
    time: string;
  }[];
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

export const deliveryTicketSummaryCards = [
  {
    label: "Scheduled Today",
    value: "1",
    detail: "Deliveries on today's schedule",
    accent: "sky" as const,
  },
  {
    label: "Ready to Ship",
    value: "2",
    detail: "Tickets cleared for loading",
    accent: "emerald" as const,
  },
  {
    label: "In Transit",
    value: "0",
    detail: "Currently on the road",
    accent: "amber" as const,
  },
  {
    label: "Delivered This Week",
    value: "1",
    detail: "Completed deliveries",
    accent: "emerald" as const,
  },
  {
    label: "Open Tickets",
    value: "3",
    detail: "Draft, scheduled, or loading",
    accent: "rose" as const,
  },
];

export const placeholderDeliveryTickets: DeliveryTicketRow[] = [
  {
    id: "dt-1",
    ticketNumber: "DT-26-001",
    jobNumber: "26-001",
    projectName: "Main Street Drainage",
    customer: "ABC Construction",
    deliveryDate: "02/18/2026",
    deliveryDateIso: "2026-02-18",
    deliveryTime: "07:00",
    truck: "Truck 3",
    driver: "Mike",
    status: "SCHEDULED",
    statusVariant: "info",
    items: 4,
    totalWeight: "36,000 lb",
  },
  {
    id: "dt-2",
    ticketNumber: "DT-26-002",
    jobNumber: "26-002",
    projectName: "Suffolk Sewer Manholes",
    customer: "Town of Brookhaven",
    deliveryDate: "02/19/2026",
    deliveryDateIso: "2026-02-19",
    deliveryTime: "06:30",
    truck: "Lowboy",
    driver: "Anthony",
    status: "LOADING",
    statusVariant: "warning",
    items: 2,
    totalWeight: "38,500 lb",
  },
  {
    id: "dt-3",
    ticketNumber: "DT-26-003",
    jobNumber: "26-004",
    projectName: "Custom Valve Vault",
    customer: "Long Island Developers",
    deliveryDate: "02/21/2026",
    deliveryDateIso: "2026-02-21",
    deliveryTime: null,
    truck: "Truck 1",
    driver: "TBD",
    status: "DRAFT",
    statusVariant: "neutral",
    items: 1,
    totalWeight: "28,500 lb",
  },
];

export const upcomingDeliveries: UpcomingDeliveryGroup[] = [
  {
    date: "Feb 18, 2026",
    deliveries: [
      {
        id: "upcoming-1",
        ticketNumber: "DT-26-001",
        projectName: "Main Street Drainage",
        truck: "Truck 3",
        driver: "Mike",
        time: "7:00 AM",
      },
    ],
  },
  {
    date: "Feb 19, 2026",
    deliveries: [
      {
        id: "upcoming-2",
        ticketNumber: "DT-26-002",
        projectName: "Suffolk Sewer Manholes",
        truck: "Lowboy",
        driver: "Anthony",
        time: "6:30 AM",
      },
    ],
  },
  {
    date: "Feb 21, 2026",
    deliveries: [
      {
        id: "upcoming-3",
        ticketNumber: "DT-26-003",
        projectName: "Custom Valve Vault",
        truck: "Truck 1",
        driver: "TBD",
        time: "TBD",
      },
    ],
  },
];

export const recentDeliveryActivity: DeliveryTicketActivityItem[] = [
  {
    id: "activity-1",
    message: "DT-26-002 moved to Loading",
    timestamp: "Feb 19, 2026 · 6:15 AM",
  },
  {
    id: "activity-2",
    message: "DT-26-001 scheduled for Truck 3",
    timestamp: "Feb 18, 2026 · 4:30 PM",
  },
  {
    id: "activity-3",
    message: "DT-26-003 created as Draft",
    timestamp: "Feb 17, 2026 · 2:10 PM",
  },
  {
    id: "activity-4",
    message: "DT-26-000 delivered to XYZ Sitework",
    timestamp: "Feb 14, 2026 · 11:45 AM",
  },
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

export const sampleDeliveryTicketDetail: DeliveryTicketDetailView = {
  id: "sample",
  ticketNumber: "DT-26-002",
  title: "Delivery Ticket DT-26-002",
  subtitle: "Suffolk Sewer Manholes — Town of Brookhaven",
  status: "LOADING",
  statusLabel: "Loading",
  statusVariant: "warning",
  deliveryDate: "02/19/2026",
  deliveryTime: "6:30 AM",
  truck: "Lowboy",
  driver: "Anthony",
  totalWeight: "38,500 lb",
  jobNumber: "26-002",
  projectName: "Suffolk Sewer Manholes",
  customer: "Town of Brookhaven",
  deliveryAddress: "Patchogue Road, Brookhaven, NY 11772",
  siteContactName: "Patricia Cole",
  siteContactPhone: "(631) 555-0188",
  requestedBy: "Patricia Cole",
  createdBy: "Nick",
  trailer: "Lowboy Trailer",
  loadSequence: "1",
  craneRequired: "Yes",
  forkliftRequired: "No",
  specialEquipmentNeeded: "Crane rigging straps, escort vehicle",
  driverNotes: "Arrive before 7:00 AM. Call site contact 30 minutes out.",
  internalNotes: "Both manholes cleared for loading. Verify MH-2 lifting points before departure.",
  customerNotes: "Deliver to south staging area near Patchogue Road entrance.",
  loadingNotes: "Load MH-1 first, MH-2 second. Secure with chains and binders.",
  siteInstructions:
    "Crane access from east side of site. Keep clear of active sewer trench.",
  lineItems: [
    {
      id: "dt-detail-line-1",
      lineNumber: 1,
      type: "CONFIGURABLE_STRUCTURE",
      item: "MH-1",
      description: "Suffolk County Sanitary Sewer Manhole MH-1",
      qty: "1",
      unit: "EA",
      weightEach: "18,200 lb",
      totalWeight: "18,200 lb",
      yardLocation: "Production Area",
      status: "Made",
      statusVariant: "info",
      notes: "—",
    },
    {
      id: "dt-detail-line-2",
      lineNumber: 2,
      type: "CONFIGURABLE_STRUCTURE",
      item: "MH-2",
      description: "Suffolk County Sanitary Sewer Manhole MH-2",
      qty: "1",
      unit: "EA",
      weightEach: "20,300 lb",
      totalWeight: "20,300 lb",
      yardLocation: "Production Area",
      status: "Made",
      statusVariant: "info",
      notes: "—",
    },
  ],
  summary: {
    totalItems: "2",
    totalWeight: "38,500 lb",
    truckCapacity: "80,000 lb",
    remainingCapacity: "41,500 lb",
    deliveryDate: "02/19/2026",
    status: "Loading",
  },
  relatedRecords: {
    jobNumber: "26-002",
    jobHref: null,
    quoteNumber: "Q-26-002-R1",
    quoteHref: "/quotes/sample",
    customer: "Town of Brookhaven",
    customerHref: null,
    invoice: "Not created",
    photos: "None",
    signedTicket: "Not uploaded",
  },
  statusHistory: [
    { id: "history-1", label: "Draft created", complete: true },
    { id: "history-2", label: "Scheduled", complete: true },
    { id: "history-3", label: "Loading", complete: true, current: true },
    { id: "history-4", label: "In transit", complete: false },
    { id: "history-5", label: "Delivered", complete: false },
  ],
};

export function getDeliveryTicketDetailById(id: string) {
  if (id === "sample") {
    return sampleDeliveryTicketDetail;
  }

  return null;
}

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
