import { access, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { JOB_SUBFOLDERS } from "@/lib/job-folder-constants";
import { assertUploadAllowed } from "@/lib/upload-validation";
import {
  resolveUniqueFilePath,
  sanitizeFileName,
} from "@/lib/file-upload-utils";

export type JobFolderCategory = (typeof JOB_SUBFOLDERS)[number];

export type JobFileRecord = {
  id: string;
  jobId: string;
  fileName: string;
  filePath: string;
  folderCategory: string;
  createdAt: Date;
  updatedAt: Date;
};

export type JobFileWithJob = JobFileRecord & {
  job: {
    id: string;
    jobNumber: string;
    customerName: string;
    projectName: string;
    folderPath: string | null;
  };
};

function normalizePath(value: string) {
  return path.normalize(value.trim());
}

function isJobFolderCategory(value: string): value is JobFolderCategory {
  return (JOB_SUBFOLDERS as readonly string[]).includes(value);
}

export function resolveCategoryPath(
  jobFolderPath: string,
  folderCategory: string,
): string {
  if (!isJobFolderCategory(folderCategory)) {
    throw new Error(`Invalid folder category: ${folderCategory}`);
  }

  return path.join(normalizePath(jobFolderPath), folderCategory);
}

export function assertPathUnderJobRoot(jobFolderPath: string, targetPath: string) {
  const root = normalizePath(jobFolderPath);
  const resolved = path.resolve(normalizePath(targetPath));
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error("File path is outside the job folder.");
  }
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function assertJobFolderPath(
  client: PrismaClient,
  jobId: string,
) {
  const job = await client.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      jobNumber: true,
      customerName: true,
      projectName: true,
      folderPath: true,
    },
  });

  if (!job) {
    throw new Error("Job was not found.");
  }

  const folderPath = job.folderPath?.trim();
  if (!folderPath) {
    throw new Error("This job does not have a folder path yet.");
  }

  if (!(await pathExists(folderPath))) {
    throw new Error(`Job folder not found: ${folderPath}`);
  }

  return { ...job, folderPath };
}

export async function registerJobFile(
  client: PrismaClient,
  jobId: string,
  filePath: string,
  folderCategory: string,
  fileName?: string,
): Promise<JobFileRecord> {
  const job = await assertJobFolderPath(client, jobId);
  assertPathUnderJobRoot(job.folderPath, filePath);

  if (!isJobFolderCategory(folderCategory)) {
    throw new Error(`Invalid folder category: ${folderCategory}`);
  }

  const normalizedPath = normalizePath(filePath);
  const resolvedName = fileName?.trim() || path.basename(normalizedPath);

  const existing = await client.jobFile.findFirst({
    where: { jobId, filePath: normalizedPath },
  });

  if (existing) {
    return client.jobFile.update({
      where: { id: existing.id },
      data: {
        fileName: resolvedName,
        folderCategory,
        updatedAt: new Date(),
      },
    });
  }

  return client.jobFile.create({
    data: {
      jobId,
      fileName: resolvedName,
      filePath: normalizedPath,
      folderCategory,
    },
  });
}

async function scanCategoryDirectory(
  client: PrismaClient,
  jobId: string,
  jobFolderPath: string,
  folderCategory: JobFolderCategory,
) {
  const categoryPath = resolveCategoryPath(jobFolderPath, folderCategory);
  if (!(await pathExists(categoryPath))) {
    return;
  }

  const entries = await readdir(categoryPath, { withFileTypes: true });
  const diskFiles = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = normalizePath(path.join(categoryPath, entry.name));
    diskFiles.set(filePath, entry.name);
  }

  // Load the whole category index once instead of one findFirst per disk file.
  const registered = await client.jobFile.findMany({
    where: { jobId, folderCategory },
    select: { id: true, filePath: true, fileName: true },
  });
  const registeredByPath = new Map(
    registered.map((row) => [normalizePath(row.filePath), row]),
  );

  const toCreate: {
    jobId: string;
    fileName: string;
    filePath: string;
    folderCategory: string;
  }[] = [];

  for (const [filePath, fileName] of diskFiles) {
    const existing = registeredByPath.get(filePath);
    if (!existing) {
      toCreate.push({ jobId, fileName, filePath, folderCategory });
      continue;
    }
    if (existing.fileName !== fileName) {
      await client.jobFile.update({
        where: { id: existing.id },
        data: { fileName, updatedAt: new Date() },
      });
    }
  }

  if (toCreate.length > 0) {
    await client.jobFile.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  // If the directory enumerated as empty but we have previously-indexed
  // files for this category, treat it as a suspicious/transient read
  // (e.g. a network-share hiccup) rather than evidence every file was
  // deleted, and skip the cleanup pass to avoid wiping the index.
  if (diskFiles.size === 0 && registered.length > 0) {
    return;
  }

  const idsToDelete = registered
    .filter((row) => !diskFiles.has(normalizePath(row.filePath)))
    .map((row) => row.id);

  if (idsToDelete.length > 0) {
    await client.jobFile.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }
}

