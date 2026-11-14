import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Permission checks come from the session cookie, which a test has none of.
// The queries themselves run for real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getInvoiceFilterCounts,
  getInvoiceSearchSuggestions,
  listInvoiceSelectionForView,
  listInvoicesForPage,
} from "@/app/invoices/actions";
import {
  EMPTY_INVOICE_LIST_SEARCH,
  type InvoiceListSearch,
} from "@/lib/invoice-list-search";
import { prisma } from "@/lib/prisma";

const tag = `INVSEARCH-${Date.now()}`;

type Seed = {
  suffix: string;
  sequence: number;
  customer: string;
  project: string;
  jobNumber?: string;
  status?: "SENT" | "PAID" | "VOID";
  invoiceDate: Date;
  total: number;
  /** Give the ticket a signed copy (and an older, replaced one). */
  signed?: boolean;
};

const seeds: Seed[] = [
  {
    suffix: "A",
    sequence: 9801,
    customer: `${tag} Acme Paving`,
    project: `${tag} Main Street Drainage`,
    jobNumber: `${tag}-J104`,
    invoiceDate: new Date(2026, 10, 2, 9, 30),
    total: 1250,
    signed: true,
  },
  {
    suffix: "B",
    sequence: 9802,
    customer: `${tag} Acme Paving`,
    project: `${tag} Harbor Road`,
    jobNumber: `${tag}-J105`,
    status: "PAID",
    // Late in the evening of the last day of a range.
    invoiceDate: new Date(2026, 10, 10, 22, 15),
    total: 480.5,
  },
  {
    suffix: "C",
    sequence: 9803,
    customer: `${tag} Bay Excavating`,
    project: `${tag} Main Street Drainage`,
    jobNumber: `${tag}-J104`,
    invoiceDate: new Date(2026, 10, 11, 8, 0),
    total: 3000,
  },
  {
    suffix: "D",
    sequence: 9804,
    customer: `${tag} Bay Excavating`,
    project: `${tag} Counter sale`,
    status: "VOID",
    invoiceDate: new Date(2026, 9, 20, 12, 0),
    total: 75,
  },
];

const ids: Record<string, string> = {};

function search(overrides: Partial<InvoiceListSearch>): InvoiceListSearch {
  // Every search stays inside this test's own rows.
  return { ...EMPTY_INVOICE_LIST_SEARCH, customer: tag, ...overrides };
}

async function numbers(
  overrides: Partial<InvoiceListSearch>,
  filter: Parameters<typeof listInvoicesForPage>[0]["filter"] = "ALL",
) {
  const result = await listInvoicesForPage({
    filter,
    search: search(overrides),
    page: 1,
  });
  return result.invoices.map((row) => row.invoiceNumber.slice(-1)).sort();
}

beforeAll(async () => {
  for (const seed of seeds) {
    const ticket = await prisma.deliveryTicket.create({
      data: {
        ticketNumber: `${tag}-T${seed.suffix}`,
        year: 2026,
        yearTwoDigit: 26,
        sequenceNumber: seed.sequence,
        customerName: seed.customer,
        projectName: seed.project,
        status: "DELIVERED",
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `${tag}-I${seed.suffix}`,
        year: 2026,
        yearTwoDigit: 26,
        sequenceNumber: seed.sequence,
        deliveryTicketId: ticket.id,
        customerName: seed.customer,
        projectName: seed.project,
        jobNumber: seed.jobNumber ?? null,
        status: seed.status ?? "SENT",
        invoiceDate: seed.invoiceDate,
        subtotal: seed.total,
        total: seed.total,
      },
    });
    ids[seed.suffix] = invoice.id;
    if (seed.signed) {
      await prisma.signedTicketFile.create({
        data: {
          deliveryTicketId: ticket.id,
          filePath: `2026/${tag}-T${seed.suffix} (earlier version 1).pdf`,
          pageCount: 1,
          fileSize: 10,
          isCurrent: false,
        },
      });
      await prisma.signedTicketFile.create({
        data: {
          deliveryTicketId: ticket.id,
          filePath: `2026/${tag}-T${seed.suffix}.pdf`,
          pageCount: 2,
          fileSize: 20,
          isCurrent: true,
        },
      });
    }
  }
});

