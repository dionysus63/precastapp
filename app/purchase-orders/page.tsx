import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PaginationControls } from "@/components/common/pagination-controls";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { mapPurchaseOrderListRow } from "@/lib/purchase-order-mapper";
import {
  buildPurchaseOrderListOrderBy,
  buildPurchaseOrderListWhere,
  nextPurchaseOrderListSort,
  parsePurchaseOrderListFilters,
  parsePurchaseOrderListSort,
  purchaseOrderJobFilterOptions,
  purchaseOrderJobFilterToken,
  type PurchaseOrderListSort,
  type PurchaseOrderListSortColumn,
} from "@/lib/purchase-order-list-search";
import {
  purchaseOrderCreatorNames,
  purchaseOrderStatusFormOptions,
  purchaseOrderCategoryFormOptions,
} from "@/lib/purchase-order-utils";
import {
  buildPageInfo,
  parsePageParam,
  type RawSearchParams,
} from "@/lib/list-params";
import { formatUsd } from "@/lib/format";
import { withDatabaseRetry } from "@/lib/prisma";

import {
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

/** A list cell: one line, so the columns sit close together. */
const listCellClassName = `${tableCellClassName} whitespace-nowrap`;

/** The search box and the dropdowns: white boxes, so they stand off the gray page. */
const filterBoxClassName =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400";

/** Contractor and Job: long names wrap inside the cell instead of pushing the table wide. */
const wrappingCellClassName = `${tableCellClassName} max-w-64 min-w-28 whitespace-normal`;

/**
 * A column header that sorts the list when clicked: A to Z (oldest, smallest
 * first) the first time, the other way round the second. The arrow marks the
 * column the list is sorted by. A link, so the sort is in the address.
 */
function SortHeader({
  column,
  sort,
  hrefFor,
  children,
}: {
  column: PurchaseOrderListSortColumn;
  sort: PurchaseOrderListSort;
  hrefFor: (column: PurchaseOrderListSortColumn) => string;
  children: React.ReactNode;
}) {
  const direction = sort?.column === column ? sort.direction : null;
  return (
    // The link fills the header cell (it takes the cell's padding back with
    // its margins), so the whole cell is the target.
    <th
      scope="col"
      aria-sort={
        direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"
      }
      className={`${tableHeaderCellClassName} transition-colors hover:bg-slate-200 hover:text-slate-700`}
    >
      <Link
        href={hrefFor(column)}
        scroll={false}
        title={
          direction === "asc"
            ? "Sorted A to Z, oldest first. Click to reverse."
            : direction === "desc"
              ? "Sorted Z to A, newest first. Click to reverse."
              : "Click to sort by this column"
        }
        className="-mx-2 -my-1.5 flex items-center gap-1 px-2 py-1.5 whitespace-nowrap"
      >
        {children}
        <span aria-hidden="true" className={direction ? "text-slate-900" : "text-slate-400"}>
          {direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}
        </span>
      </Link>
    </th>
  );
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parsePurchaseOrderListFilters(params);
  const sort = parsePurchaseOrderListSort(params.sort, params.dir);
  const requestedPage = parsePageParam(params.page);
  const where = buildPurchaseOrderListWhere(filters);

  // The address of this list sorted by a column: the filters stay, the page
  // goes back to the first.
  const sortHref = (column: PurchaseOrderListSortColumn) => {
    const query = new URLSearchParams();
    for (const key of ["q", "status", "vendor", "category", "by", "contractor", "job"]) {
      const value = params[key];
      const text = (Array.isArray(value) ? value[0] : value)?.trim();
      if (text) {
        query.set(key, text);
      }
    }
    const next = nextPurchaseOrderListSort(sort, column);
    query.set("sort", next.column);
    query.set("dir", next.direction);
    return `/purchase-orders?${query.toString()}`;
  };

  const total = await withDatabaseRetry((client) =>
    client.purchaseOrder.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const [purchaseOrders, vendors, enteredByRows, contractorOptions, jobRows] =
    await withDatabaseRetry((client) =>
    Promise.all([
      client.purchaseOrder.findMany({
        where,
        orderBy: buildPurchaseOrderListOrderBy(sort),
        skip: pageInfo.skip,
        take: pageInfo.take,
        include: {
          vendor: { select: { name: true } },
          lines: {
            select: { quantityOrdered: true, quantityReceived: true },
          },
          contractors: {
            orderBy: { sortOrder: "asc" },
            select: { customer: { select: { id: true, name: true } } },
          },
          jobs: {
            orderBy: { sortOrder: "asc" },
            select: {
              name: true,
              job: { select: { id: true, jobNumber: true, projectName: true } },
            },
          },
        },
      }),
      client.vendor.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      }),
      // Everyone named on an order, for the "Created by" dropdown.
      client.purchaseOrder.findMany({
        where: { enteredBy: { not: null } },
        distinct: ["enteredBy"],
        select: { enteredBy: true },
      }),
      // Every customer named on an order, for the contractor dropdown.
      client.customer.findMany({
        where: { purchaseOrders: { some: {} } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      // Every job named on an order, picked or typed, for the job dropdown.
      client.purchaseOrderJob.findMany({
        distinct: ["jobId", "name"],
        select: {
          name: true,
          job: { select: { id: true, jobNumber: true, projectName: true } },
        },
      }),
    ]),
  );
  const jobOptions = purchaseOrderJobFilterOptions(jobRows);
  // The job the list is filtered by, as the dropdown spells it. A typed name
  // matches whatever its capitals; one no order carries stays pickable.
  const jobToken = filters.job ? purchaseOrderJobFilterToken(filters.job) : "";
  const selectedJob =
    jobOptions.find((option) => option.value.toLowerCase() === jobToken.toLowerCase())
      ?.value ?? jobToken;
  const jobOptionMissing =
    jobToken !== "" && !jobOptions.some((option) => option.value === selectedJob);
  const creatorNames = purchaseOrderCreatorNames([
    ...enteredByRows.map((row) => row.enteredBy),
    // A name in the address that no order carries (any more) stays pickable,
    // so the dropdown shows what the list is filtered by.
    filters.createdBy || null,
  ]);
  const selectedCreator =
    creatorNames.find(
      (name) => name.toLowerCase() === filters.createdBy.toLowerCase(),
    ) ?? "";

  const rows = purchaseOrders.map(mapPurchaseOrderListRow);

  return (
    <DashboardShell
      title="Purchase Orders"
    >
      {/* The filters wrap inside their own space; New stays at the top right. */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <form method="get" className="flex min-w-0 flex-1 flex-wrap gap-2 text-xs">
          <input
            name="q"
            defaultValue={filters.search}
            placeholder="Search PO #, vendor, contractor or job…"
            className={`${filterBoxClassName} w-64`}
          />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className={filterBoxClassName}
          >
            <option value="">All statuses</option>
            {purchaseOrderStatusFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            name="vendor"
            defaultValue={filters.vendorId}
            className={filterBoxClassName}
          >
            <option value="">All vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className={filterBoxClassName}
          >
            <option value="">All categories</option>
            {purchaseOrderCategoryFormOptions.map((option) => (
              <option key={option.value || "one-off"} value={option.value || "one-off"}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            name="by"
            defaultValue={selectedCreator}
            aria-label="Created by"
            className={filterBoxClassName}
          >
            <option value="">Created by anyone</option>
            {creatorNames.map((name) => (
              <option key={name} value={name}>
                Created by {name}
              </option>
            ))}
          </select>
          <select
            name="contractor"
            defaultValue={filters.contractorId}
            aria-label="Contractor"
            className={`${filterBoxClassName} max-w-56`}
          >
            <option value="">All contractors</option>
            {contractorOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <select
            name="job"
            defaultValue={selectedJob}
            aria-label="Job"
            className={`${filterBoxClassName} max-w-64`}
          >
            <option value="">All jobs</option>
            {jobOptionMissing && filters.job ? (
              <option value={selectedJob}>
                {"name" in filters.job ? filters.job.name : "Job not on any order"}
              </option>
            ) : null}
            {jobOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {/* Filtering keeps the column the list is sorted by. */}
          {sort ? (
            <>
              <input type="hidden" name="sort" value={sort.column} />
              <input type="hidden" name="dir" value={sort.direction} />
            </>
          ) : null}
          <button
            type="submit"
            className="rounded-lg btn-plain px-3 py-2 font-medium"
          >
            Filter
          </button>
        </form>
        <Link
          href="/purchase-orders/new"
          className="shrink-0 whitespace-nowrap rounded-lg btn-main px-4 py-2 text-xs font-semibold"
        >
          New Purchase Order
        </Link>
      </div>

      <SectionCard title="Purchase Orders" noPadding>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No purchase orders match these filters.
          </p>
        ) : (
          <div className={tableFlushWrapperClassName}>
            {/* Tight to the left: each column as wide as what is in it. */}
            <table className={tableCompactClassName}>
              <thead>
                <tr>
                  <SortHeader column="po" sort={sort} hrefFor={sortHref}>
                    PO #
                  </SortHeader>
                  <SortHeader column="vendor" sort={sort} hrefFor={sortHref}>
                    Vendor
                  </SortHeader>
                  <SortHeader column="date" sort={sort} hrefFor={sortHref}>
                    Date
                  </SortHeader>
                  <SortHeader column="createdBy" sort={sort} hrefFor={sortHref}>
                    Created By
                  </SortHeader>
                  <SortHeader column="contractor" sort={sort} hrefFor={sortHref}>
                    Contractor
                  </SortHeader>
                  <SortHeader column="job" sort={sort} hrefFor={sortHref}>
                    Job
                  </SortHeader>
                  <th className={tableHeaderCellClassName}>Category</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={tableHeaderCellClassName}>Received</th>
                  <SortHeader column="total" sort={sort} hrefFor={sortHref}>
                    Total
                  </SortHeader>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {rows.map((row) => (
                  <tr key={row.id} className={tableRowClassName}>
                    <td className={`${listCellClassName} font-mono text-2xs font-medium`}>
                      <Link
                        href={`/purchase-orders/${row.id}`}
                        className="text-slate-900 hover:text-slate-700"
                      >
                        {row.poNumber}
                      </Link>
                    </td>
                    <td className={listCellClassName}>{row.vendorName}</td>
                    <td className={listCellClassName}>{row.orderDateLabel}</td>
                    <td className={listCellClassName}>
                      {row.enteredBy ?? <span className="text-slate-500">—</span>}
                    </td>
                    <td className={wrappingCellClassName}>
                      {row.contractors.length ? (
                        row.contractors.map((contractor) => contractor.name).join(", ")
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className={wrappingCellClassName}>
                      {row.jobs.length ? (
                        row.jobs.map((job) => job.label).join(", ")
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className={listCellClassName}>
                      <StatusBadge label={row.categoryLabel} variant="neutral" />
                    </td>
                    <td className={listCellClassName}>
                      <StatusBadge
                        label={row.statusLabel}
                        variant={row.statusVariant}
                      />
                    </td>
                    <td className={listCellClassName}>{row.receivedProgress}</td>
                    <td className={listCellClassName}>{formatUsd(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={pageInfo.page}
              totalPages={pageInfo.totalPages}
              fromIndex={pageInfo.fromIndex}
              toIndex={pageInfo.toIndex}
              total={pageInfo.total}
              noun="purchase order"
            />
          </div>
        )}
      </SectionCard>
    </DashboardShell>
  );
}
