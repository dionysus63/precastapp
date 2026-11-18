import type { Prisma, ReceivingCategory } from "@/app/generated/prisma/client";
import {
  parsePurchaseOrderStatus,
  purchaseOrderJobLabel,
  type PurchaseOrderStatus,
} from "@/lib/purchase-order-utils";
import { parseReceivingCategory } from "@/lib/receiving-utils";

/**
 * The Purchase Orders list: what its address says to show (`?q=`, the
 * dropdowns, `?sort=&dir=`), as database filters and an order. Kept apart
 * from the page so it can be tested without a browser.
 */

type ParamValue = string | string[] | undefined;

function text(value: ParamValue): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** The column headers that sort the list when clicked (`?sort=job&dir=desc`). */
export const PURCHASE_ORDER_LIST_SORT_COLUMNS = [
  "po",
  "vendor",
  "date",
  "createdBy",
  "contractor",
  "job",
  "total",
] as const;

export type PurchaseOrderListSortColumn =
  (typeof PURCHASE_ORDER_LIST_SORT_COLUMNS)[number];

/** Null: not sorted by a header, so newest order date first. */
export type PurchaseOrderListSort = {
  column: PurchaseOrderListSortColumn;
  direction: "asc" | "desc";
} | null;

/** Reads `?sort=&dir=`; an unknown column reads as not sorted. */
export function parsePurchaseOrderListSort(
  sort: ParamValue,
  dir: ParamValue,
): PurchaseOrderListSort {
  const column = PURCHASE_ORDER_LIST_SORT_COLUMNS.find(
    (candidate) => candidate === text(sort),
  );
  if (!column) {
    return null;
  }
  return { column, direction: text(dir) === "desc" ? "desc" : "asc" };
}

/**
 * What a click on a header asks for: A to Z (oldest, smallest first) on a
 * new column, the other way round on the column the list is sorted by.
 */
export function nextPurchaseOrderListSort(
  current: PurchaseOrderListSort,
  column: PurchaseOrderListSortColumn,
): NonNullable<PurchaseOrderListSort> {
  return {
    column,
    direction:
      current?.column === column && current.direction === "asc" ? "desc" : "asc",
  };
}

/** Newest first, the order of a list nobody sorted; also breaks every tie. */
const NEWEST_FIRST: Prisma.PurchaseOrderOrderByWithRelationInput[] = [
  { orderDate: "desc" },
  { poNumber: "desc" },
];

