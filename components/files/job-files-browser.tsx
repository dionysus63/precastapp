"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  listJobFilesAction,
  openJobFolderCategory,
  syncJobFilesAction,
  uploadJobFileAction,
} from "@/app/files/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { FileUploadDropzone } from "@/components/files/file-upload-dropzone";
import { OpenFileButton } from "@/components/files/open-file-button";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import { OpenJobFolderButton } from "@/components/jobs/open-job-folder-button";
import { JOB_SUBFOLDERS } from "@/lib/job-folder-constants";
import {
  mapFilesForBrowser,
  type JobFileBrowserItem,
} from "@/lib/job-file-mapper";

type JobFilesBrowserProps = {
  jobId: string;
  jobNumber: string;
  customerName: string;
  projectName: string;
  folderPath: string | null;
  files: JobFileBrowserItem[];
  activeCategory: string;
  basePath?: string;
  baseQuery?: Record<string, string>;
  lockedCategory?: string;
};

function formatFolderCategoryLabel(category: string) {
  return category.replace(/^\d+\s+/, "").trim() || category;
}

function FolderActionRow({
  pending,
  onOpenFolder,
  onRefresh,
  openError,
  openSuccess,
}: {
  pending: boolean;
  onOpenFolder: () => void;
  onRefresh: () => void;
  openError: string | null;
  openSuccess: string | null;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onOpenFolder}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Open folder in Explorer
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onRefresh}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "Refreshing…" : "Refresh file list"}
        </button>
      </div>
      {openError ? (
        <p className="mt-2 text-xs text-red-600">{openError}</p>
      ) : null}
      {openSuccess ? (
        <p className="mt-2 truncate text-xs text-green-700" title={openSuccess}>
          {openSuccess}
        </p>
      ) : null}
    </div>
  );
}

