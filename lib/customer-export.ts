import type { Contact, Customer } from "@/app/generated/prisma/client";
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
  "Company Phone",
  "Main Contact",
  "Main Contact Phone",
  "Main Contact Email",
  "Estimating Contact",
  "Billing Contact",
  "Field Contact",
  "Address",
  "Town",
  "State",
  "Zip",
  "Notes",
  "Customer ID",
  "Created",
  "Updated",
] as const;

type CustomerWithContacts = Customer & {
  contacts: Contact[];
  contactRoleDefaults: { role: string; contactId: string }[];
};

function roleContactName(
  customer: CustomerWithContacts,
  role: string,
): string | null {
  const contactId = customer.contactRoleDefaults.find(
    (d) => d.role === role,
  )?.contactId;
  if (!contactId) return null;
  return customer.contacts.find((c) => c.id === contactId)?.name ?? null;
}

function mapCustomerToExportRow(customer: CustomerWithContacts): unknown[] {
  const main =
    customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0] ?? null;

  return [
    customer.name,
    customerStatusLabels[customer.status] ?? customer.status,
    formatOptionalString(customer.phone),
    formatOptionalString(main?.name ?? null),
    formatOptionalString(main?.phone ?? null),
    formatOptionalString(main?.email ?? null),
    formatOptionalString(roleContactName(customer, "ESTIMATING")),
    formatOptionalString(roleContactName(customer, "BILLING")),
    formatOptionalString(roleContactName(customer, "FIELD")),
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
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      contactRoleDefaults: { select: { role: true, contactId: true } },
    },
  });

  return buildWorkbookBuffer(
    [...customerExportHeaders],
    customers.map(mapCustomerToExportRow),
  );
}
