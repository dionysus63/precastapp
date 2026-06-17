import type { Customer } from "@/app/generated/prisma/client";
import type { CustomerRow } from "@/components/customers/customer-utils";

const customerTypeLabels: Record<string, string> = {
  COMMERCIAL: "Commercial",
  RESIDENTIAL: "Residential",
  CONTRACTOR: "Contractor",
  OTHER: "Other",
};

const customerStatusLabels: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PROSPECT: "Prospect",
};

function typeVariant(type: string): CustomerRow["typeVariant"] {
  switch (type) {
    case "COMMERCIAL":
      return "info";
    case "RESIDENTIAL":
      return "neutral";
    default:
      return "default";
  }
}

function statusVariant(status: string): CustomerRow["statusVariant"] {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PROSPECT":
      return "warning";
    default:
      return "neutral";
  }
}

export function formatCustomerDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDate(date: Date) {
  return formatCustomerDate(date);
}

export function mapCustomerToRow(customer: Customer): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    type: customerTypeLabels[customer.customerType] ?? customer.customerType,
    typeVariant: typeVariant(customer.customerType),
    primaryContact: customer.primaryContactName ?? "—",
    phone: customer.phone ?? "—",
    email: customer.email ?? "—",
    status: customerStatusLabels[customer.status] ?? customer.status,
    statusVariant: statusVariant(customer.status),
    openQuotes: 0,
    balance: "$0",
    lastActivity: formatDate(customer.updatedAt),
  };
}
