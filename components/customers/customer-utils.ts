export type CustomerRow = {
  id: string;
  name: string;
  type: string;
  typeVariant: "info" | "neutral" | "default";
  primaryContact: string;
  phone: string;
  email: string;
  status: string;
  statusVariant: "success" | "warning" | "neutral";
  openQuotes: number;
  balance: string;
  lastActivity: string;
};

export const customerTypeFilterOptions = [
  "All",
  "Commercial",
  "Residential",
  "Contractor",
  "Other",
];

export const customerStatusFilterOptions = [
  "All",
  "Active",
  "Inactive",
  "Prospect",
];

export const customerTypeFormOptions = [
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "CONTRACTOR", label: "Contractor" },
  { value: "OTHER", label: "Other" },
];

export const customerStatusFormOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "PROSPECT", label: "Prospect" },
];

export type CustomerRelatedJob = {
  id: string;
  jobNumber: string;
  projectName: string;
  status: string;
  statusVariant: "success" | "info" | "warning" | "neutral";
  lastActivity: string;
};

export type CustomerRelatedQuote = {
  id: string;
  quoteNumber: string;
  projectName: string;
  status: string;
  statusLabel: string;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default";
  total: string;
  lastUpdated: string;
};

export type CustomerRelatedDeliveryTicket = {
  id: string;
  ticketNumber: string;
  projectName: string;
  status: string;
  statusLabel: string;
  deliveryDate: string;
};

export type CustomerDetailView = {
  id: string;
  name: string;
  type: string;
  typeVariant: CustomerRow["typeVariant"];
  status: string;
  statusVariant: CustomerRow["statusVariant"];
  primaryContact: string;
  phone: string;
  email: string;
  billingAddress: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  relatedJobs: CustomerRelatedJob[];
  relatedQuotes: CustomerRelatedQuote[];
  relatedDeliveryTickets: CustomerRelatedDeliveryTicket[];
};
