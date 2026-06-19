import { access, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

// Change to a UNC path such as "\\\\SERVER\\Jobs" when moving to network storage.
export const JOBS_ROOT = "C:\\PrecastJobs";

export const JOB_SUBFOLDERS = [
  "01 Construction Plans",
  "02 Quotes",
  "03 Submittals",
  "04 Invoices",
  "05 Delivery Tickets",
  "06 Photos",
  "07 Purchase Orders",
  "08 Production",
  "09 Cut Sheets",
  "99 Misc",
] as const;

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*]/g;

export function sanitizeFolderName(value: string) {
  return value
    .replace(INVALID_FOLDER_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
}

export function buildJobFolderBaseName(
  jobNumber: string,
  customerName: string,
  projectName: string,
) {
  const folderName = sanitizeFolderName(
    `${jobNumber} - ${customerName} - ${projectName}`,
  );

  if (!folderName) {
    throw new Error("Job folder name is empty after sanitization.");
  }

  return folderName;
}

async function pathExists(folderPath: string) {
  try {
    await access(folderPath);
    return true;
  } catch {
    return false;
  }
}

async function isFolderPathTakenByAnotherJob(
  folderPath: string,
  jobId: string,
) {
  const existingJob = await prisma.job.findFirst({
    where: {
      folderPath,
      NOT: { id: jobId },
    },
    select: { id: true },
  });

  return existingJob !== null;
}

export async function resolveJobFolderPath(
  year: number,
  baseName: string,
  jobId: string,
) {
  const yearDirectory = path.join(JOBS_ROOT, String(year));
  await mkdir(yearDirectory, { recursive: true });

  const exactPath = path.join(yearDirectory, baseName);
  if (!(await pathExists(exactPath))) {
    return exactPath;
  }

  if (!(await isFolderPathTakenByAnotherJob(exactPath, jobId))) {
    return exactPath;
  }

  for (let suffix = 1; suffix <= 99; suffix += 1) {
    const candidatePath = path.join(yearDirectory, `${baseName}-${suffix}`);

    if (!(await pathExists(candidatePath))) {
      return candidatePath;
    }

    if (!(await isFolderPathTakenByAnotherJob(candidatePath, jobId))) {
      return candidatePath;
    }
  }

  throw new Error(
    `Could not find an available folder name for "${baseName}" in ${yearDirectory}.`,
  );
}

export async function createJobFolderStructure(folderPath: string) {
  await mkdir(folderPath, { recursive: true });

  for (const subfolder of JOB_SUBFOLDERS) {
    await mkdir(path.join(folderPath, subfolder), { recursive: true });
  }
}

export async function createJobFoldersForJob({
  jobId,
  year,
  jobNumber,
  customerName,
  projectName,
}: {
  jobId: string;
  year: number;
  jobNumber: string;
  customerName: string;
  projectName: string;
}) {
  const baseName = buildJobFolderBaseName(jobNumber, customerName, projectName);
  const folderPath = await resolveJobFolderPath(year, baseName, jobId);

  try {
    await createJobFolderStructure(folderPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown filesystem error.";
    throw new Error(`Failed to create job folders at ${folderPath}: ${message}`);
  }

  return folderPath;
}