export async function syncJobFilesFromDisk(
  client: PrismaClient,
  jobId: string,
): Promise<void> {
  const job = await assertJobFolderPath(client, jobId);

  for (const folderCategory of JOB_SUBFOLDERS) {
    await scanCategoryDirectory(
      client,
      jobId,
      job.folderPath,
      folderCategory,
    );
  }
}

export type SyncAllJobFilesResult = {
  synced: number;
  skipped: number;
  errors: { jobId: string; message: string }[];
};

export async function syncAllJobFilesFromDisk(
  client: PrismaClient,
): Promise<SyncAllJobFilesResult> {
  const jobs = await client.job.findMany({
    where: { folderPath: { not: null } },
    select: { id: true, folderPath: true },
  });

  const result: SyncAllJobFilesResult = {
    synced: 0,
    skipped: 0,
    errors: [],
  };

  for (const job of jobs) {
    if (!job.folderPath?.trim()) {
      result.skipped += 1;
      continue;
    }

    try {
      if (await pathExists(job.folderPath)) {
        await syncJobFilesFromDisk(client, job.id);
        result.synced += 1;
      } else {
        result.skipped += 1;
        result.errors.push({
          jobId: job.id,
          message: `Job folder not found: ${job.folderPath}`,
        });
      }
    } catch (error) {
      result.skipped += 1;
      result.errors.push({
        jobId: job.id,
        message:
          error instanceof Error ? error.message : "Could not sync job folder.",
      });
    }
  }

  return result;
}

/**
 * Read-only listing of indexed job files. Does NOT scan the disk; callers that
 * need to reconcile the index with disk must invoke `syncJobFilesFromDisk`
 * explicitly (e.g. on upload or an explicit "Refresh" action). Keeping this
 * read-only avoids a 10-folder disk scan on every page load.
 */
export async function listJobFiles(
  client: PrismaClient,
  jobId: string,
  folderCategory?: string,
): Promise<JobFileRecord[]> {
  return client.jobFile.findMany({
    where: {
      jobId,
      ...(folderCategory ? { folderCategory } : {}),
    },
    orderBy: [{ folderCategory: "asc" }, { fileName: "asc" }],
  });
}

export async function listRecentJobFiles(
  client: PrismaClient,
  limit = 50,
  filters?: {
    search?: string;
    folderCategory?: string;
    customerName?: string;
  },
): Promise<JobFileWithJob[]> {
  const search = filters?.search?.trim();
  const customerName = filters?.customerName?.trim();

  const rows = await client.jobFile.findMany({
    where: {
      ...(filters?.folderCategory
        ? { folderCategory: filters.folderCategory }
        : {}),
      ...(search
        ? {
            OR: [
              { fileName: { contains: search, mode: "insensitive" as const } },
              {
                job: {
                  jobNumber: { contains: search, mode: "insensitive" as const },
                },
              },
              {
                job: {
                  customerName: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                job: {
                  projectName: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
      ...(customerName
        ? {
            job: {
              customerName: { contains: customerName, mode: "insensitive" as const },
            },
          }
        : {}),
    },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          customerName: true,
          projectName: true,
          folderPath: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows;
}

export async function uploadJobFile(
  client: PrismaClient,
  jobId: string,
  folderCategory: string,
  file: File,
): Promise<JobFileRecord> {
  if (!isJobFolderCategory(folderCategory)) {
    throw new Error(`Invalid folder category: ${folderCategory}`);
  }

  assertUploadAllowed(file);

  const job = await assertJobFolderPath(client, jobId);
  const categoryPath = resolveCategoryPath(job.folderPath, folderCategory);

  if (!(await pathExists(categoryPath))) {
    throw new Error(`Category folder not found: ${folderCategory}`);
  }

  const safeName = sanitizeFileName(file.name);
  const outputPath = await resolveUniqueFilePath(categoryPath, safeName);
  assertPathUnderJobRoot(job.folderPath, outputPath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  return registerJobFile(
    client,
    jobId,
    outputPath,
    folderCategory,
    path.basename(outputPath),
  );
}

export async function getJobFileForOpen(
  client: PrismaClient,
  fileId: string,
) {
  const file = await client.jobFile.findUnique({
    where: { id: fileId },
    include: {
      job: {
        select: { folderPath: true, jobNumber: true },
      },
    },
  });

  if (!file) {
    throw new Error("File was not found.");
  }

  const folderPath = file.job.folderPath?.trim();
  if (!folderPath) {
    throw new Error("This job does not have a folder path.");
  }

  assertPathUnderJobRoot(folderPath, file.filePath);

  if (!(await pathExists(file.filePath))) {
    throw new Error(`File not found on disk: ${file.fileName}`);
  }

  const fileStat = await stat(file.filePath);
  if (!fileStat.isFile()) {
    throw new Error("Path is not a file.");
  }

  return file;
}
