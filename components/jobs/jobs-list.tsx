"use client";

import Link from "next/link";
import { memo, useCallback, useMemo } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PaginationControls } from "@/components/common/pagination-controls";
import {
  useDebouncedSearchParam,
  useListQuery,
} from "@/components/common/use-list-query";
import {
  type JobRow,
  jobStatusLabels,
} from "@/components/jobs/job-utils";
import { JobFavoriteStar } from "@/components/jobs/job-favorite-star";
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
type JobsListFilters = {
  search: string;
  status: string;
  year: string;
  customer: string;
};

type SortColumn =
  | "jobNumber"
  | "projectName"
  | "customer"
  | "projectAddress"
  | "status"
  | "bidDate"
  | "awardedDate"
  | "lastActivity";

type SortDirection = "asc" | "desc";

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

type JobTabCounts = {
  open: number;
  complete: number;
  closed: number;
  all: number;
};

type JobsListProps = {
  jobs: JobRow[];
  favoriteJobs: JobRow[];
  favoriteJobIds: string[];
  pageInfo: PageInfo;
  filters: JobsListFilters;
  tabCounts: JobTabCounts;
  yearOptions: string[];
  customerOptions: string[];
  sort: { column: SortColumn; direction: SortDirection };
};

// Memoized so per-keystroke search-input state updates in JobsList don't
// re-render every favorite chip; props only change on navigation.
// Renders nothing until the user pins a job (via the star in the table).
const JobsFavorites = memo(function JobsFavorites({
  favoriteJobs,
  favoriteIdSet,
}: {
  favoriteJobs: JobRow[];
  favoriteIdSet: Set<string>;
}) {
  if (favoriteJobs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        Pinned
      </span>
      {favoriteJobs.map((job) => (
        <div
          key={job.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
        >
          <JobFavoriteStar
            jobId={job.id}
            initialFavorited={favoriteIdSet.has(job.id)}
          />
          <Link
            href={`/jobs/${job.id}`}
            className="shrink-0 font-mono text-[11px] font-semibold text-slate-900 hover:text-slate-700"
          >
            {job.jobNumber}
          </Link>
          <span className="text-slate-300">·</span>
          <Link
            href={`/jobs/${job.id}`}
            className="max-w-[140px] truncate font-medium text-slate-800 hover:text-slate-600 sm:max-w-[200px]"
          >
            {job.projectName}
          </Link>
          <span className="hidden text-slate-400 sm:inline">·</span>
          <span className="hidden max-w-[120px] truncate text-slate-500 sm:inline">
            {job.customer}
          </span>
          <StatusBadge label={job.status} variant={job.statusVariant} />
        </div>
      ))}
    </div>
  );
});

// Memoized so typing in the search box doesn't re-render the full row set;
// rows only change when the server sends a new page.
const JobsTable = memo(function JobsTable({
  jobs,
  favoriteIdSet,
  total,
  sortColumn,
  sortDirection,
  onSort,
}: {
  jobs: JobRow[];
  favoriteIdSet: Set<string>;
  total: number;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const sortableHeaders: Array<{ column: SortColumn; label: string }> = [
    { column: "jobNumber", label: "Job Number" },
    { column: "projectName", label: "Project Name" },
    { column: "customer", label: "Customer" },
    { column: "projectAddress", label: "Project Address" },
    { column: "status", label: "Status" },
    { column: "bidDate", label: "Bid Date" },
    { column: "awardedDate", label: "Awarded Date" },
    { column: "lastActivity", label: "Last Activity" },
  ];

  return (
    <div className={tableFlushWrapperClassName}>
      <table className={tableClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellWrapClassName}>
              <span className="sr-only">Favorite</span>
            </th>
            {sortableHeaders.map((header) => (
              <SortableHeader
                key={header.column}
                column={header.column}
                label={header.label}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {jobs.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className={`${tableCellBordersClassName} px-4 py-8 text-center text-sm text-slate-500`}
              >
                {total === 0
                  ? "No jobs match your search or filters."
                  : "No jobs on this page."}
              </td>
            </tr>
          ) : (
            jobs.map((job) => (
              <tr key={job.id} className={tableRowClassName}>
                <td className={tableCellClassName}>
                  <JobFavoriteStar
                    jobId={job.id}
                    initialFavorited={favoriteIdSet.has(job.id)}
                  />
                </td>
                <td className={`${tableCellClassName} font-mono text-[11px] font-medium text-slate-900`}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="hover:text-slate-600 hover:underline"
                  >
                    {job.jobNumber}
                  </Link>
                </td>
                <td className={`${tableCellClassName} font-medium text-slate-900`}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="hover:text-slate-600 hover:underline"
                  >
                    {job.projectName}
                  </Link>
                </td>
                <td className={`${tableCellClassName} text-slate-700`}>{job.customer}</td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {job.projectAddress}
                </td>
                <td className={tableCellClassName}>
                  <StatusBadge
                    label={job.status}
                    variant={job.statusVariant}
                  />
                </td>
                <td className={`${tableCellClassName} text-slate-600`}>{job.bidDate}</td>
                <td className={`${tableCellClassName} text-slate-600`}>
                  {job.awardedDate}
                </td>
                <td className={`${tableCellClassName} whitespace-nowrap text-slate-600`}>
                  {job.lastActivity}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

export function JobsList({
  jobs,
  favoriteJobs,
  favoriteJobIds,
  pageInfo,
  filters,
  tabCounts,
  yearOptions,
  customerOptions,
  sort,
}: JobsListProps) {
  const { setParams } = useListQuery();
  const { search, setSearch } = useDebouncedSearchParam("q", filters.search);

  const handleSort = useCallback(
    (column: SortColumn) => {
      // First click on a column sorts ascending, except job number where
      // newest-first is the natural order (and the page default).
      const initialDirection: SortDirection =
        column === "jobNumber" ? "desc" : "asc";
      const nextDirection: SortDirection =
        sort.column === column
          ? sort.direction === "asc"
            ? "desc"
            : "asc"
          : initialDirection;
      setParams({ sort: column, dir: nextDirection });
    },
    [sort.column, sort.direction, setParams],
  );

  const favoriteIdSet = useMemo(
    () => new Set(favoriteJobIds),
    [favoriteJobIds],
  );

  const statusTabs = [
    {
      label: "Open",
      param: "",
      count: tabCounts.open,
      isActive: filters.status === "" || filters.status === "OPEN",
    },
    {
      label: "Complete",
      param: "COMPLETE",
      count: tabCounts.complete,
      isActive: filters.status === "COMPLETE",
    },
    {
      label: "Closed",
      param: "CLOSED",
      count: tabCounts.closed,
      isActive: filters.status === "CLOSED",
    },
    {
      label: "All",
      param: "ALL",
      count: tabCounts.all,
      isActive: filters.status === "ALL" || filters.status === "All",
    },
  ];
  // A single-status link (e.g. the dashboard's ?status=ACTIVE) isn't a tab —
  // surface it as a removable filter chip instead.
  const singleStatusLabel =
    filters.status && !statusTabs.some((tab) => tab.isActive)
      ? jobStatusLabels[filters.status] ?? filters.status
      : null;

  return (
    <div className="space-y-4">
      <JobsFavorites
        favoriteJobs={favoriteJobs}
        favoriteIdSet={favoriteIdSet}
      />

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
          {singleStatusLabel ? (
            <button
              type="button"
              onClick={() => setParams({ status: "" })}
              title="Clear status filter"
              className="mb-1 ml-2 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Status: {singleStatusLabel}
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap">
          <input
            type="search"
            placeholder="Search job number, project, customer, or address..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 lg:max-w-xs"
          />
          <select
            value={filters.year || "All"}
            onChange={(event) => setParams({ year: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                Year: {year}
              </option>
            ))}
          </select>
          <select
            value={filters.customer || "All"}
            onChange={(event) => setParams({ customer: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {customerOptions.map((customer) => (
              <option key={customer} value={customer}>
                Customer: {customer}
              </option>
            ))}
          </select>
        </div>

        <Link
          href="/jobs/new"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          New Job
        </Link>
      </div>

      <SectionCard
        title="Job List"
        description={`${pageInfo.total.toLocaleString()} job${pageInfo.total === 1 ? "" : "s"} match`}
        noPadding
      >
        <JobsTable
          jobs={jobs}
          favoriteIdSet={favoriteIdSet}
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
          noun="job"
        />
      </SectionCard>
    </div>
  );
}
