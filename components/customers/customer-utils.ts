export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  town: string;
  status: string;
  statusVariant: import("@/lib/status-variants").StatusVariant;
  openQuotes: number;
  balance: string;
  lastActivity: string;
};

export const contactRoleOptions = [
  { value: "ESTIMATING", label: "Estimating" },
  { value: "BILLING", label: "Billing" },
  { value: "FIELD", label: "Field" },
] as const;

export type ContactRoleValue = (typeof contactRoleOptions)[number]["value"];

export const contactRoleLabels: Record<string, string> = Object.fromEntries(
  contactRoleOptions.map((option) => [option.value, option.label]),
);

/** Accepts pasted role tokens: est/estimating, bill/billing/ap, field/site. */
export function parseContactRoleToken(token: string): ContactRoleValue | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  if (["estimating", "est", "estimator", "bidding", "bid"].includes(t)) {
    return "ESTIMATING";
  }
  if (["billing", "bill", "ap", "accounting", "office"].includes(t)) {
    return "BILLING";
  }
  if (["field", "site", "foreman"].includes(t)) {
    return "FIELD";
  }
  return null;
}

/**
 * Parses a pasted roles cell ("est, billing" / "field/site") into role
 * values. Unknown tokens are returned so the row can be flagged.
 */
export function parseContactRolesCell(cell: string): {
  roles: ContactRoleValue[];
  invalidTokens: string[];
} {
  const roles: ContactRoleValue[] = [];
  const invalidTokens: string[] = [];
  for (const token of cell.split(/[,/;+&]/)) {
    if (!token.trim()) continue;
    const role = parseContactRoleToken(token);
    if (role) {
      if (!roles.includes(role)) roles.push(role);
    } else {
      invalidTokens.push(token.trim());
    }
  }
  return { roles, invalidTokens };
}

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
  phone: string;
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
  "Phone",
  "Address",
  "Town",
  "State",
  "Zip",
  "Notes",
];

export const bulkPasteExample = `Smith Construction LLC\tActive\t631-555-0100\t123 Main St\tBrookhaven\tNY\t11719\tGeneral contractor
Bay Shore Pools\tProspect\t631-555-0200\t45 Ocean Ave\tBay Shore\tNY\t11706\t
`;

import { isValidEmail } from "@/lib/validation/email";

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

export function bulkPasteRowKey(row: { name: string }): string {
  return row.name.trim().toLowerCase();
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

  return {
    lineNumber,
    ...row,
    isValid: issues.length === 0,
    issues,
  };
}

export type BulkContactPasteRow = {
  lineNumber: number;
  customer: string;
  name: string;
  title: string;
  rolesRaw: string;
  roles: ContactRoleValue[];
  phone: string;
  email: string;
  notes: string;
  isValid: boolean;
  issues: string[];
};

export const bulkContactColumnHeaders = [
  "Customer",
  "Name",
  "Title",
  "Roles",
  "Phone",
  "Email",
  "Notes",
];

export const bulkContactExample = `Smith Construction LLC\tJohn Smith\tOwner\tEstimating, Billing\t631-555-0100\tjohn@smith.com\tPrefers email
Smith Construction LLC\tPete Ryan\tForeman\tField\t631-555-0111\t\t
Bay Shore Pools\tMaria Lopez\tOffice Manager\tBilling\t631-555-0200\tmaria@bayshore.com\t
`;

export function bulkContactRowKey(row: {
  customer: string;
  name: string;
}): string {
  return `${row.customer.trim().toLowerCase()}::${row.name.trim().toLowerCase()}`;
}

export function validateBulkContactPasteRow(
  row: Omit<BulkContactPasteRow, "isValid" | "issues" | "lineNumber" | "roles">,
  lineNumber: number,
): BulkContactPasteRow {
  const issues: string[] = [];

  if (!row.customer.trim()) {
    issues.push("Customer name is required.");
  }
  if (!row.name.trim()) {
    issues.push("Contact name is required.");
  }
  if (!row.phone.trim() && !row.email.trim()) {
    issues.push("Contact must have at least a phone number or email.");
  }
  if (row.email.trim() && !isValidEmail(row.email.trim())) {
    issues.push("Email must be a valid email address.");
  }

  const { roles, invalidTokens } = parseContactRolesCell(row.rolesRaw);
  if (invalidTokens.length > 0) {
    issues.push(
      `Unknown role${invalidTokens.length === 1 ? "" : "s"}: ${invalidTokens.join(", ")}. Use Estimating, Billing, or Field.`,
    );
  }

  return {
    lineNumber,
    ...row,
    roles,
    isValid: issues.length === 0,
    issues,
  };
}

export function markBulkContactDuplicateRows(
  rows: BulkContactPasteRow[],
): BulkContactPasteRow[] {
  const seen = new Map<string, number>();

  return rows.map((row) => {
    if (!row.customer.trim() || !row.name.trim()) {
      return row;
    }

    const key = bulkContactRowKey(row);
    const firstLine = seen.get(key);
    if (firstLine == null) {
      seen.set(key, row.lineNumber);
      return row;
    }

    return {
      ...row,
      isValid: false,
      issues: [
        ...row.issues,
        `Duplicate row in paste (same as line ${firstLine}).`,
      ],
    };
  });
}

export type CustomerRelatedJob = {
  id: string;
  jobNumber: string;
  projectName: string;
  status: string;
  statusVariant: import("@/lib/status-variants").StatusVariant;
  lastActivity: string;
};

export type CustomerRelatedQuote = {
  id: string;
  quoteNumber: string;
  projectName: string;
  status: string;
  statusLabel: string;
  statusVariant: import("@/lib/status-variants").StatusVariant;
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

export type CustomerRelatedInvoice = {
  id: string;
  invoiceNumber: string;
  statusLabel: string;
  statusVariant: import("@/lib/status-variants").StatusVariant;
  total: string;
  invoiceDate: string;
};

export type CustomerContactRow = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  roles: ContactRoleValue[];
  /** Roles this contact is the customer's default for. */
  defaultForRoles: ContactRoleValue[];
  notes: string;
};

export type CustomerDetailStats = {
  openJobs: number;
  totalJobs: number;
  openQuotes: number;
  totalQuotes: number;
  scheduledTickets: number;
  totalTickets: number;
  unpaidInvoices: number;
  totalInvoices: number;
  unpaidTotal: string;
};

export type CustomerDetailView = {
  id: string;
  name: string;
  status: string;
  statusVariant: CustomerRow["statusVariant"];
  stats: CustomerDetailStats;
  phone: string;
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
  relatedInvoices: CustomerRelatedInvoice[];
};
