"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CustomerStatus, AppPermission } from "@/app/generated/prisma/client";
import { parseBulkCustomerStatus } from "@/components/customers/customer-utils";
import { findSimilarCustomers as rankSimilarCustomers } from "@/lib/customer-name-similarity";
import {
  syncCustomerHeaderFromPrimaryContact,
  upsertPrimaryContactFromHeader,
} from "@/lib/customer-contact-sync";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getEnum,
  getOptionalString,
  getRequiredString,
} from "@/lib/server/form-data";
import { isValidEmail } from "@/lib/validation/email";

export type SimilarCustomerMatch = {
  id: string;
  name: string;
  score: number;
};

const CUSTOMER_STATUSES = Object.values(CustomerStatus);

type CustomerRecordInput = {
  name: string;
  status: CustomerStatus;
  primaryContactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  town: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
};

function parseCustomerFormData(formData: FormData): CustomerRecordInput {
  const name = getRequiredString(formData, "name", "Customer name");
  const status = getEnum(formData, "status", CUSTOMER_STATUSES, {
    label: "status",
  });
  const primaryContactName = getOptionalString(formData, "primaryContactName");
  const phone = getOptionalString(formData, "phone");
  const emailRaw = String(formData.get("email") ?? "").trim();
  if (emailRaw && !isValidEmail(emailRaw)) {
    throw new Error("Email must be a valid email address.");
  }
  const email = emailRaw || null;
  const address = getOptionalString(formData, "address");
  const town = getOptionalString(formData, "town");
  const state = getOptionalString(formData, "state");
  const zip = getOptionalString(formData, "zip");
  const notes = getOptionalString(formData, "notes");

  return {
    name,
    status,
    primaryContactName,
    phone,
    email,
    address,
    town,
    state,
    zip,
    notes,
  };
}

async function loadSimilarCustomerMatches(
  name: string,
): Promise<SimilarCustomerMatch[]> {
  const candidates = await prisma.customer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return rankSimilarCustomers(name, candidates);
}

export async function findSimilarCustomers(
  name: string,
): Promise<SimilarCustomerMatch[]> {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return [];
  }

  return loadSimilarCustomerMatches(trimmed);
}

export async function checkBulkCustomerDbDuplicates(
  names: string[],
): Promise<Record<string, string>> {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const candidates = await prisma.customer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const result: Record<string, string> = {};
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      continue;
    }
    const matches = rankSimilarCustomers(trimmed, candidates, { limit: 1 });
    if (matches.length > 0) {
      result[name] = matches[0].name;
    }
  }

  return result;
}

export async function createCustomer(formData: FormData) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const data = parseCustomerFormData(formData);
  const confirmSimilar = formData.get("confirmSimilar") === "true";

  if (!confirmSimilar) {
    const matches = await loadSimilarCustomerMatches(data.name);
    if (matches.length > 0) {
      throw new Error(
        "A customer with a similar name already exists. Review the matches or confirm to create anyway.",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({ data });

    await upsertPrimaryContactFromHeader(tx, customer.id, {
      name: data.primaryContactName,
      phone: data.phone,
      email: data.email,
    });

    await syncCustomerHeaderFromPrimaryContact(tx, customer.id);
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(formData: FormData) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Customer id is required.");
  }

  const data = parseCustomerFormData(formData);

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id },
      data,
    });

    await upsertPrimaryContactFromHeader(tx, id, {
      name: data.primaryContactName,
      phone: data.phone,
      email: data.email,
    });

    await syncCustomerHeaderFromPrimaryContact(tx, id);
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(formData: FormData) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Customer id is required.");
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: {
        select: { jobs: true },
      },
    },
  });

  if (!customer) {
    throw new Error("Customer not found.");
  }

  if (customer._count.jobs > 0) {
    throw new Error("Cannot delete a customer that has jobs assigned.");
  }

  await prisma.customer.delete({ where: { id } });

  revalidatePath("/customers");
  redirect("/customers");
}

type BulkImportRow = {
  name?: string;
  status?: string;
  primaryContactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  town?: string;
  state?: string;
  zip?: string;
  notes?: string;
};

function mapBulkImportRow(row: BulkImportRow, lineNumber: number): CustomerRecordInput {
  const name = String(row.name ?? "").trim();
  if (!name) {
    throw new Error(`Line ${lineNumber}: customer name is required.`);
  }

  const statusRaw = parseBulkCustomerStatus(String(row.status ?? ""));
  if (!statusRaw || !CUSTOMER_STATUSES.includes(statusRaw as CustomerStatus)) {
    throw new Error(
      `Line ${lineNumber}: status must be Active, Inactive, or Prospect.`,
    );
  }

  const emailRaw = String(row.email ?? "").trim();
  if (emailRaw && !isValidEmail(emailRaw)) {
    throw new Error(`Line ${lineNumber}: email must be a valid email address.`);
  }

  return {
    name,
    status: statusRaw as CustomerStatus,
    primaryContactName: String(row.primaryContactName ?? "").trim() || null,
    phone: String(row.phone ?? "").trim() || null,
    email: emailRaw || null,
    address: String(row.address ?? "").trim() || null,
    town: String(row.town ?? "").trim() || null,
    state: String(row.state ?? "").trim() || null,
    zip: String(row.zip ?? "").trim() || null,
    notes: String(row.notes ?? "").trim() || null,
  };
}

export type ImportCustomersResult = { imported: number };

export async function importCustomers(
  formData: FormData,
): Promise<ImportCustomersResult> {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const raw = String(formData.get("customers") ?? "").trim();
  if (!raw) {
    throw new Error("No customers to import.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid import data.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("No customers to import.");
  }

  const customers = parsed.map((row, index) =>
    mapBulkImportRow(row as BulkImportRow, index + 1),
  );

  await prisma.$transaction(async (tx) => {
    await tx.customer.createMany({ data: customers });

    for (const row of customers) {
      const created = await tx.customer.findFirst({
        where: { name: row.name },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (!created) {
        continue;
      }

      await upsertPrimaryContactFromHeader(tx, created.id, {
        name: row.primaryContactName,
        phone: row.phone,
        email: row.email,
      });
      await syncCustomerHeaderFromPrimaryContact(tx, created.id);
    }
  });

  revalidatePath("/customers");
  return { imported: customers.length };
}
