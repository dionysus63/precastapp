import type {
  ContactRole,
  PrismaClient,
  Prisma,
} from "@/app/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ContactSnapshot = {
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
};

export function contactToSnapshot(contact: {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}): ContactSnapshot {
  return {
    contactId: contact.id,
    contactName: contact.name,
    contactEmail: contact.email,
    contactPhone: contact.phone,
    contactTitle: contact.title,
  };
}

/**
 * General fallback contact: the "Main" contact, else the first by name.
 */
export async function getPrimaryContactForCustomer(
  client: DbClient,
  customerId: string,
): Promise<ContactSnapshot | null> {
  const contact = await client.contact.findFirst({
    where: { customerId },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  return contact ? contactToSnapshot(contact) : null;
}

/**
 * The customer's contact for a role: explicit role default, else the Main
 * contact, else the first contact by name. Callers use this to prefill
 * (quotes -> ESTIMATING, invoices -> BILLING, delivery tickets -> FIELD).
 */
export async function getDefaultContactForRole(
  client: DbClient,
  customerId: string,
  role: ContactRole,
): Promise<ContactSnapshot | null> {
  const roleDefault = await client.customerContactRoleDefault.findUnique({
    where: { customerId_role: { customerId, role } },
    include: { contact: true },
  });

  if (roleDefault) {
    return contactToSnapshot(roleDefault.contact);
  }

  return getPrimaryContactForCustomer(client, customerId);
}

/**
 * Make `contactId` the default for each of its roles the customer doesn't
 * already have a default for. Used when creating/importing contacts so the
 * first estimator/biller/field contact becomes the default without a second
 * step. Never overwrites an existing default.
 */
export async function assignMissingRoleDefaults(
  client: DbClient,
  customerId: string,
  contactId: string,
  roles: readonly ContactRole[],
): Promise<void> {
  for (const role of roles) {
    const existing = await client.customerContactRoleDefault.findUnique({
      where: { customerId_role: { customerId, role } },
      select: { id: true },
    });
    if (!existing) {
      await client.customerContactRoleDefault.create({
        data: { customerId, role, contactId },
      });
    }
  }
}

/**
 * After a contact is deleted (its role-default rows cascade away), promote
 * the next contact holding each orphaned role, mirroring how deleting the
 * Main contact promotes the oldest remaining contact.
 */
export async function promoteRoleDefaultsAfterDelete(
  client: DbClient,
  customerId: string,
  orphanedRoles: readonly ContactRole[],
): Promise<void> {
  for (const role of orphanedRoles) {
    const next = await client.contact.findFirst({
      where: { customerId, roles: { has: role } },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      select: { id: true },
    });
    if (next) {
      await client.customerContactRoleDefault.upsert({
        where: { customerId_role: { customerId, role } },
        create: { customerId, role, contactId: next.id },
        update: { contactId: next.id },
      });
    }
  }
}
