import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomersList } from "@/components/customers/customers-list";
import { mapCustomerToRow } from "@/lib/customer-mapper";
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

  const sortColumn: CustomerSortColumn =
    sortParam in CUSTOMER_SORT_FIELDS
      ? (sortParam as CustomerSortColumn)
      : "name";
  const sortDirection: "asc" | "desc" = dirParam === "desc" ? "desc" : "asc";
  const sortField = CUSTOMER_SORT_FIELDS[sortColumn];

  const where: Prisma.CustomerWhereInput = {
    ...(statusParam && VALID_CUSTOMER_STATUSES.has(statusParam)
      ? { status: statusParam as Prisma.CustomerWhereInput["status"] }
      : {}),
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

  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    sortField === "name"
      ? [{ name: sortDirection }]
      : [{ [sortField]: sortDirection }, { name: "asc" }];

  const total = await withDatabaseRetry((prisma) =>
    prisma.customer.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const customers = await withDatabaseRetry((prisma) =>
    prisma.customer.findMany({
      where,
      orderBy,
      skip: pageInfo.skip,
      take: pageInfo.take,
    }),
  );

  const rows = customers.map(mapCustomerToRow);

  return (
    <DashboardShell
      title="Customers"
      subtitle="Manage customer accounts, contacts, and billing relationships."
    >
      <CustomersList
        customers={rows}
        pageInfo={pageInfo}
        filters={{ search, status: statusParam }}
        sort={{ column: sortColumn, direction: sortDirection }}
      />
    </DashboardShell>
  );
}
