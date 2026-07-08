"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, ContactRole } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  assignMissingRoleDefaults,
  promoteRoleDefaultsAfterDelete,
} from "@/lib/customer-contacts";
import { withDatabaseRetry } from "@/lib/prisma";
import { translatePrismaError } from "@/lib/server/action-errors";

import { isValidEmail } from "@/lib/validation/email";

export type CustomerContactInput = {
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  roles?: ContactRole[];
};

const CONTACT_ROLES: readonly ContactRole[] = [
  ContactRole.ESTIMATING,
  ContactRole.BILLING,
  ContactRole.FIELD,
];

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

  const roles = [
    ...new Set((input.roles ?? []).filter((role) => CONTACT_ROLES.includes(role))),
  ];

  return {
    name,
    title: input.title?.trim() || null,
    phone,
    email: emailRaw || null,
    notes: input.notes?.trim() || null,
    roles,
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

    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true },
        });
        if (!customer) {
          throw new Error("Customer was not found.");
        }

        const existingCount = await tx.contact.count({
          where: { customerId },
        });

        const contact = await tx.contact.create({
          data: {
            customerId,
            ...data,
            isPrimary: existingCount === 0,
          },
        });

        await assignMissingRoleDefaults(tx, customerId, contact.id, data.roles);
      }),
    );

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not add contact.",
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

    const customerId = await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const contact = await tx.contact.findUnique({
          where: { id: contactId },
          select: { id: true, customerId: true, roles: true },
        });
        if (!contact) {
          throw new Error("Contact was not found.");
        }

        await tx.contact.update({
          where: { id: contactId },
          data,
        });

        // Roles removed from this contact release their default slots so
        // another contact holding the role can take over.
        const removedRoles = contact.roles.filter(
          (role) => !data.roles.includes(role),
        );
        if (removedRoles.length > 0) {
          await tx.customerContactRoleDefault.deleteMany({
            where: {
              customerId: contact.customerId,
              contactId,
              role: { in: removedRoles },
            },
          });
          await promoteRoleDefaultsAfterDelete(
            tx,
            contact.customerId,
            removedRoles,
          );
        }

        await assignMissingRoleDefaults(
          tx,
          contact.customerId,
          contactId,
          data.roles,
        );
        return contact.customerId;
      }),
    );

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not update contact.",
    };
  }
}

export async function deleteCustomerContact(contactId: string) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  try {
    const customerId = await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const contact = await tx.contact.findUnique({
          where: { id: contactId },
          select: {
            id: true,
            customerId: true,
            isPrimary: true,
            roleDefaults: { select: { role: true } },
          },
        });
        if (!contact) {
          throw new Error("Contact was not found.");
        }

        await tx.quote.updateMany({
          where: { contactId },
          data: { contactId: null },
        });

        // Role-default rows cascade with the contact delete.
        const orphanedRoles = contact.roleDefaults.map((d) => d.role);
        await tx.contact.delete({ where: { id: contactId } });

        if (contact.isPrimary) {
          const nextPrimary = await tx.contact.findFirst({
            where: { customerId: contact.customerId },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          });
          if (nextPrimary) {
            await tx.contact.update({
              where: { id: nextPrimary.id },
              data: { isPrimary: true },
            });
          }
        }

        await promoteRoleDefaultsAfterDelete(
          tx,
          contact.customerId,
          orphanedRoles,
        );
        return contact.customerId;
      }),
    );

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not delete contact.",
    };
  }
}

export async function setPrimaryCustomerContact(contactId: string) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  try {
    const customerId = await withDatabaseRetry((client) =>
      // One transaction: without it, two admins setting different primaries
      // concurrently can interleave the clear/set steps and leave the
      // customer with two primary contacts.
      client.$transaction(async (tx) => {
        const contact = await tx.contact.findUnique({
          where: { id: contactId },
          select: { id: true, customerId: true },
        });
        if (!contact) {
          throw new Error("Contact was not found.");
        }

        await tx.contact.updateMany({
          where: { customerId: contact.customerId },
          data: { isPrimary: false },
        });
        await tx.contact.update({
          where: { id: contactId },
          data: { isPrimary: true },
        });

        return contact.customerId;
      }),
    );

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not set primary contact.",
    };
  }
}

export type BulkContactDbState = {
  /** Pasted customer names (lowercased) that don't match any customer. */
  unknownCustomers: string[];
  /** "customer::contact" keys (lowercased) that already exist. */
  existingContacts: string[];
};

/** Preview-time DB check for the bulk contact paste: which pasted customer
 * names are unknown, and which customer+contact pairs already exist. */
export async function checkBulkContactDbState(
  rows: { customer: string; name: string }[],
): Promise<BulkContactDbState> {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  const customerNames = [
    ...new Set(rows.map((row) => row.customer.trim()).filter(Boolean)),
  ];
  if (customerNames.length === 0) {
    return { unknownCustomers: [], existingContacts: [] };
  }

  return withDatabaseRetry(async (client) => {
    const customers = await client.customer.findMany({
      where: {
        OR: customerNames.map((name) => ({
          name: { equals: name, mode: "insensitive" as const },
        })),
      },
      select: {
        name: true,
        contacts: { select: { name: true } },
      },
    });

    const byLowerName = new Map(
      customers.map((customer) => [customer.name.toLowerCase(), customer]),
    );

    const unknownCustomers = customerNames
      .filter((name) => !byLowerName.has(name.toLowerCase()))
      .map((name) => name.toLowerCase());

    const existingContacts: string[] = [];
    for (const row of rows) {
      const customer = byLowerName.get(row.customer.trim().toLowerCase());
      if (!customer) continue;
      const contactName = row.name.trim().toLowerCase();
      if (
        customer.contacts.some(
          (contact) => contact.name.toLowerCase() === contactName,
        )
      ) {
        existingContacts.push(
          `${row.customer.trim().toLowerCase()}::${contactName}`,
        );
      }
    }

    return { unknownCustomers, existingContacts };
  });
}

