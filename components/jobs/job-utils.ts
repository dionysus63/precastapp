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
