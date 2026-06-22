import type { Prisma } from "@/app/generated/prisma/client";

type DbClient = {
  contact: {
    findFirst: (args: {
      where: { customerId: string; isPrimary?: boolean };
      orderBy?:
        | { createdAt: "asc" }
        | Array<{ isPrimary: "desc" } | { name: "asc" }>;
    }) => Promise<{
      id: string;
      name: string;
      title: string | null;
      email: string | null;
      phone: string | null;
    } | null>;
    findUnique?: (args: unknown) => Promise<unknown>;
    create: (args: {
      data: {
        customerId: string;
        name: string;
        phone: string | null;
        email: string | null;
        isPrimary: boolean;
        title?: string | null;
      };
    }) => Promise<unknown>;
    update: (args: {
      where: { id: string };
      data: {
        name: string;
        phone: string | null;
        email: string | null;
      };
    }) => Promise<unknown>;
    count: (args: { where: { customerId: string } }) => Promise<number>;
  };
  customer: {
    findUnique: (args: {
      where: { id: string };
      select?: {
        id: true;
        primaryContactName: true;
        phone: true;
        email: true;
      };
    }) => Promise<{
      id: string;
      primaryContactName: string | null;
      phone: string | null;
      email: string | null;
    } | null>;
    update: (args: {
      where: { id: string };
      data: {
        primaryContactName: string | null;
        phone: string | null;
        email: string | null;
      };
    }) => Promise<unknown>;
  };
};

export async function syncCustomerHeaderFromPrimaryContact(
  client: DbClient | Prisma.TransactionClient,
  customerId: string,
) {
  const primary = await client.contact.findFirst({
    where: { customerId, isPrimary: true },
    orderBy: { createdAt: "asc" },
  });

  await client.customer.update({
    where: { id: customerId },
    data: {
      primaryContactName: primary?.name ?? null,
      phone: primary?.phone ?? null,
      email: primary?.email ?? null,
    },
  });
}

export type PrimaryContactInput = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

export function hasPrimaryContactData(input: PrimaryContactInput) {
  return Boolean(
    input.name?.trim() || input.phone?.trim() || input.email?.trim(),
  );
}

export async function upsertPrimaryContactFromHeader(
  client: Prisma.TransactionClient | DbClient,
  customerId: string,
  input: PrimaryContactInput,
) {
  if (!hasPrimaryContactData(input)) {
    return;
  }

  const name = input.name?.trim() || "Primary Contact";
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;

  const existing = await client.contact.findFirst({
    where: { customerId, isPrimary: true },
  });

  if (existing) {
    await client.contact.update({
      where: { id: existing.id },
      data: { name, phone, email },
    });
    return;
  }

  await client.contact.create({
    data: {
      customerId,
      name,
      phone,
      email,
      isPrimary: true,
    },
  });
}

export async function ensurePrimaryContactBackfill(
  client: Prisma.TransactionClient | DbClient,
  customerId: string,
) {
  const customer = await client.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      primaryContactName: true,
      phone: true,
      email: true,
    },
  });

  if (!customer) {
    return;
  }

  const contactCount = await client.contact.count({
    where: { customerId },
  });

  if (contactCount > 0) {
    return;
  }

  await upsertPrimaryContactFromHeader(client, customerId, {
    name: customer.primaryContactName,
    phone: customer.phone,
    email: customer.email,
  });
}

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

export async function getPrimaryContactForCustomer(
  client: Prisma.TransactionClient | DbClient,
  customerId: string,
): Promise<ContactSnapshot | null> {
  const primary = await client.contact.findFirst({
    where: { customerId, isPrimary: true },
    orderBy: { createdAt: "asc" },
  });

  if (primary) {
    return contactToSnapshot(primary);
  }

  const fallback = await client.contact.findFirst({
    where: { customerId },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  return fallback ? contactToSnapshot(fallback) : null;
}
