"use client";

import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import {
  contactRoleLabels,
  type ContactRoleValue,
} from "@/components/customers/customer-utils";
import {
  CustomersPageTabs,
  type CustomersPageTabCounts,
} from "@/components/customers/customers-page-tabs";
import type { PageInfo } from "@/lib/list-params";
import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellWrapClassName,
  tableRowClassName,
} from "@/lib/table-styles";

export type ContactDirectoryRow = {
  id: string;
  name: string;
  title: string;
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  roles: ContactRoleValue[];
  /** Roles this contact is the company's default for. */
  defaultForRoles: ContactRoleValue[];
};

export type ContactSortColumn = "name" | "company" | "title";

type ContactsDirectoryProps = {
  rows: ContactDirectoryRow[];
  pageInfo: PageInfo;
  counts: CustomersPageTabCounts;
  companies: { id: string; name: string }[];
  filters: { search: string; companyId: string; status: string };
  sort: { column: ContactSortColumn; direction: "asc" | "desc" };
};

const roleChipClassNames: Record<ContactRoleValue, string> = {
  ESTIMATING: "bg-sky-100 text-sky-800",
  BILLING: "bg-amber-100 text-amber-800",
  FIELD: "bg-emerald-100 text-emerald-800",
};

const sortableHeaderClassName = `${tableHeaderCellWrapClassName} cursor-pointer select-none transition-colors hover:bg-slate-200/60 hover:text-slate-700`;

export function ContactsDirectory({
  rows,
  pageInfo,
  counts,
  companies,
  filters,
  sort,
}: ContactsDirectoryProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  function handleSort(column: ContactSortColumn) {
    const nextDirection =
      sort.column === column && sort.direction === "asc" ? "desc" : "asc";
    setParams({ sort: column, dir: nextDirection });
  }

  const header = (column: ContactSortColumn, label: string) => (
    <th
      scope="col"
      className={sortableHeaderClassName}
      onClick={() => handleSort(column)}
      aria-sort={
        sort.column === column
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.column === column ? (
          <span className="text-slate-400" aria-hidden="true">
            {sort.direction === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      <CustomersPageTabs view="contacts" status={filters.status} counts={counts} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search contacts, email, or company..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 sm:max-w-xs"
        />
        <select
          value={filters.companyId}
          onChange={(event) =>
            setParams({ company: event.target.value || null, page: null })
          }
          aria-label="Filter by company"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm sm:max-w-xs"
        >
          <option value="">All companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      <SectionCard
        title="Contacts"
        description={`${pageInfo.total.toLocaleString()} contact${pageInfo.total === 1 ? "" : "s"}`}
        noPadding
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                {header("name", "Name")}
                {header("title", "Title")}
                {header("company", "Company")}
                <th scope="col" className={tableHeaderCellWrapClassName}>
                  Roles
                </th>
                <th scope="col" className={tableHeaderCellWrapClassName}>
                  Phone
                </th>
                <th scope="col" className={tableHeaderCellWrapClassName}>
                  Email
                </th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`${tableCellBordersClassName} px-4 py-8 text-center text-sm text-slate-500`}
                  >
                    No contacts match your search or filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="hover:text-slate-700 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {row.title || "—"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="hover:text-slate-900 hover:underline"
                      >
                        {row.customerName}
                      </Link>
                    </td>
                    <td className={tableCellClassName}>
                      <div className="flex flex-wrap gap-1">
                        {row.isPrimary ? (
                          <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            Main
                          </span>
                        ) : null}
                        {row.roles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleChipClassNames[role]}`}
                          >
                            {contactRoleLabels[role] ?? role}
                            {row.defaultForRoles.includes(role) ? (
                              <span
                                title={`Default ${(contactRoleLabels[role] ?? role).toLowerCase()} contact`}
                                aria-hidden
                              >
                                ★
                              </span>
                            ) : null}
                          </span>
                        ))}
                        {!row.isPrimary && row.roles.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${tableCellClassName} whitespace-nowrap text-slate-600`}>
                      {row.phone ? (
                        <a href={`tel:${row.phone}`} className="hover:underline">
                          {row.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {row.email ? (
                        <a href={`mailto:${row.email}`} className="hover:underline">
                          {row.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <PaginationControls
        page={pageInfo.page}
        totalPages={pageInfo.totalPages}
        fromIndex={pageInfo.fromIndex}
        toIndex={pageInfo.toIndex}
        total={pageInfo.total}
        noun="contact"
      />
    </div>
  );
}