export function buildPurchaseOrderListOrderBy(
  sort: PurchaseOrderListSort,
): Prisma.PurchaseOrderOrderByWithRelationInput[] {
  if (!sort) {
    return NEWEST_FIRST;
  }
  const { direction } = sort;
  switch (sort.column) {
    case "po":
      return [{ poNumber: direction }];
    case "vendor":
      return [{ vendor: { name: direction } }, ...NEWEST_FIRST];
    case "date":
      return [{ orderDate: direction }, { poNumber: direction }];
    case "createdBy":
      return [{ enteredBy: { sort: direction, nulls: "last" } }, ...NEWEST_FIRST];
    // Orders with no contractor or no job come last either way round.
    case "contractor":
      return [
        { contractorNames: { sort: direction, nulls: "last" } },
        ...NEWEST_FIRST,
      ];
    case "job":
      return [{ jobName: { sort: direction, nulls: "last" } }, ...NEWEST_FIRST];
    case "total":
      return [{ total: direction }, ...NEWEST_FIRST];
  }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** The job dropdown's value: a job on file (`id:<id>`) or a typed name (`name:<text>`). */
export type PurchaseOrderJobFilter = { id: string } | { name: string };

export function parsePurchaseOrderJobFilter(
  value: ParamValue,
): PurchaseOrderJobFilter | null {
  const token = text(value);
  if (token.startsWith("id:") && token.length > 3) {
    return { id: token.slice(3) };
  }
  if (token.startsWith("name:") && token.slice(5).trim()) {
    return { name: token.slice(5).trim() };
  }
  return null;
}

export function purchaseOrderJobFilterToken(filter: PurchaseOrderJobFilter): string {
  return "id" in filter ? `id:${filter.id}` : `name:${filter.name}`;
}

export type PurchaseOrderListFilters = {
  search: string;
  status: PurchaseOrderStatus | null;
  vendorId: string;
  /** "one-off": orders with no receiving category. */
  category: ReceivingCategory | "one-off" | null;
  /** The "Entered by" name on the order. */
  createdBy: string;
  /** A customer the order names as a contractor. */
  contractorId: string;
  job: PurchaseOrderJobFilter | null;
};

export function parsePurchaseOrderListFilters(
  params: Partial<
    Record<"q" | "status" | "vendor" | "category" | "by" | "contractor" | "job", ParamValue>
  >,
): PurchaseOrderListFilters {
  const category = text(params.category);
  return {
    search: text(params.q),
    status: text(params.status) ? parsePurchaseOrderStatus(text(params.status)) : null,
    vendorId: text(params.vendor),
    category:
      category === "one-off" ? "one-off" : category ? parseReceivingCategory(category) : null,
    createdBy: text(params.by),
    contractorId: text(params.contractor),
    job: parsePurchaseOrderJobFilter(params.job),
  };
}

export function buildPurchaseOrderListWhere(
  filters: PurchaseOrderListFilters,
): Prisma.PurchaseOrderWhereInput {
  const and: Prisma.PurchaseOrderWhereInput[] = [];

  if (filters.search) {
    const contains = { contains: filters.search, mode: "insensitive" as const };
    and.push({
      OR: [
        { poNumber: contains },
        { vendor: { name: contains } },
        { notes: contains },
        { internalNotes: contains },
        { contractorNames: contains },
        { contractors: { some: { customer: { name: contains } } } },
        { jobName: contains },
        { job: { OR: [{ jobNumber: contains }, { projectName: contains }] } },
      ],
    });
  }
  if (filters.status) {
    and.push({ status: filters.status });
  }
  if (filters.vendorId) {
    and.push({ vendorId: filters.vendorId });
  }
  if (filters.category === "one-off") {
    and.push({ category: null });
  } else if (filters.category) {
    and.push({ category: filters.category });
  }
  if (filters.createdBy) {
    and.push({ enteredBy: { equals: filters.createdBy, mode: "insensitive" } });
  }
  if (filters.contractorId) {
    and.push({ contractors: { some: { customerId: filters.contractorId } } });
  }
  if (filters.job) {
    and.push(
      "id" in filters.job
        ? { jobId: filters.job.id }
        : { jobId: null, jobName: { equals: filters.job.name, mode: "insensitive" } },
    );
  }

  return and.length ? { AND: and } : {};
}

/**
 * The job dropdown: every job named on a purchase order once. Jobs on file
 * by their number and project as they are now, typed names whatever their
 * capitals; sorted by what is shown.
 */
export function purchaseOrderJobFilterOptions(
  rows: Array<{
    jobName: string | null;
    job: { id: string; jobNumber: string; projectName: string } | null;
  }>,
): Array<{ value: string; label: string }> {
  const byValue = new Map<string, { value: string; label: string }>();
  for (const row of rows) {
    if (row.job) {
      const value = purchaseOrderJobFilterToken({ id: row.job.id });
      byValue.set(value, { value, label: purchaseOrderJobLabel(row.job) });
      continue;
    }
    const name = row.jobName?.trim();
    if (name && !byValue.has(`name:${name.toLowerCase()}`)) {
      byValue.set(`name:${name.toLowerCase()}`, {
        value: purchaseOrderJobFilterToken({ name }),
        label: name,
      });
    }
  }
  return [...byValue.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "en", { sensitivity: "base", numeric: true }),
  );
}
