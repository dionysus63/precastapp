"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  type CustomerRow,
  customerStatusFilterOptions,
} from "@/components/customers/customer-utils";
import { ExportExcelLink } from "@/components/shared/export-excel-link";

type SortColumn =
  | "name"
  | "primaryContact"
  | "phone"
  | "email"
  | "status"
  | "openQuotes"
  | "balance"
  | "lastActivity";

type SortDirection = "asc" | "desc";

type CustomersListProps = {
  customers: CustomerRow[];
};

const sortableHeaderClassName =
  "cursor-pointer px-4 py-2.5 font-semibold transition-colors hover:bg-slate-100 hover:text-slate-700 select-none";

function parseBalance(value: string) {
  const amount = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function parseActivityDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareCustomers(
  a: CustomerRow,
  b: CustomerRow,
  column: SortColumn,
  direction: SortDirection,
) {
  let result = 0;

  switch (column) {
    case "name":
      result = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      break;
    case "primaryContact":
      result = a.primaryContact.localeCompare(b.primaryContact, undefined, {
        sensitivity: "base",
      });
      break;
    case "phone":
      result = a.phone.localeCompare(b.phone, undefined, { sensitivity: "base" });
      break;
    case "email":
      result = a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
      break;
    case "status":
      result = a.status.localeCompare(b.status, undefined, { sensitivity: "base" });
      break;
    case "openQuotes":
      result = a.openQuotes - b.openQuotes;
      break;
    case "balance":
      result = parseBalance(a.balance) - parseBalance(b.balance);
      break;
    case "lastActivity":
      result = parseActivityDate(a.lastActivity) - parseActivityDate(b.lastActivity);
      break;
  }

  return direction === "asc" ? result : -result;
}

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

export function CustomersList({ customers }: CustomersListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }

  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter((customer) => {
      const matchesSearch =
        search.trim() === "" ||
        customer.name.toLowerCase().includes(search.toLowerCase()) ||
        customer.primaryContact.toLowerCase().includes(search.toLowerCase()) ||
        customer.email.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || customer.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a, b) =>
      compareCustomers(a, b, sortColumn, sortDirection),
    );
  }, [customers, search, statusFilter, sortColumn, sortDirection]);

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
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {customerStatusFilterOptions.map((status) => (
              <option key={status} value={status}>
                Status: {status}
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
        description={`${filteredCustomers.length} customer${filteredCustomers.length === 1 ? "" : "s"} shown`}
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <SortableHeader
                  column="name"
                  label="Customer Name"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="primaryContact"
                  label="Primary Contact"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="phone"
                  label="Phone"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="email"
                  label="Email"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="status"
                  label="Status"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="openQuotes"
                  label="Open Quotes"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="balance"
                  label="Balance"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="lastActivity"
                  label="Last Activity"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    {customers.length === 0
                      ? "No customers yet. Add your first customer to get started."
                      : "No customers match your search or filters."}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
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
      </SectionCard>
    </div>
  );
}
