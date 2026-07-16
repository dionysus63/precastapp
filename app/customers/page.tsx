import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ImportFeedbackBanner } from "@/components/common/import-feedback-banner";
import { CustomersList } from "@/components/customers/customers-list";
import { mapCustomerToRow } from "@/lib/customer-mapper";
import { OPEN_STATUSES } from "@/lib/quotes/list-summary";
import { withDatabaseRetry } from "@/lib/prisma";
import { customerStatusFormOptions } from "@/components/customers/customer-utils";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import type { Prisma } from "@/app/generated/prisma/client";

const CUSTOMER_SORT_FIELDS = {
  name: "name",
  phone: "phone",
  town: "town",
  status: "status",
  lastActivity: "updatedAt",
} as const;

/** Computed columns: sorted by aggregating over every matching customer. */
const AGGREGATE_SORT_COLUMNS = ["openQuotes", "balance"] as const;

type CustomerSortColumn =
  | keyof typeof CUSTOMER_SORT_FIELDS
  | (typeof AGGREGATE_SORT_COLUMNS)[number];

function isAggregateSortColumn(
  column: CustomerSortColumn,
): column is (typeof AGGREGATE_SORT_COLUMNS)[number] {
  return (AGGREGATE_SORT_COLUMNS as readonly string[]).includes(column);
}

async function loadCustomerAggregates(customerIds: string[]) {
  const [openQuoteCounts, invoiceBalances] =
    customerIds.length === 0
      ? [[], []]
      : await withDatabaseRetry((prisma) =>
          Promise.all([
            prisma.quote.groupBy({
              by: ["customerId"],
              where: {
                customerId: { in: customerIds },
                status: { in: OPEN_STATUSES },
              },
              _count: { _all: true },
            }),
            prisma.invoice.groupBy({
              by: ["customerId"],
              where: {
                customerId: { in: customerIds },
                status: "SENT",
              },
              _sum: { total: true },
            }),
          ]),
        );

  const openQuotesByCustomerId = new Map<string, number>();
  for (const row of openQuoteCounts) {
    if (row.customerId) {
      openQuotesByCustomerId.set(row.customerId, row._count._all);
    }
  }
  const balanceByCustomerId = new Map<string, number>();
  for (const row of invoiceBalances) {
    if (row.customerId) {
      balanceByCustomerId.set(row.customerId, Number(row._sum.total ?? 0));
    }
  }
  return { openQuotesByCustomerId, balanceByCustomerId };
}

