"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CustomerStatus,
  AppPermission,
  Prisma,
} from "@/app/generated/prisma/client";
import { parseBulkCustomerStatus } from "@/components/customers/customer-utils";
import { findSimilarCustomers as rankSimilarCustomers } from "@/lib/customer-name-similarity";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  isNextRedirectError,
  translatePrismaError,
} from "@/lib/server/action-errors";
import {
  getEnum,
  getOptionalString,
  getRequiredString,
} from "@/lib/server/form-data";

export type SimilarCustomerMatch = {
  id: string;
  name: string;
  score: number;
};

const CUSTOMER_STATUSES = Object.values(CustomerStatus);

type CustomerRecordInput = {
  name: string;
  nickname: string | null;
  status: CustomerStatus;
  phone: string | null;
  address: string | null;
  town: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
};

function parseCustomerFormData(formData: FormData): CustomerRecordInput {
  const name = getRequiredString(formData, "name", "Customer name");
  const nickname = getOptionalString(formData, "nickname");
  const status = getEnum(formData, "status", CUSTOMER_STATUSES, {
    label: "status",
  });
  const phone = getOptionalString(formData, "phone");
  const address = getOptionalString(formData, "address");
  const town = getOptionalString(formData, "town");
  const state = getOptionalString(formData, "state");
  const zip = getOptionalString(formData, "zip");
  const notes = getOptionalString(formData, "notes");

  return {
    name,
    nickname,
    status,
    phone,
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

export async function createCustomer(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  try {
    const data = parseCustomerFormData(formData);
    const confirmSimilar = formData.get("confirmSimilar") === "true";

    if (!confirmSimilar) {
      const matches = await loadSimilarCustomerMatches(data.name);
      if (matches.length > 0) {
        return {
          error:
            "A customer with a similar name already exists. Review the matches or confirm to create anyway.",
        };
      }
    }

    await prisma.customer.create({ data });

    revalidatePath("/customers");
    redirect("/customers");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { error: translatePrismaError(error).message };
  }
}

export async function updateCustomer(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "Customer id is required." };
  }

  try {
    const data = parseCustomerFormData(formData);

    await prisma.customer.update({
      where: { id },
      data,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    redirect(`/customers/${id}`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { error: translatePrismaError(error).message };
  }
}

export async function deleteCustomer(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "Customer id is required." };
  }

  try {
    // The count check and the delete run in one transaction so a job created
    // between them can't slip through; the FK constraint (P2003) is the
    // backstop either way.
    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
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

      await tx.customer.delete({ where: { id } });
    });

    revalidatePath("/customers");
    redirect("/customers");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        error:
          "This customer has jobs or quotes attached and can't be deleted.",
      };
    }
    return { error: translatePrismaError(error).message };
  }
}

type BulkImportRow = {
  name?: string;
  status?: string;
  phone?: string;
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

  return {
    name,
    nickname: null,
    status: statusRaw as CustomerStatus,
    phone: String(row.phone ?? "").trim() || null,
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

  // Reject duplicate names within the batch: with per-row create-by-name
  // logic they would be ambiguous, and they're almost always a paste mistake.
  const seenNames = new Map<string, number>();
  customers.forEach((row, index) => {
    const key = row.name.toLowerCase();
    const firstLine = seenNames.get(key);
    if (firstLine !== undefined) {
      throw new Error(
        `Line ${index + 1}: "${row.name}" appears more than once in this batch (first on line ${firstLine}). Remove the duplicate and try again.`,
      );
    }
    seenNames.set(key, index + 1);
  });

  // The bulk-paste form catches thrown errors and shows them in its banner,
  // so this action keeps throwing (with translated Prisma messages).
  const imported = await prisma.$transaction(async (tx) => {
    // Skip rows whose name already exists (a resubmitted paste should not
    // duplicate customers).
    const existing = await tx.customer.findMany({
      where: { name: { in: customers.map((row) => row.name) } },
      select: { name: true },
    });
    const existingNames = new Set(
      existing.map((row) => row.name.toLowerCase()),
    );

    const toCreate = customers.filter(
      (row) => !existingNames.has(row.name.toLowerCase()),
    );
    if (toCreate.length > 0) {
      await tx.customer.createMany({ data: toCreate });
    }

    return toCreate.length;
  }).catch((error) => {
    throw translatePrismaError(error);
  });

  if (imported === 0) {
    throw new Error(
      "All customers in this batch already exist — nothing was imported.",
    );
  }

  revalidatePath("/customers");
  return { imported };
}
