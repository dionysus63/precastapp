"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  ensurePrimaryContactBackfill,
  syncCustomerHeaderFromPrimaryContact,
} from "@/lib/customer-contact-sync";
import { withDatabaseRetry } from "@/lib/prisma";

import { isValidEmail } from "@/lib/validation/email";

export type CustomerContactInput = {
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

function validateContactInput(input: CustomerContactInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Contact name is required.");
  }

  const phone = input.phone?.trim() || null;
  const emailRaw = input.email?.trim() || "";
  if (emailRaw && !isValidEmail(emailRaw)) {
    throw new Error("Email must be a valid email address.");
  }

  if (!phone && !emailRaw) {
    throw new Error("Contact must have at least a phone number or email.");
  }

  return {
    name,
    title: input.title?.trim() || null,
    phone,
    email: emailRaw || null,
    notes: input.notes?.trim() || null,
  };
}

function revalidateCustomerPaths(customerId: string) {
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/quotes/new");
}

export async function addCustomerContact(
  customerId: string,
  input: CustomerContactInput,
) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  try {
    const data = validateContactInput(input);

    await withDatabaseRetry(async (client) => {
      const customer = await client.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error("Customer was not found.");
      }

      const existingCount = await client.contact.count({
        where: { customerId },
      });

      await client.contact.create({
        data: {
          customerId,
          ...data,
          isPrimary: existingCount === 0,
        },
      });

      await syncCustomerHeaderFromPrimaryContact(client, customerId);
    });

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not add contact.",
    };
  }
}

export async function updateCustomerContact(
  contactId: string,
  input: CustomerContactInput,
) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  try {
    const data = validateContactInput(input);

    const customerId = await withDatabaseRetry(async (client) => {
      const contact = await client.contact.findUnique({
        where: { id: contactId },
        select: { id: true, customerId: true },
      });
      if (!contact) {
        throw new Error("Contact was not found.");
      }

      await client.contact.update({
        where: { id: contactId },
        data,
      });

      await syncCustomerHeaderFromPrimaryContact(client, contact.customerId);
      return contact.customerId;
    });

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update contact.",
    };
  }
}

export async function deleteCustomerContact(contactId: string) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  try {
    const customerId = await withDatabaseRetry(async (client) => {
      const contact = await client.contact.findUnique({
        where: { id: contactId },
        select: { id: true, customerId: true, isPrimary: true },
      });
      if (!contact) {
        throw new Error("Contact was not found.");
      }

      await client.quote.updateMany({
        where: { contactId },
        data: { contactId: null },
      });

      await client.contact.delete({ where: { id: contactId } });

      const remaining = await client.contact.count({
        where: { customerId: contact.customerId },
      });

      if (remaining > 0 && contact.isPrimary) {
        const nextPrimary = await client.contact.findFirst({
          where: { customerId: contact.customerId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (nextPrimary) {
          await client.contact.update({
            where: { id: nextPrimary.id },
            data: { isPrimary: true },
          });
        }
      }

      await syncCustomerHeaderFromPrimaryContact(client, contact.customerId);
      return contact.customerId;
    });

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not delete contact.",
    };
  }
}

export async function setPrimaryCustomerContact(contactId: string) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  try {
    const customerId = await withDatabaseRetry(async (client) => {
      const contact = await client.contact.findUnique({
        where: { id: contactId },
        select: { id: true, customerId: true },
      });
      if (!contact) {
        throw new Error("Contact was not found.");
      }

      await client.contact.updateMany({
        where: { customerId: contact.customerId },
        data: { isPrimary: false },
      });
      await client.contact.update({
        where: { id: contactId },
        data: { isPrimary: true },
      });

      await syncCustomerHeaderFromPrimaryContact(client, contact.customerId);
      return contact.customerId;
    });

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not set primary contact.",
    };
  }
}

export async function backfillCustomerContacts(customerId: string) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  await withDatabaseRetry(async (client) => {
    await ensurePrimaryContactBackfill(client, customerId);
    await syncCustomerHeaderFromPrimaryContact(client, customerId);
  });

  revalidateCustomerPaths(customerId);
  return { success: true };
}
