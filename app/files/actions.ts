"use server";

import { revalidatePath } from "next/cache";
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
  revalidatePath("/files");
  if (jobId) {
    revalidatePath(`/files/jobs/${jobId}`);
  }
  revalidatePath(`/jobs/${jobId}/edit`);
}

export async function syncAllFiles() {
  await withDatabaseRetry((client) => syncAllJobFilesFromDisk(client));
  revalidatePath("/files");
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

export async function uploadJobFileAction(formData: FormData) {
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
  await withDatabaseRetry((client) => syncJobFilesFromDisk(client, jobId));
  revalidateFilesPaths(jobId);
}
