"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  type JobRow,
  buildJobCustomerFilterOptions,
  buildJobYearFilterOptions,
  jobStatusFilterOptions,
} from "@/components/jobs/job-utils";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import { OpenJobFolderButton } from "@/components/jobs/open-job-folder-button";

type JobsListProps = {
  jobs: JobRow[];
};

export function JobsList({ jobs }: JobsListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");

  const yearFilterOptions = useMemo(
    () => buildJobYearFilterOptions(jobs.map((job) => job.year)),
    [jobs],
  );

  const customerFilterOptions = useMemo(
    () => buildJobCustomerFilterOptions(jobs.map((job) => job.customer)),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        search.trim() === "" ||
        job.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        job.projectName.toLowerCase().includes(search.toLowerCase()) ||
        job.customer.toLowerCase().includes(search.toLowerCase()) ||
        job.projectAddress.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || job.status === statusFilter;

      const matchesYear =
        yearFilter === "All" || String(job.year) === yearFilter;

      const matchesCustomer =
        customerFilter === "All" || job.customer === customerFilter;

      return matchesSearch && matchesStatus && matchesYear && matchesCustomer;
    });
  }, [jobs, search, statusFilter, yearFilter, customerFilter]);

  return (
    <div className="space-y-4">
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
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {jobStatusFilterOptions.map((status) => (
              <option key={status} value={status}>
                Status: {status}
              </option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {yearFilterOptions.map((year) => (
              <option key={year} value={year}>
                Year: {year}
              </option>
            ))}
          </select>
          <select
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {customerFilterOptions.map((customer) => (
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
        description={`${filteredJobs.length} job${filteredJobs.length === 1 ? "" : "s"} shown`}
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Job Number</th>
                <th className="px-4 py-2.5 font-semibold">Project Name</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Project Address</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Bid Date</th>
                <th className="px-4 py-2.5 font-semibold">Awarded Date</th>
                <th className="px-4 py-2.5 font-semibold">Folder</th>
                <th className="px-4 py-2.5 font-semibold">Last Activity</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    {jobs.length === 0
                      ? "No jobs yet. Create your first job to get started."
                      : "No jobs match your search or filters."}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-[11px] font-medium text-slate-900">
                      {job.jobNumber}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {job.projectName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{job.customer}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {job.projectAddress}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={job.status}
                        variant={job.statusVariant}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{job.bidDate}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {job.awardedDate}
                    </td>
                    <td className="max-w-[220px] px-4 py-2.5">
                      {job.folderPath ? (
                        <OpenJobFolderButton
                          jobId={job.id}
                          folderPath={job.folderPath}
                        />
                      ) : (
                        <CreateJobFolderButton jobId={job.id} />
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {job.lastActivity}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/jobs/${job.id}/edit`}
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
