import type { Prisma } from "@/app/generated/prisma/client";
import { parseLocalDay } from "@/lib/date-only";
import {
  parseInvoiceListFilter,
  UNPAID_INVOICE_STATUSES,
  type InvoiceListFilter,
} from "@/lib/invoice-status";

/**
 * The search boxes above the Invoices list: contractor, job, a range of
 * invoice dates and a range of totals. They live in the address
 * (`?customer=&job=&from=&to=&min=&max=`) next to the status chip
 * (`?status=`), so a filtered list can be paged, reloaded and linked.
 */
export type InvoiceListSearch = {
  /** Part of the contractor's name. */
  customer: string;
  /** Part of the job's name or its job number. */
  job: string;
  /** First invoice date shown, "yyyy-mm-dd". */
  from: string;
  /** Last invoice date shown, "yyyy-mm-dd". */
  to: string;
  /** Lowest invoice total shown, as typed ("1500", "1,500.00"). */
  min: string;
  /** Highest invoice total shown. */
  max: string;
};

export const EMPTY_INVOICE_LIST_SEARCH: InvoiceListSearch = {
  customer: "",
  job: "",
  from: "",
  to: "",
  min: "",
  max: "",
};

export const INVOICE_LIST_SEARCH_KEYS = [
  "customer",
  "job",
  "from",
  "to",
  "min",
  "max",
] as const satisfies readonly (keyof InvoiceListSearch)[];

/** Most invoices one print or download may hold: all are filled in memory. */
export const MAX_SELECTED_INVOICES = 200;

type ParamValue = string | string[] | null | undefined;

function text(value: ParamValue): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

/**
 * A typed dollar amount: "1500", "1,500.50" and "$1,500" all read 1500(.5).
 * Anything that is not a plain amount (or is negative) reads as nothing typed.
 */
export function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) {
    return null;
  }
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

/** Reads the search boxes out of the address; junk values read as empty. */
export function parseInvoiceListSearch(
  params: Partial<Record<keyof InvoiceListSearch, ParamValue>>,
): InvoiceListSearch {
  const day = (value: ParamValue) => {
    const raw = text(value);
    return raw && parseLocalDay(raw) ? raw : "";
  };
  const amount = (value: ParamValue) => {
    const raw = text(value);
    return raw && parseMoneyInput(raw) != null ? raw : "";
  };
  return {
    customer: text(params.customer),
    job: text(params.job),
    from: day(params.from),
    to: day(params.to),
    min: amount(params.min),
    max: amount(params.max),
  };
}

export function hasInvoiceListSearch(search: InvoiceListSearch): boolean {
  return INVOICE_LIST_SEARCH_KEYS.some((key) => search[key] !== "");
}

/** The same search as address parameters (empty boxes are left out). */
export function invoiceListSearchParams(
  search: InvoiceListSearch,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of INVOICE_LIST_SEARCH_KEYS) {
    if (search[key]) {
      params[key] = search[key];
    }
  }
  return params;
}

function statusWhere(filter: InvoiceListFilter): Prisma.InvoiceWhereInput {
  switch (filter) {
    case "PRICE_NEEDED":
      return {
        status: { in: [...UNPAID_INVOICE_STATUSES] },
        lineItems: { some: { needsPrice: true } },
      };
    case "OPEN":
      return { status: { in: [...UNPAID_INVOICE_STATUSES] } };
    case "PAID":
      return { status: "PAID" };
    case "VOID":
      return { status: "VOID" };
    default:
      return {};
  }
}

/**
 * What the database is asked for: the status chip and every search box that
 * has something in it, all of which must match.
 *
 * - Contractor and job match any part of the name, in any letter case; job
 *   also matches the job number.
 * - The dates are invoice dates and both ends are included (the "to" day runs
 *   to its last millisecond).
 * - The amounts are invoice totals (tax included), both ends included.
 */
export function buildInvoiceListWhere(
  filter: InvoiceListFilter,
  search: InvoiceListSearch = EMPTY_INVOICE_LIST_SEARCH,
): Prisma.InvoiceWhereInput {
  const conditions: Prisma.InvoiceWhereInput[] = [];
  const status = statusWhere(filter);
  if (Object.keys(status).length > 0) {
    conditions.push(status);
  }

  if (search.customer) {
    conditions.push({
      customerName: { contains: search.customer, mode: "insensitive" },
    });
  }
  if (search.job) {
    conditions.push({
      OR: [
        { projectName: { contains: search.job, mode: "insensitive" } },
        { jobNumber: { contains: search.job, mode: "insensitive" } },
      ],
    });
  }

  const from = search.from ? parseLocalDay(search.from) : null;
  const to = search.to ? parseLocalDay(search.to) : null;
  if (from || to) {
    const range: Prisma.DateTimeNullableFilter = {};
    if (from) {
      range.gte = from;
    }
    if (to) {
      range.lte = new Date(
        to.getFullYear(),
        to.getMonth(),
        to.getDate(),
        23,
        59,
        59,
        999,
      );
    }
    conditions.push({ invoiceDate: range });
  }

  const min = search.min ? parseMoneyInput(search.min) : null;
  const max = search.max ? parseMoneyInput(search.max) : null;
  if (min != null || max != null) {
    const range: Prisma.DecimalFilter = {};
    if (min != null) {
      range.gte = min;
    }
    if (max != null) {
      range.lte = max;
    }
    conditions.push({ total: range });
  }

  if (conditions.length === 0) {
    return {};
  }
  return conditions.length === 1 ? conditions[0]! : { AND: conditions };
}

/** The whole view an address asks for: its status chip and its search. */
export function parseInvoiceListView(
  params: Partial<Record<keyof InvoiceListSearch | "status", ParamValue>>,
): { filter: InvoiceListFilter; search: InvoiceListSearch } {
  return {
    filter: parseInvoiceListFilter(text(params.status)),
    search: parseInvoiceListSearch(params),
  };
}

/**
 * The invoice ids named by `?ids=a,b,c`: trimmed, without repeats, in the
 * order given. Null when there are none or more than one print can hold.
 */
export function parseSelectedInvoiceIds(value: string | null): string[] | null {
  const ids = [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)),
    ),
  ];
  if (ids.length === 0 || ids.length > MAX_SELECTED_INVOICES) {
    return null;
  }
  return ids;
}

/** One PDF of the invoices that are ticked; `download` saves it as a file. */
export function selectedInvoicesPdfUrl(
  ids: readonly string[],
  options: { download?: boolean } = {},
): string {
  const query = new URLSearchParams({ ids: ids.join(",") });
  if (options.download) {
    query.set("download", "1");
  }
  return `/api/invoices/selected/pdf?${query.toString()}`;
}

/**
 * The file name of that PDF: "invoice-I10212.pdf" for one invoice,
 * "invoices-3-selected-I10210-to-I10215.pdf" for several.
 */
export function selectedInvoicesFileName(
  invoiceNumbers: readonly string[],
): string {
  const sorted = [...invoiceNumbers].sort((a, b) => a.localeCompare(b));
  if (sorted.length <= 1) {
    return `invoice-${sorted[0] ?? "selected"}.pdf`;
  }
  return `invoices-${sorted.length}-selected-${sorted[0]}-to-${sorted.at(-1)}.pdf`;
}
