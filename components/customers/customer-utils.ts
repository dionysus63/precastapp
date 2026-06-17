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
