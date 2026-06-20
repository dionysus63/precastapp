"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncAllFiles } from "@/app/files/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { OpenFileButton } from "@/components/files/open-file-button";
import { JOB_SUBFOLDERS } from "@/lib/job-folder-constants";
import type { JobFileListRow, JobWithoutFolderRow } from "@/lib/job-file-mapper";

type FilesHubProps = {
  files: JobFileListRow[];
  jobsMissingFolders: JobWithoutFolderRow[];
  initialSearch: string;
  initialCategory: string;
};

export function FilesHub({
  files,
  jobsMissingFolders,
  initialSearch,
  initialCategory,
}: FilesHubProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);

  function applyFilters(nextSearch: string, nextCategory: string) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) {
      params.set("q", nextSearch.trim());
    }
    if (nextCategory && nextCategory !== "All") {
      params.set("category", nextCategory);
    }
    const query = params.toString();
    router.push(query ? `/files?${query}` : "/files");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            type="search"
            placeholder="Search job, customer, project, or file name…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters(search, category);
              }
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 sm:max-w-xs"
          />
          <select
            value={category}
            onChange={(event) => {
              const value = event.target.value;
              setCategory(value);
              applyFilters(search, value);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            <option value="All">All categories</option>
            {JOB_SUBFOLDERS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => applyFilters(search, category)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Search
          </button>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await syncAllFiles();
              router.refresh();
            })
          }
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Syncing…" : "Sync all from disk"}
        </button>
      </div>

      {jobsMissingFolders.length > 0 ? (
        <SectionCard
          title="Jobs without folders"
          description="Create a job folder before uploading project files."
        >
          <ul className="space-y-2 text-xs">
            {jobsMissingFolders.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900">{job.jobNumber}</span>
                <span className="text-slate-600">
                  {job.customerName} — {job.projectName}
                </span>
                <Link
                  href={`/jobs/${job.id}/edit`}
                  className="text-slate-700 underline hover:text-slate-900"
                >
                  Edit job
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Recent job files"
        description={`${files.length} file${files.length === 1 ? "" : "s"} shown`}
        noPadding
      >
        {files.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No files indexed yet. Create job folders, upload files, or sync from disk.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">File</th>
                  <th className="px-4 py-2 font-semibold">Category</th>
                  <th className="px-4 py-2 font-semibold">Job</th>
                  <th className="px-4 py-2 font-semibold">Customer</th>
                  <th className="px-4 py-2 font-semibold">Updated</th>
                  <th className="px-4 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {file.fileName}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{file.folderCategory}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/files/jobs/${file.jobId}`}
                        className="font-medium text-slate-900 hover:text-slate-700"
                      >
                        {file.jobNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{file.customerName}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                      {file.updatedAt}
                    </td>
                    <td className="px-4 py-2">
                      <OpenFileButton fileId={file.id} fileName={file.fileName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
