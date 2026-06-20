"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  openJobFolderCategory,
  syncJobFilesAction,
  uploadJobFileAction,
} from "@/app/files/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { OpenFileButton } from "@/components/files/open-file-button";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import { OpenJobFolderButton } from "@/components/jobs/open-job-folder-button";
import { JOB_SUBFOLDERS } from "@/lib/job-folder-constants";

type JobFileBrowserItem = {
  id: string;
  fileName: string;
  folderCategory: string;
  updatedAt: string;
};

type JobFilesBrowserProps = {
  jobId: string;
  jobNumber: string;
  customerName: string;
  projectName: string;
  folderPath: string | null;
  files: JobFileBrowserItem[];
  activeCategory: string;
};

function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function JobFilesBrowser({
  jobId,
  jobNumber,
  customerName,
  projectName,
  folderPath,
  files,
  activeCategory,
}: JobFilesBrowserProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openSuccess, setOpenSuccess] = useState<string | null>(null);

  const category = activeCategory || "All";
  const visibleFiles =
    category === "All"
      ? files
      : files.filter((file) => file.folderCategory === category);

  const uploadCategory =
    category !== "All" ? category : JOB_SUBFOLDERS[0];

  if (!folderPath) {
    return (
      <SectionCard title="Job folder required">
        <p className="mb-3 text-sm text-slate-600">
          {jobNumber} — {projectName} ({customerName}) does not have a folder yet.
        </p>
        <CreateJobFolderButton jobId={jobId} />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Job folder">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {jobNumber} — {projectName}
            </p>
            <p className="text-xs text-slate-600">{customerName}</p>
            <p
              className="mt-2 truncate font-mono text-[11px] text-slate-500"
              title={folderPath}
            >
              {folderPath}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OpenJobFolderButton jobId={jobId} folderPath={folderPath} />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await syncJobFilesAction(jobId);
                  router.refresh();
                })
              }
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {pending ? "Syncing…" : "Sync from disk"}
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <CategoryTab
          label="All"
          href={`/files/jobs/${jobId}`}
          active={category === "All"}
        />
        {JOB_SUBFOLDERS.map((item) => (
          <CategoryTab
            key={item}
            label={item}
            href={`/files/jobs/${jobId}?category=${encodeURIComponent(item)}`}
            active={category === item}
          />
        ))}
      </div>

      <SectionCard title="Upload file">
        <form
          className="grid max-w-lg gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            setUploadError(null);
            startTransition(async () => {
              try {
                await uploadJobFileAction(formData);
                form.reset();
                router.refresh();
              } catch (err) {
                setUploadError(
                  err instanceof Error ? err.message : "Upload failed.",
                );
              }
            });
          }}
        >
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="folderCategory" value={uploadCategory} />
          <div className="sm:col-span-2">
            <label htmlFor="file" className="text-xs font-medium text-slate-700">
              Upload to {uploadCategory}
            </label>
            <input
              id="file"
              name="file"
              type="file"
              required
              className="mt-1 block w-full text-xs text-slate-700"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "Uploading…" : "Upload"}
            </button>
            {uploadError ? (
              <p className="mt-2 text-xs text-red-600">{uploadError}</p>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title={category === "All" ? "All files" : category}
        description={`${visibleFiles.length} file${visibleFiles.length === 1 ? "" : "s"}`}
        noPadding
      >
        {category !== "All" ? (
          <div className="border-b border-slate-100 px-4 py-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpenError(null);
                setOpenSuccess(null);
                startTransition(async () => {
                  try {
                    const result = await openJobFolderCategory(jobId, category);
                    setOpenSuccess(`Opened in Explorer: ${result.path}`);
                  } catch (err) {
                    setOpenError(
                      err instanceof Error
                        ? err.message
                        : "Could not open folder.",
                    );
                  }
                });
              }}
              className="text-xs font-medium text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
            >
              Open folder in Explorer
            </button>
            {openError ? (
              <p className="mt-1 text-[10px] text-red-600">{openError}</p>
            ) : null}
            {openSuccess ? (
              <p
                className="mt-1 truncate text-[10px] text-green-700"
                title={openSuccess}
              >
                {openSuccess}
              </p>
            ) : null}
          </div>
        ) : null}

        {visibleFiles.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No files in this category yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">File</th>
                  {category === "All" ? (
                    <th className="px-4 py-2 font-semibold">Category</th>
                  ) : null}
                  <th className="px-4 py-2 font-semibold">Updated</th>
                  <th className="px-4 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleFiles.map((file) => (
                  <tr key={file.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {file.fileName}
                    </td>
                    {category === "All" ? (
                      <td className="px-4 py-2 text-slate-600">
                        {file.folderCategory}
                      </td>
                    ) : null}
                    <td className="px-4 py-2 text-slate-600">{file.updatedAt}</td>
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

function CategoryTab({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}

export function mapFilesForBrowser(
  files: { id: string; fileName: string; folderCategory: string; updatedAt: Date }[],
) {
  return files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    folderCategory: file.folderCategory,
    updatedAt: formatDateTime(file.updatedAt),
  }));
}