export function JobFilesBrowser({
  jobId,
  jobNumber,
  customerName,
  projectName,
  folderPath,
  files,
  activeCategory,
  basePath = `/files/jobs/${jobId}`,
  baseQuery,
  lockedCategory,
}: JobFilesBrowserProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [displayFiles, setDisplayFiles] = useState(files);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openSuccess, setOpenSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDisplayFiles(files);
  }, [files]);

  const buildCategoryHref = (categoryValue?: string) => {
    const params = new URLSearchParams(baseQuery);
    if (categoryValue) {
      params.set("category", categoryValue);
    }
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const category = lockedCategory || activeCategory || "All";
  const categoryLabel =
    category === "All" ? "All files" : formatFolderCategoryLabel(category);
  const visibleFiles =
    category === "All"
      ? displayFiles
      : displayFiles.filter((file) => file.folderCategory === category);

  const uploadCategory =
    category !== "All" ? category : JOB_SUBFOLDERS[0];
  const uploadCategoryLabel = formatFolderCategoryLabel(uploadCategory);

  async function refreshDisplayedFiles() {
    const categoryFilter = category !== "All" ? category : undefined;
    const records = await listJobFilesAction(jobId, categoryFilter);
    setDisplayFiles(mapFilesForBrowser(records));
  }

  function handleOpenFolder() {
    if (category === "All") {
      return;
    }

    setOpenError(null);
    setOpenSuccess(null);
    startTransition(async () => {
      try {
        const result = await openJobFolderCategory(jobId, category);
        setOpenSuccess(`Opened in Explorer: ${result.path}`);
      } catch (err) {
        setOpenError(
          err instanceof Error ? err.message : "Could not open folder.",
        );
      }
    });
  }

  function handleRefresh() {
    setOpenError(null);
    setOpenSuccess(null);
    startTransition(async () => {
      await syncJobFilesAction(jobId);
      await refreshDisplayedFiles();
      router.refresh();
    });
  }

  function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      setUploadError("Choose at least one file to upload.");
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    const fileCount = selectedFiles.length;

    startTransition(async () => {
      try {
        for (let index = 0; index < selectedFiles.length; index += 1) {
          const file = selectedFiles[index];
          setUploadProgress(
            fileCount > 1
              ? `Uploading ${index + 1} of ${fileCount}…`
              : "Uploading…",
          );

          const formData = new FormData();
          formData.set("jobId", jobId);
          formData.set("folderCategory", uploadCategory);
          formData.set("file", file);
          await uploadJobFileAction(formData);
        }

        setSelectedFiles([]);
        setUploadProgress(null);
        setUploadSuccess(
          fileCount === 1
            ? "File uploaded."
            : `${fileCount} files uploaded.`,
        );
        await refreshDisplayedFiles();
        router.refresh();
      } catch (err) {
        setUploadProgress(null);
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

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

  const uploadTitle = lockedCategory
    ? "Upload construction plans"
    : "Upload file";
  const uploadDescription = lockedCategory
    ? `Files are saved to the ${uploadCategoryLabel} folder on this job.`
    : `Files are saved to ${uploadCategory}.`;
  const dropzoneLabel = lockedCategory
    ? "Drag construction plan files here"
    : `Drag files here to upload to ${uploadCategoryLabel}`;
  const filesListTitle = lockedCategory ? "Current plans" : categoryLabel;

  return (
    <div className="space-y-4">
      {lockedCategory ? null : (
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
                onClick={handleRefresh}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {pending ? "Refreshing…" : "Refresh file list"}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {lockedCategory ? null : (
        <div className="flex flex-wrap gap-2">
          <CategoryTab
            label="All"
            href={buildCategoryHref()}
            active={category === "All"}
          />
          {JOB_SUBFOLDERS.map((item) => (
            <CategoryTab
              key={item}
              label={item}
              href={buildCategoryHref(item)}
              active={category === item}
            />
          ))}
        </div>
      )}

      <SectionCard
        title={filesListTitle}
        description={`${visibleFiles.length} file${visibleFiles.length === 1 ? "" : "s"}`}
        noPadding
      >
        {lockedCategory ? (
          <div className="border-b border-slate-100 px-4 py-3">
            <FolderActionRow
              pending={pending}
              onOpenFolder={handleOpenFolder}
              onRefresh={handleRefresh}
              openError={openError}
              openSuccess={openSuccess}
            />
          </div>
        ) : null}

        {!lockedCategory && category !== "All" ? (
          <div className="border-b border-slate-100 px-4 py-2">
            <button
              type="button"
              disabled={pending}
              onClick={handleOpenFolder}
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
          lockedCategory ? (
            <div className="mx-4 my-6 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No plans yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Drag files below or click to browse.
              </p>
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">
              No files in this category yet.
            </p>
          )
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

      <SectionCard
        title={uploadTitle}
        description={uploadDescription}
      >
        <form className="space-y-4" onSubmit={handleUpload}>
          <FileUploadDropzone
            files={selectedFiles}
            onFilesChange={setSelectedFiles}
            disabled={pending}
            label={dropzoneLabel}
            description="PDF, DWG, images, and other project files accepted."
            inputId={`job-file-upload-${jobId}`}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || selectedFiles.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {uploadProgress ??
                (pending
                  ? "Uploading…"
                  : selectedFiles.length === 0
                    ? "Upload"
                    : selectedFiles.length === 1
                      ? "Upload 1 file"
                      : `Upload ${selectedFiles.length} files`)}
            </button>
            {!lockedCategory && category !== "All" ? (
              <button
                type="button"
                disabled={pending}
                onClick={handleOpenFolder}
                className="text-xs font-medium text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
              >
                Open folder in Explorer
              </button>
            ) : null}
          </div>

          {uploadError ? (
            <p className="text-xs text-red-600">{uploadError}</p>
          ) : null}
          {uploadSuccess ? (
            <p className="text-xs text-green-700">{uploadSuccess}</p>
          ) : null}
          {!lockedCategory && (openError || openSuccess) ? (
            <>
              {openError ? (
                <p className="text-xs text-red-600">{openError}</p>
              ) : null}
              {openSuccess ? (
                <p className="truncate text-xs text-green-700" title={openSuccess}>
                  {openSuccess}
                </p>
              ) : null}
            </>
          ) : null}
        </form>
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
