"use client";

import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import {
  type CustomerRow,
  customerStatusFormOptions,
} from "@/components/customers/customer-utils";
import { ExportExcelLink } from "@/components/shared/export-excel-link";
import type { PageInfo } from "@/lib/list-params";

type SortColumn =
  | "name"
  | "primaryContact"
  | "phone"
  | "email"
  | "status"
  | "lastActivity";

type SortDirection = "asc" | "desc";

type CustomersListProps = {
  customers: CustomerRow[];
  pageInfo: PageInfo;
  filters: { search: string; status: string };
  sort: { column: SortColumn; direction: SortDirection };
};

const sortableHeaderClassName =
  "cursor-pointer px-4 py-2.5 font-semibold transition-colors hover:bg-slate-100 hover:text-slate-700 select-none";

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

export function CustomersList({
  customers,
  pageInfo,
  filters,
  sort,
}: CustomersListProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  function handleSort(column: SortColumn) {
    const nextDirection: SortDirection =
      sort.column === column && sort.direction === "asc" ? "desc" : "asc";
    setParams({ sort: column, dir: nextDirection });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <input
            type="search"
            placeholder="Search customers, contacts, or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 sm:max-w-xs"
          />
          <select
            value={filters.status || "All"}
            onChange={(event) => setParams({ status: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            <option value="All">Status: All</option>
            {customerStatusFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Status: {option.label}
              </option>
            ))}
          </select>
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <SortableHeader
                  column="name"
                  label="Customer Name"
                  sortColumn={sort.column}
                  sortDirection={sort.direction}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="primaryContact"
                  label="Primary Contact"
                  sortColumn={sort.column}
                  sortDirection={sort.direction}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="phone"
                  label="Phone"
                  sortColumn={sort.column}
                  sortDirection={sort.direction}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="email"
                  label="Email"
                  sortColumn={sort.column}
                  sortDirection={sort.direction}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="status"
                  label="Status"
                  sortColumn={sort.column}
                  sortDirection={sort.direction}
                  onSort={handleSort}
                />
                <th className="px-4 py-2.5 font-semibold">Open Quotes</th>
                <th className="px-4 py-2.5 font-semibold">Balance</th>
                <SortableHeader
                  column="lastActivity"
                  label="Last Activity"
                  sortColumn={sort.column}
                  sortDirection={sort.direction}
                  onSort={handleSort}
                />
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    {pageInfo.total === 0
                      ? "No customers match your search or filters."
                      : "No customers on this page."}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="hover:text-slate-700 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {customer.primaryContact}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {customer.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={customer.status}
                        variant={customer.statusVariant}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {customer.openQuotes}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {customer.balance}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {customer.lastActivity}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          View
                        </Link>
                        <Link
                          href={`/customers/${customer.id}/edit`}
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
