export type CustomerRow = {
  id: string;
  name: string;
  primaryContact: string;
  phone: string;
  email: string;
  status: string;
  statusVariant: "success" | "warning" | "neutral";
  openQuotes: number;
  balance: string;
  lastActivity: string;
};

export const customerStatusFilterOptions = [
  "All",
  "Active",
  "Inactive",
  "Prospect",
];

export const customerStatusFormOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "PROSPECT", label: "Prospect" },
];

export type BulkCustomerPasteRow = {
  lineNumber: number;
  name: string;
  status: string;
  primaryContactName: string;
  phone: string;
  email: string;
  address: string;
  town: string;
  state: string;
  zip: string;
  notes: string;
  isValid: boolean;
  issues: string[];
};

export const bulkPasteColumnHeaders = [
  "Name",
  "Status",
  "Primary Contact",
  "Phone",
  "Email",
  "Address",
  "Town",
  "State",
  "Zip",
  "Notes",
];

export const bulkPasteExample = `Smith Construction LLC\tActive\tJohn Smith\t631-555-0100\tjohn@smith.com\t123 Main St\tBrookhaven\tNY\t11719\tGeneral contractor
Bay Shore Pools\tProspect\tMaria Lopez\t631-555-0200\tmaria@bayshore.com\t45 Ocean Ave\tBay Shore\tNY\t11706\t
`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseBulkCustomerStatus(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "ACTIVE";
  }

  const upper = trimmed.toUpperCase();
  if (customerStatusFormOptions.some((option) => option.value === upper)) {
    return upper;
  }

  const byLabel = customerStatusFormOptions.find(
    (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return byLabel?.value ?? null;
}

export function bulkPasteRowKey(row: {
  name: string;
  email: string;
}): string {
  const name = row.name.trim().toLowerCase();
  const email = row.email.trim().toLowerCase();
  return email ? `${name}::${email}` : name;
}

export function markBulkPasteDuplicateRows(
  rows: BulkCustomerPasteRow[],
): BulkCustomerPasteRow[] {
  const seen = new Map<string, number>();

  return rows.map((row) => {
    if (!row.name.trim()) {
      return row;
    }

    const key = bulkPasteRowKey(row);
    const firstLine = seen.get(key);
    if (firstLine == null) {
      seen.set(key, row.lineNumber);
      return row;
    }

    return {
      ...row,
      isValid: false,
      issues: [...row.issues, `Duplicate row in paste (same as line ${firstLine}).`],
    };
  });
}

export function validateBulkCustomerPasteRow(
  row: Omit<BulkCustomerPasteRow, "isValid" | "issues" | "lineNumber">,
  lineNumber: number,
): BulkCustomerPasteRow {
  const issues: string[] = [];

  if (!row.name.trim()) {
    issues.push("Customer name is required.");
  }

  const status = parseBulkCustomerStatus(row.status);
  if (row.status.trim() && !status) {
    issues.push("Status must be Active, Inactive, or Prospect.");
  }

  if (row.email.trim() && !EMAIL_PATTERN.test(row.email.trim())) {
    issues.push("Email must be a valid email address.");
  }

  return {
    lineNumber,
    ...row,
    isValid: issues.length === 0,
    issues,
  };
}

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

export type CustomerContactRow = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  notes: string;
};

export type CustomerDetailView = {
  id: string;
  name: string;
  status: string;
  statusVariant: CustomerRow["statusVariant"];
  primaryContact: string;
  phone: string;
  email: string;
  address: string;
  town: string;
  state: string;
  zip: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  contacts: CustomerContactRow[];
  relatedJobs: CustomerRelatedJob[];
  relatedQuotes: CustomerRelatedQuote[];
  relatedDeliveryTickets: CustomerRelatedDeliveryTicket[];
};
