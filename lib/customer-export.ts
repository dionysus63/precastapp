import type { Customer } from "@/app/generated/prisma/client";
import { customerStatusFormOptions } from "@/components/customers/customer-utils";
import {
  buildWorkbookBuffer,
  formatExportDate,
  formatOptionalString,
} from "@/lib/excel-export";
import { prisma } from "@/lib/prisma";

const customerStatusLabels = Object.fromEntries(
  customerStatusFormOptions.map((option) => [option.value, option.label]),
) as Record<string, string>;

export const customerExportHeaders = [
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
  "Customer ID",
  "Created",
  "Updated",
] as const;

function mapCustomerToExportRow(customer: Customer): unknown[] {
  return [
    customer.name,
    customerStatusLabels[customer.status] ?? customer.status,
    formatOptionalString(customer.primaryContactName),
    formatOptionalString(customer.phone),
    formatOptionalString(customer.email),
    formatOptionalString(customer.address),
    formatOptionalString(customer.town),
    formatOptionalString(customer.state),
    formatOptionalString(customer.zip),
    formatOptionalString(customer.notes),
    customer.id,
    formatExportDate(customer.createdAt),
    formatExportDate(customer.updatedAt),
  ];
}

export async function buildCustomersExportBuffer(): Promise<Buffer> {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
  });

  return buildWorkbookBuffer(
    [...customerExportHeaders],
    customers.map(mapCustomerToExportRow),
  );
}
