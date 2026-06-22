"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  assertJobFolderPath,
  getJobFileForOpen,
  listJobFiles,
  listRecentJobFiles,
  resolveCategoryPath,
  syncAllJobFilesFromDisk,
  syncJobFilesFromDisk,
  uploadJobFile,
} from "@/lib/job-files-service";
import { assertPathUnderJobFolder } from "@/lib/job-path-security";
import {
  assertPathAccessible,
  launchWindowsFile,
  launchWindowsFolder,
} from "@/lib/windows-explorer";
import { withDatabaseRetry } from "@/lib/prisma";

export type ExplorerOpenResult = {
  success: true;
  path: string;
};

function revalidateFilesPaths(jobId?: string) {
  revalidatePath("/files", "page");
  if (jobId) {
    revalidatePath(`/files/jobs/${jobId}`, "page");
    revalidatePath(`/jobs/${jobId}`, "page");
    revalidatePath(`/jobs/${jobId}/edit`, "page");
  }
}

export type SyncAllFilesResult = {
  synced: number;
  skipped: number;
  errors: { jobId: string; message: string }[];
};

export async function syncAllFiles(): Promise<SyncAllFilesResult> {
  await requirePermission(AppPermission.FILES_MANAGE);
  const result = await withDatabaseRetry((client) =>
    syncAllJobFilesFromDisk(client),
  );
  revalidatePath("/files");
  return result;
}

export async function listRecentFiles(filters?: {
  search?: string;
  folderCategory?: string;
  customerName?: string;
}) {
  return withDatabaseRetry((client) =>
    listRecentJobFiles(client, 50, filters),
  );
}

export async function listJobsMissingFolders() {
  return withDatabaseRetry((client) =>
    client.job.findMany({
      where: { OR: [{ folderPath: null }, { folderPath: "" }] },
      orderBy: [{ year: "desc" }, { sequenceNumber: "desc" }],
      select: {
        id: true,
        jobNumber: true,
        customerName: true,
        projectName: true,
      },
      take: 20,
    }),
  );
}

export async function getJobFilesForBrowser(jobId: string, category?: string) {
  return withDatabaseRetry(async (client) => {
    const job = await assertJobFolderPath(client, jobId);
    const files = await listJobFiles(client, jobId, category);
    return { job, files };
  });
}

export async function listJobFilesAction(
  jobId: string,
  folderCategory?: string,
) {
  await requirePermission(AppPermission.FILES_VIEW);
  return withDatabaseRetry((client) =>
    listJobFiles(client, jobId, folderCategory),
  );
}

export async function uploadJobFileAction(formData: FormData) {
  await requirePermission(AppPermission.FILES_MANAGE);
  const jobId = String(formData.get("jobId") ?? "").trim();
  const folderCategory = String(formData.get("folderCategory") ?? "").trim();
  const file = formData.get("file");

  if (!jobId) {
    throw new Error("Job is required.");
  }

  if (!folderCategory) {
    throw new Error("Folder category is required.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to upload.");
  }

  await withDatabaseRetry((client) =>
    uploadJobFile(client, jobId, folderCategory, file),
  );

  revalidateFilesPaths(jobId);
}

export async function openJobFile(fileId: string): Promise<
  ExplorerOpenResult & { fileName: string }
> {
  await requirePermission(AppPermission.FILES_VIEW);
  const file = await withDatabaseRetry((client) =>
    getJobFileForOpen(client, fileId),
  );

  assertPathUnderJobFolder(file.job.folderPath!, file.filePath);
  await launchWindowsFile(file.filePath);

  return {
    success: true,
    path: file.filePath,
    fileName: file.fileName,
  };
}

export async function openJobFolderCategory(
  jobId: string,
  category: string,
): Promise<ExplorerOpenResult> {
  await requirePermission(AppPermission.FILES_VIEW);
  const job = await withDatabaseRetry((client) =>
    assertJobFolderPath(client, jobId),
  );

  const categoryPath = resolveCategoryPath(job.folderPath, category);
  assertPathUnderJobFolder(job.folderPath, categoryPath);
  await assertPathAccessible(categoryPath, "directory");
  await launchWindowsFolder(categoryPath);

  return { success: true, path: categoryPath };
}

export async function syncJobFilesAction(jobId: string) {
  await requirePermission(AppPermission.FILES_MANAGE);
  await withDatabaseRetry((client) => syncJobFilesFromDisk(client, jobId));
  revalidateFilesPaths(jobId);
}
