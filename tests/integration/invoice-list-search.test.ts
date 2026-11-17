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
  type InvoiceListSort,
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
  /** The ticket's ship date (a day, local midnight). Null = none set. */
  shipDate: Date | null;
  /** The day the invoice was made: not what the date range looks at. */
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
    shipDate: new Date(2026, 10, 2),
    invoiceDate: new Date(2026, 10, 3, 9, 30),
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
    shipDate: new Date(2026, 10, 10),
    // Scanned in and invoiced the day after it shipped.
    invoiceDate: new Date(2026, 10, 11, 22, 15),
    total: 480.5,
  },
  {
    suffix: "C",
    sequence: 9803,
    customer: `${tag} Bay Excavating`,
    project: `${tag} Main Street Drainage`,
    jobNumber: `${tag}-J104`,
    shipDate: new Date(2026, 10, 11),
    invoiceDate: new Date(2026, 10, 12, 8, 0),
    total: 3000,
  },
  {
    suffix: "D",
    sequence: 9804,
    customer: `${tag} Bay Excavating`,
    project: `${tag} Counter sale`,
    status: "VOID",
    shipDate: new Date(2026, 9, 20),
    invoiceDate: new Date(2026, 9, 21, 12, 0),
    total: 75,
  },
  {
    // A ticket nobody gave a ship date.
    suffix: "E",
    sequence: 9805,
    customer: `${tag} Cash Customer`,
    project: `${tag} Counter pickup`,
    shipDate: null,
    invoiceDate: new Date(2026, 10, 5, 10, 0),
    total: 2000,
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
        deliveryDate: seed.shipDate,
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

  it("filters on the ship date, not the day the invoice was made, both days included", async () => {
    expect(await numbers({ from: "2026-11-02", to: "2026-11-10" })).toEqual([
      "A",
      "B",
    ]);
    expect(await numbers({ from: "2026-11-11" })).toEqual(["C"]);
    expect(await numbers({ to: "2026-11-01" })).toEqual(["D"]);
  });

  it("leaves a ticket without a ship date out of a date range only", async () => {
    expect(await numbers({})).toEqual(["A", "B", "C", "D", "E"]);
    // Invoiced on the 5th, but it has no ship date to fall inside the range.
    expect(await numbers({ from: "2026-10-01", to: "2026-12-31" })).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
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

describe("sorting the invoices list by a column header", () => {
  async function order(sort?: InvoiceListSort) {
    const result = await listInvoicesForPage({
      filter: "ALL",
      search: search({}),
      sort,
      page: 1,
    });
    return result.invoices.map((row) => row.invoiceNumber.slice(-1)).join("");
  }

  it("opens with the invoice made last on top", async () => {
    expect(await order()).toBe("EDCBA");
    expect(await order(null)).toBe("EDCBA");
  });

  it("sorts by invoice number, both ways", async () => {
    expect(await order({ column: "invoice", direction: "asc" })).toBe("ABCDE");
    expect(await order({ column: "invoice", direction: "desc" })).toBe("EDCBA");
  });

  it("sorts by ship date, a ticket without one last either way", async () => {
    expect(await order({ column: "ship", direction: "asc" })).toBe("DABCE");
    expect(await order({ column: "ship", direction: "desc" })).toBe("CBADE");
  });

  it("sorts by contractor, then by job", async () => {
    expect(await order({ column: "customer", direction: "asc" })).toBe("BADCE");
    expect(await order({ column: "customer", direction: "desc" })).toBe(
      "ECDAB",
    );
  });

  it("sorts by job, then by contractor", async () => {
    // Counter pickup (E), Counter sale (D), Harbor Road (B), then Main
    // Street Drainage for Acme (A) and for Bay (C).
    expect(await order({ column: "job", direction: "asc" })).toBe("EDBAC");
    expect(await order({ column: "job", direction: "desc" })).toBe("CABDE");
  });

  it("keeps the search and the status chip while sorted", async () => {
    const result = await listInvoicesForPage({
      filter: "OPEN",
      search: search({ job: "main street" }),
      sort: { column: "ship", direction: "desc" },
      page: 1,
    });
    expect(result.invoices.map((row) => row.invoiceNumber.slice(-1))).toEqual([
      "C",
      "A",
    ]);
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
      [ids.A!, ids.C!, ids.E!].sort(),
    );
    expect(
      result.invoices.map((invoice) => invoice.invoiceNumber).sort(),
    ).toEqual([`${tag}-IA`, `${tag}-IC`, `${tag}-IE`]);
  });
});

describe("what the search boxes suggest", () => {
  it("offers each contractor once and the jobs of the contractor typed", async () => {
    const all = await getInvoiceSearchSuggestions();
    expect(all.customers.filter((name) => name.startsWith(tag))).toEqual([
      `${tag} Acme Paving`,
      `${tag} Bay Excavating`,
      `${tag} Cash Customer`,
    ]);

    const acme = await getInvoiceSearchSuggestions(`${tag} acme`);
    expect(acme.jobs).toEqual([
      { projectName: `${tag} Harbor Road`, jobNumber: `${tag}-J105` },
      { projectName: `${tag} Main Street Drainage`, jobNumber: `${tag}-J104` },
    ]);
  });
});