type BulkContactImportRow = {
  customer?: string;
  name?: string;
  title?: string;
  roles?: string[];
  phone?: string;
  email?: string;
  notes?: string;
};

export type ImportContactsResult = {
  imported: number;
  skippedUnknownCustomer: number;
  skippedExisting: number;
};

export async function importContacts(
  formData: FormData,
): Promise<ImportContactsResult> {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);
  const raw = String(formData.get("contacts") ?? "").trim();
  if (!raw) {
    throw new Error("No contacts to import.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid import data.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("No contacts to import.");
  }

  const rows = (parsed as BulkContactImportRow[]).map((row, index) => {
    const lineNumber = index + 1;
    const customer = String(row.customer ?? "").trim();
    const name = String(row.name ?? "").trim();
    if (!customer) {
      throw new Error(`Line ${lineNumber}: customer name is required.`);
    }
    if (!name) {
      throw new Error(`Line ${lineNumber}: contact name is required.`);
    }
    const phone = String(row.phone ?? "").trim() || null;
    const email = String(row.email ?? "").trim() || null;
    if (!phone && !email) {
      throw new Error(
        `Line ${lineNumber}: contact must have at least a phone number or email.`,
      );
    }
    if (email && !isValidEmail(email)) {
      throw new Error(
        `Line ${lineNumber}: email must be a valid email address.`,
      );
    }
    const roles = [
      ...new Set(
        (Array.isArray(row.roles) ? row.roles : []).filter(
          (role): role is ContactRole =>
            CONTACT_ROLES.includes(role as ContactRole),
        ),
      ),
    ];

    return {
      customer,
      name,
      title: String(row.title ?? "").trim() || null,
      phone,
      email,
      notes: String(row.notes ?? "").trim() || null,
      roles,
    };
  });

  const result = await withDatabaseRetry((client) =>
    client
      .$transaction(
        async (tx) => {
          const customerNames = [...new Set(rows.map((row) => row.customer))];
          const customers = await tx.customer.findMany({
            where: {
              OR: customerNames.map((name) => ({
                name: { equals: name, mode: "insensitive" as const },
              })),
            },
            select: {
              id: true,
              name: true,
              contacts: { select: { id: true, name: true } },
            },
          });
          const byLowerName = new Map(
            customers.map((customer) => [
              customer.name.toLowerCase(),
              customer,
            ]),
          );

          let imported = 0;
          let skippedUnknownCustomer = 0;
          let skippedExisting = 0;
          const createdNamesByCustomer = new Map<string, Set<string>>();

          for (const row of rows) {
            const customer = byLowerName.get(row.customer.toLowerCase());
            if (!customer) {
              skippedUnknownCustomer += 1;
              continue;
            }

            const contactKey = row.name.toLowerCase();
            const createdNames =
              createdNamesByCustomer.get(customer.id) ?? new Set<string>();
            const alreadyExists =
              customer.contacts.some(
                (contact) => contact.name.toLowerCase() === contactKey,
              ) || createdNames.has(contactKey);
            if (alreadyExists) {
              skippedExisting += 1;
              continue;
            }

            const contact = await tx.contact.create({
              data: {
                customerId: customer.id,
                name: row.name,
                title: row.title,
                phone: row.phone,
                email: row.email,
                notes: row.notes,
                roles: row.roles,
                // First contact for the customer becomes Main, like the
                // single add-contact flow.
                isPrimary:
                  customer.contacts.length === 0 && createdNames.size === 0,
              },
            });
            imported += 1;
            createdNames.add(contactKey);
            createdNamesByCustomer.set(customer.id, createdNames);

            await assignMissingRoleDefaults(
              tx,
              customer.id,
              contact.id,
              row.roles,
            );
          }

          return { imported, skippedUnknownCustomer, skippedExisting };
        },
        // Big first loads can be hundreds of sequential creates.
        { timeout: 60_000 },
      )
      .catch((error) => {
        throw translatePrismaError(error);
      }),
  );

  if (result.imported === 0) {
    throw new Error(
      "Nothing was imported — every row was skipped (unknown customer or the contact already exists).",
    );
  }

  revalidatePath("/customers");
  return result;
}

export async function setRoleDefaultContact(
  contactId: string,
  role: ContactRole,
) {
  await requirePermission(AppPermission.CUSTOMERS_MANAGE);

  try {
    const customerId = await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const contact = await tx.contact.findUnique({
          where: { id: contactId },
          select: { id: true, customerId: true, roles: true },
        });
        if (!contact) {
          throw new Error("Contact was not found.");
        }

        // Setting a contact as a role default also tags it with the role so
        // the chips and the star never disagree.
        if (!contact.roles.includes(role)) {
          await tx.contact.update({
            where: { id: contactId },
            data: { roles: { push: role } },
          });
        }

        await tx.customerContactRoleDefault.upsert({
          where: {
            customerId_role: { customerId: contact.customerId, role },
          },
          create: { customerId: contact.customerId, role, contactId },
          update: { contactId },
        });

        return contact.customerId;
      }),
    );

    revalidateCustomerPaths(customerId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not set default contact.",
    };
  }
}