afterAll(async () => {
  await prisma.signedTicketFile.deleteMany({
    where: { deliveryTicket: { ticketNumber: { startsWith: tag } } },
  });
  await prisma.invoice.deleteMany({
    where: { invoiceNumber: { startsWith: tag } },
  });
  await prisma.deliveryTicket.deleteMany({
    where: { ticketNumber: { startsWith: tag } },
  });
});

describe("searching the invoices list", () => {
  it("finds a contractor by any part of the name, in any letter case", async () => {
    expect(await numbers({ customer: `${tag} acme` })).toEqual(["A", "B"]);
    expect(
      await numbers({ customer: `${tag.toLowerCase()} bay excav` }),
    ).toEqual(["C", "D"]);
  });

  it("finds a job by its name or by its job number", async () => {
    expect(await numbers({ job: "main street" })).toEqual(["A", "C"]);
    expect(await numbers({ job: `${tag}-j105` })).toEqual(["B"]);
  });

  it("includes both days of an invoice date range, to the end of the last day", async () => {
    expect(await numbers({ from: "2026-11-02", to: "2026-11-10" })).toEqual([
      "A",
      "B",
    ]);
    expect(await numbers({ from: "2026-11-11" })).toEqual(["C"]);
    expect(await numbers({ to: "2026-11-01" })).toEqual(["D"]);
  });

  it("filters on the invoice total, both ends included", async () => {
    expect(await numbers({ min: "480.50", max: "1,250" })).toEqual(["A", "B"]);
    expect(await numbers({ min: "$3,000" })).toEqual(["C"]);
    expect(await numbers({ max: "100" })).toEqual(["D"]);
  });

  it("combines the boxes with each other and with the status chip", async () => {
    expect(await numbers({ job: "main street", min: "2000" })).toEqual(["C"]);
    expect(await numbers({ customer: `${tag} Acme` }, "PAID")).toEqual(["B"]);
    expect(await numbers({ customer: `${tag} Acme` }, "VOID")).toEqual([]);
  });

  it("counts the chips inside the search", async () => {
    const counts = await getInvoiceFilterCounts(
      search({ customer: `${tag} Bay` }),
    );
    expect(counts).toMatchObject({ ALL: 2, OPEN: 1, PAID: 0, VOID: 1 });
  });
});

describe("the signed ticket of an invoice in the list", () => {
  it("is the ticket's current signed copy, or nothing", async () => {
    const result = await listInvoicesForPage({
      filter: "ALL",
      search: search({}),
      page: 1,
    });
    const byId = new Map(result.invoices.map((row) => [row.id, row]));
    const signed = byId.get(ids.A!)!.signedTicket;
    expect(signed).toMatchObject({
      pageCount: 2,
      fileName: `${tag}-TA - Signed.pdf`,
    });
    const current = await prisma.signedTicketFile.findFirstOrThrow({
      where: {
        deliveryTicket: { ticketNumber: `${tag}-TA` },
        isCurrent: true,
      },
    });
    expect(signed!.fileId).toBe(current.id);
    expect(byId.get(ids.B!)!.signedTicket).toBeNull();
    expect(byId.get(ids.A!)!.jobNumber).toBe(`${tag}-J104`);
  });
});

describe("selecting every invoice in a view", () => {
  it("returns the ids and numbers the view shows across its pages", async () => {
    const result = await listInvoiceSelectionForView({
      filter: "OPEN",
      search: search({}),
    });
    if ("error" in result) {
      throw new Error(result.error);
    }
    expect(result.invoices.map((invoice) => invoice.id).sort()).toEqual(
      [ids.A!, ids.C!].sort(),
    );
    expect(
      result.invoices.map((invoice) => invoice.invoiceNumber).sort(),
    ).toEqual([`${tag}-IA`, `${tag}-IC`]);
  });
});

describe("what the search boxes suggest", () => {
  it("offers each contractor once and the jobs of the contractor typed", async () => {
    const all = await getInvoiceSearchSuggestions();
    expect(all.customers.filter((name) => name.startsWith(tag))).toEqual([
      `${tag} Acme Paving`,
      `${tag} Bay Excavating`,
    ]);

    const acme = await getInvoiceSearchSuggestions(`${tag} acme`);
    expect(acme.jobs).toEqual([
      { projectName: `${tag} Harbor Road`, jobNumber: `${tag}-J105` },
      { projectName: `${tag} Main Street Drainage`, jobNumber: `${tag}-J104` },
    ]);
  });
});
