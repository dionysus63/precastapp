"use client";

import Link from "next/link";
import { memo, useCallback } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import { type CustomerRow } from "@/components/customers/customer-utils";
import { ExportExcelLink } from "@/components/shared/export-excel-link";
import type { PageInfo } from "@/lib/list-params";
import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellWrapClassName,
  tableNumericCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

type SortColumn = "name" | "phone" | "town" | "status" | "lastActivity";

type SortDirection = "asc" | "desc";

type CustomerTabCounts = {
  active: number;
  prospect: number;
  inactive: number;
  all: number;
};

type CustomersListProps = {
  customers: CustomerRow[];
  pageInfo: PageInfo;
  tabCounts: CustomerTabCounts;
  filters: { search: string; status: string };
  sort: { column: SortColumn; direction: SortDirection };
};

const sortableHeaderClassName = `${tableHeaderCellWrapClassName} cursor-pointer select-none transition-colors hover:bg-slate-200/60 hover:text-slate-700`;

type SortableHeaderProps = {
  column: SortColumn;
  label: string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
};

function SortableHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps) {
  const isActive = sortColumn === column;

  return (
    <th
      scope="col"
      className={sortableHeaderClassName}
      onClick={() => onSort(column)}
      aria-sort={
        isActive
          ? sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          <span className="text-slate-400" aria-hidden="true">
            {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </span>
    </th>
  );
}

// Memoized so typing in the search box doesn't re-render the full row set;
// props only change on navigation (rows, sort state) and onSort is stable.
const CustomersTable = memo(function CustomersTable({
  customers,
  total,
  sortColumn,
  sortDirection,
  onSort,
}: {
  customers: CustomerRow[];
  total: number;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  return (
    <div className={tableFlushWrapperClassName}>
      <table className={tableClassName}>
        <thead>
          <tr>
            <SortableHeader
              column="name"
              label="Customer Name"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortableHeader
              column="phone"
              label="Phone"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortableHeader
              column="town"
              label="Town"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortableHeader
              column="status"
              label="Status"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <th className={`${tableHeaderCellWrapClassName} text-right`}>
              Open Quotes
            </th>
            <th className={`${tableHeaderCellWrapClassName} text-right`}>
              Balance
            </th>
            <SortableHeader
              column="lastActivity"
              label="Last Activity"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={onSort}
            />
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {customers.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className={`${tableCellBordersClassName} px-4 py-8 text-center text-sm text-slate-500`}
              >
                {total === 0
                  ? "No customers match your search or filters."
                  : "No customers on this page."}
              </td>
            </tr>
          ) : (
            customers.map((customer) => (
              <tr key={customer.id} className={tableRowClassName}>
                <td className={`${tableCellClassName} font-medium text-slate-900`}>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="hover:text-slate-700 hover:underline"
                  >
                    {customer.name}
                  </Link>
                </td>
                <td
                  className={`${tableCellClassName} whitespace-nowrap text-slate-600`}
                >
                  {customer.phone}
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {customer.town}
                </td>
                <td className={tableCellClassName}>
                  <StatusBadge
                    label={customer.status}
                    variant={customer.statusVariant}
                  />
                </td>
                <td className={`${tableNumericCellClassName} text-slate-700`}>
                  {customer.openQuotes}
                </td>
                <td
                  className={`${tableNumericCellClassName} font-medium text-slate-900`}
                >
                  {customer.balance}
                </td>
                <td
                  className={`${tableCellClassName} whitespace-nowrap text-slate-600`}
                >
                  {customer.lastActivity}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

export function CustomersList({
  customers,
  pageInfo,
  tabCounts,
  filters,
  sort,
}: CustomersListProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  const handleSort = useCallback(
    (column: SortColumn) => {
      const nextDirection: SortDirection =
        sort.column === column && sort.direction === "asc" ? "desc" : "asc";
      setParams({ sort: column, dir: nextDirection });
    },
    [sort.column, sort.direction, setParams],
  );

  const statusTabs = [
    {
      label: "Active",
      param: "",
      count: tabCounts.active,
      isActive: filters.status === "" || filters.status === "ACTIVE",
    },
    {
      label: "Prospects",
      param: "PROSPECT",
      count: tabCounts.prospect,
      isActive: filters.status === "PROSPECT",
    },
    {
      label: "Inactive",
      param: "INACTIVE",
      count: tabCounts.inactive,
      isActive: filters.status === "INACTIVE",
    },
    {
      label: "All",
      param: "ALL",
      count: tabCounts.all,
      isActive: filters.status === "ALL" || filters.status === "All",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200">
        <div className="-mb-px flex flex-wrap items-center gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setParams({ status: tab.param })}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab.isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 ${tab.isActive ? "text-slate-500" : "text-slate-400"}`}
              >
                {tab.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <input
            type="search"
            placeholder="Search customers, contacts, or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 sm:max-w-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportExcelLink href="/api/export/customers" />
          <Link
            href="/customers/bulk"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Bulk Add / Paste from Excel
          </Link>
          <Link
            href="/customers/contacts/bulk"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Import Contacts
          </Link>
          <Link
            href="/customers/new"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Add Customer
          </Link>
        </div>
      </div>

      <SectionCard
        title="Customer Directory"
        description={`${pageInfo.total.toLocaleString()} customer${pageInfo.total === 1 ? "" : "s"} match`}
        noPadding
      >
        <CustomersTable
          customers={customers}
          total={pageInfo.total}
          sortColumn={sort.column}
          sortDirection={sort.direction}
          onSort={handleSort}
        />
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="customer"
        />
      </SectionCard>
    </div>
  );
}
