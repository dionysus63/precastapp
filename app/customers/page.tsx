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
  primaryContact: "primaryContactName",
  phone: "phone",
  email: "email",
  status: "status",
  lastActivity: "updatedAt",
} as const;

type CustomerSortColumn = keyof typeof CUSTOMER_SORT_FIELDS;

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
    sortParam in CUSTOMER_SORT_FIELDS
      ? (sortParam as CustomerSortColumn)
      : "name";
  const sortDirection: "asc" | "desc" = dirParam === "desc" ? "desc" : "asc";
  const sortField = CUSTOMER_SORT_FIELDS[sortColumn];

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
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { primaryContactName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
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

  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    sortField === "name"
      ? [{ name: sortDirection }]
      : [{ [sortField]: sortDirection }, { name: "asc" }];

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

  const customers = await withDatabaseRetry((prisma) =>
    prisma.customer.findMany({
      where,
      orderBy,
      skip: pageInfo.skip,
      take: pageInfo.take,
    }),
  );

  const customerIds = customers.map((customer) => customer.id);

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

  const openQuotesByCustomerId = new Map(
    openQuoteCounts.map((row) => [row.customerId, row._count._all]),
  );
  const balanceByCustomerId = new Map(
    invoiceBalances.map((row) => [
      row.customerId,
      Number(row._sum.total ?? 0),
    ]),
  );

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