const VALID_CUSTOMER_STATUSES = new Set<string>(
  customerStatusFormOptions.map((option) => option.value),
);

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const search = parseStringParam(params.q);
  const statusParam = parseStringParam(params.status);
  const sortParam = parseStringParam(params.sort);
  const dirParam = parseStringParam(params.dir);
  const requestedPage = parsePageParam(params.page);
  const importedCount = Number.parseInt(parseStringParam(params.imported) ?? "", 10);
  const imported =
    Number.isFinite(importedCount) && importedCount > 0 ? importedCount : 0;

  const sortColumn: CustomerSortColumn =
    sortParam in CUSTOMER_SORT_FIELDS ||
    (AGGREGATE_SORT_COLUMNS as readonly string[]).includes(sortParam)
      ? (sortParam as CustomerSortColumn)
      : "name";
  const sortDirection: "asc" | "desc" = dirParam === "desc" ? "desc" : "asc";

  // The status param accepts single statuses plus ALL; bare /customers
  // defaults to active customers — prospects/inactive live behind tabs.
  const statusFilter =
    statusParam === "ALL" || statusParam === "All"
      ? null
      : VALID_CUSTOMER_STATUSES.has(statusParam)
        ? statusParam
        : "ACTIVE";

  // Every filter except status — tab counts are computed over this base so
  // each tab shows what it would contain under the current search.
  const baseWhere: Prisma.CustomerWhereInput = {
    ...(search
      ? {
          // Person-level search goes through the contacts relation (backed
          // by the Contact name/email trigram indexes).
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            {
              contacts: {
                some: {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
  const where: Prisma.CustomerWhereInput = statusFilter
    ? {
        ...baseWhere,
        status: statusFilter as Prisma.CustomerWhereInput["status"],
      }
    : baseWhere;

  const [total, statusGroups] = await withDatabaseRetry((prisma) =>
    Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: baseWhere,
      }),
    ]),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const countByStatus = new Map(
    statusGroups.map((group) => [group.status, group._count._all]),
  );
  const tabCounts = {
    active: countByStatus.get("ACTIVE") ?? 0,
    prospect: countByStatus.get("PROSPECT") ?? 0,
    inactive: countByStatus.get("INACTIVE") ?? 0,
    all: statusGroups.reduce((acc, group) => acc + group._count._all, 0),
  };

  let customers: Prisma.CustomerGetPayload<object>[];
  let openQuotesByCustomerId: Map<string, number>;
  let balanceByCustomerId: Map<string, number>;

  if (isAggregateSortColumn(sortColumn)) {
    // Open quotes / balance are computed, not columns: aggregate over every
    // matching customer, sort in memory, then fetch just the page.
    const matching = await withDatabaseRetry((prisma) =>
      prisma.customer.findMany({ where, select: { id: true, name: true } }),
    );
    const aggregates = await loadCustomerAggregates(
      matching.map((customer) => customer.id),
    );
    openQuotesByCustomerId = aggregates.openQuotesByCustomerId;
    balanceByCustomerId = aggregates.balanceByCustomerId;

    const valueById =
      sortColumn === "openQuotes" ? openQuotesByCustomerId : balanceByCustomerId;
    const directionSign = sortDirection === "asc" ? 1 : -1;
    const pageIds = [...matching]
      .sort(
        (a, b) =>
          ((valueById.get(a.id) ?? 0) - (valueById.get(b.id) ?? 0)) *
            directionSign || a.name.localeCompare(b.name),
      )
      .slice(pageInfo.skip, pageInfo.skip + pageInfo.take)
      .map((customer) => customer.id);

    const records = await withDatabaseRetry((prisma) =>
      prisma.customer.findMany({ where: { id: { in: pageIds } } }),
    );
    const recordById = new Map(records.map((record) => [record.id, record]));
    customers = pageIds
      .map((id) => recordById.get(id))
      .filter((record): record is (typeof records)[number] => record != null);
  } else {
    const sortField = CUSTOMER_SORT_FIELDS[sortColumn];
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
      sortField === "name"
        ? [{ name: sortDirection }]
        : [{ [sortField]: sortDirection }, { name: "asc" }];

    customers = await withDatabaseRetry((prisma) =>
      prisma.customer.findMany({
        where,
        orderBy,
        skip: pageInfo.skip,
        take: pageInfo.take,
      }),
    );

    const aggregates = await loadCustomerAggregates(
      customers.map((customer) => customer.id),
    );
    openQuotesByCustomerId = aggregates.openQuotesByCustomerId;
    balanceByCustomerId = aggregates.balanceByCustomerId;
  }

  const rows = customers.map((customer) =>
    mapCustomerToRow(customer, {
      openQuotes: openQuotesByCustomerId.get(customer.id) ?? 0,
      balance: balanceByCustomerId.get(customer.id) ?? 0,
    }),
  );

  return (
    <DashboardShell
      title="Customers"
      subtitle="Manage customer accounts, contacts, and billing relationships."
    >
      <ImportFeedbackBanner imported={imported} noun="customer" />
      <CustomersList
        customers={rows}
        pageInfo={pageInfo}
        tabCounts={tabCounts}
        filters={{ search, status: statusParam }}
        sort={{ column: sortColumn, direction: sortDirection }}
      />
    </DashboardShell>
  );
}
