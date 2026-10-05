import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Permission checks run through the real session/permission code: the only
// mocks are the request-scoped cookie store (the token comes from
// `cookieJar.token`) and next/cache. Prisma, transactions and validation run
// real against the scratch database. The "case-variant name already exists"
// skip for importCustomers is covered in customer-guards.test.ts.
const cookieJar = vi.hoisted(() => ({ token: "" }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "precastapp_session" && cookieJar.token
        ? { name, value: cookieJar.token }
        : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import { importCustomers } from "@/app/customers/actions";
import { importContacts } from "@/app/customers/contact-actions";
import { prisma } from "@/lib/prisma";

const tag = `CCIMPORT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

let managerId: string;
let readOnlyId: string;
let managerToken: string;
let readOnlyToken: string;

function customersForm(rows: unknown) {
  const formData = new FormData();
  formData.set("customers", typeof rows === "string" ? rows : JSON.stringify(rows));
  return formData;
}

function contactsForm(rows: unknown) {
  const formData = new FormData();
  formData.set("contacts", typeof rows === "string" ? rows : JSON.stringify(rows));
  return formData;
}

function customersByTag(suffix: string) {
  return prisma.customer.findMany({
    where: { name: { startsWith: `${tag} ${suffix}`, mode: "insensitive" } },
    orderBy: { name: "asc" },
  });
}

beforeAll(async () => {
  const manager = await prisma.user.create({
    data: {
      username: `${tag}-manager`.toLowerCase(),
      displayName: `${tag} Manager`,
      initials: "TM",
      role: "MANAGER",
      // Pin the permission per-user so the test doesn't depend on the
      // scratch database's role settings.
      grantedPermissions: ["CUSTOMERS_MANAGE"],
    },
  });
  managerId = manager.id;
  const readOnly = await prisma.user.create({
    data: {
      username: `${tag}-readonly`.toLowerCase(),
      displayName: `${tag} Read Only`,
      initials: "TR",
      role: "READ_ONLY",
      deniedPermissions: ["CUSTOMERS_MANAGE"],
    },
  });
  readOnlyId = readOnly.id;

  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  managerToken = `${tag}-manager-token`;
  readOnlyToken = `${tag}-readonly-token`;
  await prisma.session.createMany({
    data: [
      { id: `${tag}-manager-sess`, token: managerToken, userId: managerId, expiresAt },
      { id: `${tag}-readonly-sess`, token: readOnlyToken, userId: readOnlyId, expiresAt },
    ],
  });
});

beforeEach(() => {
  cookieJar.token = managerToken;
});

afterAll(async () => {
  // Contacts and role defaults cascade with their customer.
  await prisma.customer.deleteMany({
    where: { name: { startsWith: tag, mode: "insensitive" } },
  });
  await prisma.session.deleteMany({ where: { userId: { in: [managerId, readOnlyId] } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: [managerId, readOnlyId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [managerId, readOnlyId] } } });
  await prisma.$disconnect();
});

describe("importCustomers", () => {
  it("creates valid rows with mapped status and trimmed/blank-to-null fields", async () => {
    const result = await importCustomers(
      customersForm([
        {
          name: `  ${tag} Valid Alpha  `,
          status: "Prospect",
          phone: " 631-555-0100 ",
          town: "Brookhaven",
          state: "NY",
          zip: "",
        },
        { name: `${tag} Valid Beta`, status: "" },
        { name: `${tag} Valid Gamma`, status: "inactive", notes: " note " },
      ]),
    );
    expect(result).toEqual({ imported: 3 });

    const rows = await customersByTag("Valid");
    expect(rows.map((row) => [row.name, row.status])).toEqual([
      [`${tag} Valid Alpha`, "PROSPECT"],
      [`${tag} Valid Beta`, "ACTIVE"],
      [`${tag} Valid Gamma`, "INACTIVE"],
    ]);
    const alpha = rows[0];
    expect(alpha.phone).toBe("631-555-0100");
    expect(alpha.town).toBe("Brookhaven");
    expect(alpha.zip).toBeNull();
    expect(alpha.address).toBeNull();
    expect(rows[2].notes).toBe("note");
  });

  it("rejects a case-variant duplicate inside one batch and creates nothing", async () => {
    const result = await importCustomers(
      customersForm([
        { name: `${tag} Dupe Co`, status: "Active" },
        { name: `${tag} Other Co`, status: "Active" },
        { name: `${tag} DUPE CO`.toUpperCase(), status: "Active" },
      ]),
    );
    expect(result).toEqual({
      error: expect.stringMatching(/^Line 3: .* appears more than once in this batch \(first on line 1\)/),
    });
    expect(await customersByTag("Dupe")).toHaveLength(0);
    expect(await customersByTag("Other")).toHaveLength(0);
  });

  it("returns an error when every row already exists (case-insensitively)", async () => {
    await prisma.customer.create({ data: { name: `${tag} Existing Co` } });
    const result = await importCustomers(
      customersForm([{ name: `${tag} existing co`.toLowerCase(), status: "Active" }]),
    );
    expect(result).toEqual({
      error: "All customers in this batch already exist — nothing was imported.",
    });
    expect(await customersByTag("Existing")).toHaveLength(1);
  });

  it("returns { error } for a row without a name and imports none of the batch", async () => {
    const result = await importCustomers(
      customersForm([
        { name: `${tag} Before Blank`, status: "Active" },
        { name: "   ", status: "Active" },
      ]),
    );
    expect(result).toEqual({ error: "Line 2: customer name is required." });
    expect(await customersByTag("Before Blank")).toHaveLength(0);
  });

  it("returns { error } for an unknown status", async () => {
    const result = await importCustomers(
      customersForm([{ name: `${tag} Bad Status`, status: "Bankrupt" }]),
    );
    expect(result).toEqual({
      error: "Line 1: status must be Active, Inactive, or Prospect.",
    });
    expect(await customersByTag("Bad Status")).toHaveLength(0);
  });

  it("returns { error } for empty, non-array, and malformed payloads", async () => {
    expect(await importCustomers(new FormData())).toEqual({
      error: "No customers to import.",
    });
    expect(await importCustomers(customersForm([]))).toEqual({
      error: "No customers to import.",
    });
    expect(await importCustomers(customersForm({ name: "x" }))).toEqual({
      error: "No customers to import.",
    });
    expect(await importCustomers(customersForm("{not json"))).toEqual({
      error: "Invalid import data.",
    });
  });

  it("returns a permission error for a user without CUSTOMERS_MANAGE", async () => {
    cookieJar.token = readOnlyToken;
    const result = await importCustomers(
      customersForm([{ name: `${tag} Forbidden Co`, status: "Active" }]),
    );
    expect(result).toEqual({ error: "You don't have permission to do that." });
    expect(await customersByTag("Forbidden")).toHaveLength(0);
  });
});

describe("importContacts", () => {
  let acmeId: string;
  let acmeWestId: string;
  let existingCustomerId: string;

  beforeAll(async () => {
    // Two customers whose names share a prefix, to prove matching is exact
    // (case-insensitive) rather than fuzzy.
    acmeId = (await prisma.customer.create({ data: { name: `${tag} Contacts Acme` } })).id;
    acmeWestId = (
      await prisma.customer.create({ data: { name: `${tag} Contacts Acme West` } })
    ).id;
    const existing = await prisma.customer.create({
      data: {
        name: `${tag} Contacts Existing`,
        contacts: {
          create: { name: "Pat Jones", email: "pat@example.com", isPrimary: true },
        },
      },
    });
    existingCustomerId = existing.id;
  });

  it("attaches contacts to the right customer, sets Main and role defaults", async () => {
    const result = await importContacts(
      contactsForm([
        {
          customer: `${tag} contacts acme`.toLowerCase(),
          name: "Alice Estimator",
          title: " Estimator ",
          roles: ["ESTIMATING", "BOSS", "ESTIMATING"],
          email: "alice@example.com",
        },
        {
          customer: `${tag} Contacts Acme`,
          name: "Bob Billing",
          roles: ["BILLING", "ESTIMATING"],
          phone: "631-555-0111",
        },
        {
          customer: `  ${tag} CONTACTS ACME WEST  `,
          name: "Wendy West",
          roles: ["FIELD"],
          phone: "631-555-0122",
          email: "wendy@example.com",
          notes: "gate code 1234",
        },
      ]),
    );
    expect(result).toEqual({
      imported: 3,
      skippedUnknownCustomer: 0,
      skippedExisting: 0,
    });

    const acmeContacts = await prisma.contact.findMany({
      where: { customerId: acmeId },
      orderBy: { name: "asc" },
    });
    expect(
      acmeContacts.map((c) => ({
        name: c.name,
        title: c.title,
        roles: c.roles,
        isPrimary: c.isPrimary,
        email: c.email,
        phone: c.phone,
      })),
    ).toEqual([
      {
        name: "Alice Estimator",
        title: "Estimator",
        // Unknown roles dropped, duplicates collapsed.
        roles: ["ESTIMATING"],
        // The first contact imported for a customer becomes Main.
        isPrimary: true,
        email: "alice@example.com",
        phone: null,
      },
      {
        name: "Bob Billing",
        title: null,
        roles: ["BILLING", "ESTIMATING"],
        isPrimary: false,
        email: null,
        phone: "631-555-0111",
      },
    ]);

    const westContacts = await prisma.contact.findMany({
      where: { customerId: acmeWestId },
    });
    expect(westContacts).toHaveLength(1);
    expect(westContacts[0]).toMatchObject({
      name: "Wendy West",
      isPrimary: true,
      notes: "gate code 1234",
    });

    // Role defaults: the first contact holding a role claims it; later ones
    // don't steal it.
    const alice = acmeContacts[0];
    const bob = acmeContacts[1];
    const defaults = await prisma.customerContactRoleDefault.findMany({
      where: { customerId: acmeId },
      orderBy: { role: "asc" },
    });
    expect(defaults.map((d) => [d.role, d.contactId])).toEqual([
      ["ESTIMATING", alice.id],
      ["BILLING", bob.id],
    ]);
    const westDefaults = await prisma.customerContactRoleDefault.findMany({
      where: { customerId: acmeWestId },
    });
    expect(westDefaults.map((d) => [d.role, d.contactId])).toEqual([
      ["FIELD", westContacts[0].id],
    ]);
  });

  it("skips unknown customers and case-variant duplicates (existing and in-batch)", async () => {
    const result = await importContacts(
      contactsForm([
        // Already on the customer, different case.
        { customer: `${tag} Contacts Existing`, name: "PAT JONES", email: "p2@example.com" },
        // New contact for the same customer — not Main, since one exists.
        { customer: `${tag} Contacts Existing`, name: "Quinn New", phone: "555-0133" },
        // Same new name again in the batch, different case.
        { customer: `${tag} Contacts Existing`, name: "quinn new", phone: "555-0144" },
        // No such customer.
        { customer: `${tag} Nobody Inc`, name: "Ghost", email: "ghost@example.com" },
      ]),
    );
    expect(result).toEqual({
      imported: 1,
      skippedUnknownCustomer: 1,
      skippedExisting: 2,
    });

    const contacts = await prisma.contact.findMany({
      where: { customerId: existingCustomerId },
      orderBy: { name: "asc" },
    });
    expect(contacts.map((c) => [c.name, c.isPrimary, c.phone])).toEqual([
      ["Pat Jones", true, null],
      ["Quinn New", false, "555-0133"],
    ]);
    expect(
      await prisma.contact.count({ where: { name: "Ghost", email: "ghost@example.com" } }),
    ).toBe(0);
  });

  it("returns { error } when every row is skipped", async () => {
    const result = await importContacts(
      contactsForm([
        { customer: `${tag} Contacts Existing`, name: "pat jones", phone: "555-0155" },
        { customer: `${tag} Nobody Inc`, name: "Ghost", phone: "555-0166" },
      ]),
    );
    expect(result).toEqual({
      error:
        "Nothing was imported — every row was skipped (unknown customer or the contact already exists).",
    });
  });

  it.each([
    [
      "missing customer",
      { customer: " ", name: "No Customer", phone: "555" },
      "Line 2: customer name is required.",
    ],
    [
      "missing contact name",
      { customer: "x", name: "", phone: "555" },
      "Line 2: contact name is required.",
    ],
    [
      "no phone or email",
      { customer: "x", name: "Silent Sam" },
      "Line 2: contact must have at least a phone number or email.",
    ],
    [
      "invalid email",
      { customer: "x", name: "Bad Email", email: "not-an-email" },
      "Line 2: email must be a valid email address.",
    ],
  ])("returns { error } for %s and imports nothing", async (_label, badRow, message) => {
    const before = await prisma.contact.count({ where: { customerId: acmeWestId } });
    const result = await importContacts(
      contactsForm([
        {
          customer: `${tag} Contacts Acme West`,
          name: `Valid Row ${_label}`,
          phone: "555-0199",
        },
        badRow,
      ]),
    );
    expect(result).toEqual({ error: message });
    expect(await prisma.contact.count({ where: { customerId: acmeWestId } })).toBe(before);
  });

  it("returns { error } for empty and malformed payloads", async () => {
    expect(await importContacts(new FormData())).toEqual({
      error: "No contacts to import.",
    });
    expect(await importContacts(contactsForm([]))).toEqual({
      error: "No contacts to import.",
    });
    expect(await importContacts(contactsForm("[oops"))).toEqual({
      error: "Invalid import data.",
    });
  });

  it("returns a permission error for a user without CUSTOMERS_MANAGE", async () => {
    cookieJar.token = readOnlyToken;
    const before = await prisma.contact.count({ where: { customerId: acmeId } });
    const result = await importContacts(
      contactsForm([
        { customer: `${tag} Contacts Acme`, name: "Forbidden Fred", phone: "555-0177" },
      ]),
    );
    expect(result).toEqual({ error: "You don't have permission to do that." });
    expect(await prisma.contact.count({ where: { customerId: acmeId } })).toBe(before);
  });
});
