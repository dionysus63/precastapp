"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createJobFoldersForJob } from "@/lib/job-folders";
import {
  deleteJobStructureDocument,
  getJobStructureDocumentForOpen,
  getJobStructureSubmittalDir,
  uploadJobStructureDocument,
} from "@/lib/job-structure-documents-service";
import { launchWindowsFolder } from "@/lib/open-windows-folder";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import { launchWindowsFile, launchWindowsFolder as launchFolder } from "@/lib/windows-explorer";
import { assertPathUnderJobFolder } from "@/lib/job-path-security";
import { AppPermission, JobStatus, Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { translatePrismaError } from "@/lib/server/action-errors";
import {
  getEnum,
  getOptionalDate,
  getOptionalString,
  getRequiredString,
} from "@/lib/server/form-data";

const JOB_STATUSES = Object.values(JobStatus);

function parseJobFormData(formData: FormData) {
  const projectName = getRequiredString(formData, "projectName", "Project name");
  const year = new Date().getFullYear();

  const customerId = getOptionalString(formData, "customerId");
  const manualCustomerName = String(formData.get("customerName") ?? "").trim();

  return {
    projectName,
    year,
    status: "QUOTING" as JobStatus,
    customerId,
    manualCustomerName,
    projectAddress: getOptionalString(formData, "projectAddress"),
    city: getOptionalString(formData, "city"),
    state: getOptionalString(formData, "state"),
    zip: getOptionalString(formData, "zip"),
    bidDate: getOptionalDate(formData, "bidDate"),
    awardedDate: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    notes: getOptionalString(formData, "notes"),
  };
}

function parseJobUpdateFormData(formData: FormData) {
  const projectName = getRequiredString(formData, "projectName", "Project name");
  const status = getEnum(formData, "status", JOB_STATUSES, {
    label: "job status",
    defaultValue: "QUOTING",
  });

  const customerId = getOptionalString(formData, "customerId");
  const manualCustomerName = String(formData.get("customerName") ?? "").trim();

  return {
    projectName,
    status,
    customerId,
    manualCustomerName,
    projectAddress: getOptionalString(formData, "projectAddress"),
    city: getOptionalString(formData, "city"),
    state: getOptionalString(formData, "state"),
    zip: getOptionalString(formData, "zip"),
    bidDate: getOptionalDate(formData, "bidDate"),
    awardedDate: getOptionalDate(formData, "awardedDate"),
    contactName: getOptionalString(formData, "contactName"),
    contactEmail: getOptionalString(formData, "contactEmail"),
    contactPhone: getOptionalString(formData, "contactPhone"),
    notes: getOptionalString(formData, "notes"),
  };
}

async function resolveCustomerName(
  customerId: string | null,
  manualCustomerName: string,
) {
  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { name: true },
    });

    if (!customer) {
      throw new Error("Selected customer was not found.");
    }

    return { customerId, customerName: customer.name };
  }

  if (!manualCustomerName) {
    return { customerId: null, customerName: "Unassigned" };
  }

  return { customerId: null, customerName: manualCustomerName };
}

function formatJobNumber(year: number, sequenceNumber: number) {
  const yearTwoDigit = year % 100;
  return `${String(yearTwoDigit).padStart(2, "0")}-${String(sequenceNumber).padStart(3, "0")}`;
}

async function allocateJobNumber(
  tx: Prisma.TransactionClient,
  year: number,
) {
  // INSERT ... ON CONFLICT DO UPDATE is a single atomic statement in
  // Postgres: it takes a row lock for the duration of the statement, so
  // concurrent calls for the same year (including the very first job of a
  // new year) serialize correctly instead of racing on a separate
  // read-then-write.
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "JobSequence" ("id", "year", "lastNumber", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${year}, 1, NOW(), NOW())
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = "JobSequence"."lastNumber" + 1, "updatedAt" = NOW()
    RETURNING "lastNumber"
  `;

  const sequenceNumber = Number(rows[0].lastNumber);
  const yearTwoDigit = year % 100;
  const jobNumber = formatJobNumber(year, sequenceNumber);

  const duplicate = await tx.job.findUnique({
    where: { jobNumber },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error(`Job number ${jobNumber} already exists.`);
  }

  return {
    year,
    yearTwoDigit,
    sequenceNumber,
    jobNumber,
  };
}

export async function createJob(formData: FormData) {
  await requirePermission(AppPermission.JOBS_MANAGE);
  const data = parseJobFormData(formData);
  const customer = await resolveCustomerName(
    data.customerId,
    data.manualCustomerName,
  );

  const { job, numbering } = await prisma.$transaction(async (tx) => {
    const numbering = await allocateJobNumber(tx, data.year);

    const job = await tx.job.create({
      data: {
        jobNumber: numbering.jobNumber,
        year: numbering.year,
        yearTwoDigit: numbering.yearTwoDigit,
        sequenceNumber: numbering.sequenceNumber,
        customerId: customer.customerId,
        customerName: customer.customerName,
        projectName: data.projectName,
        projectAddress: data.projectAddress,
        city: data.city,
        state: data.state,
        zip: data.zip,
        status: data.status,
        bidDate: data.bidDate,
        awardedDate: data.awardedDate,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        notes: data.notes,
      },
    });

    if (customer.customerId) {
      await tx.jobBidder.create({
        data: {
          jobId: job.id,
          customerId: customer.customerId,
          sortOrder: 0,
          isWinner:
            data.status === "AWARDED" ||
            data.status === "ACTIVE" ||
            Boolean(data.awardedDate),
        },
      });
    }

    return { job, numbering };
  }).catch((error) => {
    throw translatePrismaError(error);
  });

  let folderPath: string;
  try {
    folderPath = await createJobFoldersForJob({
      jobId: job.id,
      year: numbering.year,
      jobNumber: numbering.jobNumber,
      projectName: data.projectName,
    });
  } catch {
    // The job itself is saved; land the user on its detail page where the
    // "Create Folder" retry button is shown, instead of an error screen.
    revalidatePath("/jobs");
    redirect(`/jobs/${job.id}?folderError=1`);
  }

  await prisma.job.update({
    where: { id: job.id },
    data: { folderPath },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/files");
  revalidatePath(`/files/jobs/${job.id}`);
  redirect(`/jobs/${job.id}`);
}

export async function updateJob(formData: FormData) {
  await requirePermission(AppPermission.JOBS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Job id is required.");
  }

  const existing = await prisma.job.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Job was not found.");
  }

  const data = parseJobUpdateFormData(formData);
  const customer = await resolveCustomerName(
    data.customerId,
    data.manualCustomerName,
  );

  await prisma.job
    .update({
      where: { id },
      data: {
        customerId: customer.customerId,
        customerName: customer.customerName,
        projectName: data.projectName,
        projectAddress: data.projectAddress,
        city: data.city,
        state: data.state,
        zip: data.zip,
        status: data.status,
        bidDate: data.bidDate,
        awardedDate: data.awardedDate,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        notes: data.notes,
      },
    })
    .catch((error) => {
      // Friendly message when the job was deleted concurrently (P2025).
      throw translatePrismaError(error);
    });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}/edit`);
  redirect("/jobs");
}

/** Inline status change from the jobs list. */
export async function updateJobStatusAction(jobId: string, status: string) {
  await requirePermission(AppPermission.JOBS_MANAGE);
  if (!JOB_STATUSES.includes(status as JobStatus)) {
    throw new Error("Invalid job status.");
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { awardedDate: true },
  });
  if (!job) {
    throw new Error("Job was not found.");
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: status as JobStatus,
      // First transition into AWARDED stamps the award date.
      ...(status === "AWARDED" && !job.awardedDate
        ? { awardedDate: new Date() }
        : {}),
    },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}

/** Inline contractor (customer) change from the jobs list. */
export async function updateJobCustomerAction(
  jobId: string,
  customerId: string | null,
) {
  await requirePermission(AppPermission.JOBS_MANAGE);

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true },
  });
  if (!job) {
    throw new Error("Job was not found.");
  }

  const customer = await resolveCustomerName(customerId?.trim() || null, "");
  await prisma.job.update({
    where: { id: jobId },
    data: {
      customerId: customer.customerId,
      customerName: customer.customerName,
    },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}

const STRUCTURE_TYPES = [
  "STOCK_PRODUCT",
  "CONFIGURABLE_PRODUCT",
  "CUSTOM_STRUCTURE",
] as const;

type StructureType = (typeof STRUCTURE_TYPES)[number];

function parseOptionalDecimal(formData: FormData, field: string) {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${field}.`);
  }

  return new Prisma.Decimal(raw);
}

export async function createJobStructure(formData: FormData) {
  await requirePermission(AppPermission.JOBS_MANAGE);
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) {
    throw new Error("Job id is required.");
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true },
  });

  if (!job) {
    throw new Error("Job was not found.");
  }

  const structureType = String(formData.get("structureType") ?? "").trim();
  if (!STRUCTURE_TYPES.includes(structureType as StructureType)) {
    throw new Error("Invalid structure type.");
  }

  const status = "NOT_SUBMITTED";

  const structure = await prisma.jobStructure
    .create({
      data: {
        jobId,
        structureType: structureType as StructureType,
        status,
        structureNumber:
          String(formData.get("structureNumber") ?? "").trim() || null,
        description: String(formData.get("description") ?? "").trim() || null,
        unit: String(formData.get("unit") ?? "").trim() || null,
        quantity: parseOptionalDecimal(formData, "quantity"),
        weight: parseOptionalDecimal(formData, "weight"),
        yards: parseOptionalDecimal(formData, "yards"),
        needsCutSheet: formData.get("needsCutSheet") === "on",
        needsSubmittal:
          structureType === "CUSTOM_STRUCTURE" ||
          formData.get("needsSubmittal") === "on",
        notes: String(formData.get("notes") ?? "").trim() || null,
      },
    })
    .catch((error) => {
      // Friendly message when the job was deleted concurrently (P2003/P2025).
      throw translatePrismaError(error);
    });

  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}/structures/${structure.id}`);
}

export async function openJobFolder(jobId: string) {
  await requirePermission(AppPermission.FILES_MANAGE);
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { folderPath: true, jobNumber: true },
  });

  if (!job) {
    throw new Error("Job was not found.");
  }

  const folderPath = job.folderPath?.trim();
  if (!folderPath) {
    throw new Error("This job does not have a folder path yet.");
  }

  let launched = true;
  try {
    launched = (await launchWindowsFolder(folderPath)).launched;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Explorer error.";
    throw new Error(`Could not open job folder: ${message}`);
  }

  return {
    success: true as const,
    path: folderPath,
    launched,
    jobNumber: job.jobNumber,
  };
}

export async function createJobFolder(jobId: string) {
  await requirePermission(AppPermission.FILES_MANAGE);
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      year: true,
      jobNumber: true,
      projectName: true,
      folderPath: true,
    },
  });

  if (!job) {
    throw new Error("Job was not found.");
  }

  if (job.folderPath) {
    throw new Error("This job already has a folder.");
  }

  let folderPath: string;
  try {
    folderPath = await createJobFoldersForJob({
      jobId: job.id,
      year: job.year,
      jobNumber: job.jobNumber,
      projectName: job.projectName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown folder creation error.";
    throw new Error(`Could not create job folder: ${message}`);
  }

  await prisma.job.update({
    where: { id: job.id },
    data: { folderPath },
  });

  revalidatePath("/files");
  revalidatePath(`/files/jobs/${job.id}`);
  revalidatePath(`/jobs/${job.id}/edit`);
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/production");

  return { jobNumber: job.jobNumber, folderPath };
}

export type JobStructureExplorerOpenResult = {
  success: true;
  path: string;
  /** False when the browser is on another machine: the client opens `path`
   * itself (desktop shell) or shows it (plain browser). */
  launched: boolean;
};

function revalidateJobStructurePaths(
  jobId: string,
  jobStructureId: string,
  quoteId?: string | null,
) {
  revalidatePath("/production");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/structures/${jobStructureId}`);
  if (quoteId) {
    revalidatePath(`/quotes/${quoteId}`);
  }
}

export async function uploadJobStructureDocumentAction(formData: FormData) {
  await requirePermission(AppPermission.JOBS_MANAGE);
  const jobStructureId = String(formData.get("jobStructureId") ?? "").trim();
  const jobId = String(formData.get("jobId") ?? "").trim();
  const documentType = String(
    formData.get("documentType") ?? "JOB_SPECIFIC_SUBMITTAL",
  ).trim();
  const file = formData.get("file");

  if (!jobStructureId || !jobId) {
    throw new Error("Structure is required.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to upload.");
  }

  const structure = await withDatabaseRetry((client) =>
    client.jobStructure.findUnique({
      where: { id: jobStructureId },
      select: { quoteId: true },
    }),
  );

  await withDatabaseRetry((client) =>
    uploadJobStructureDocument(client, jobStructureId, documentType, file),
  );

  revalidateJobStructurePaths(jobId, jobStructureId, structure?.quoteId);
}

export async function openJobStructureDocument(
  documentId: string,
): Promise<JobStructureExplorerOpenResult & { documentName: string }> {
  await requirePermission(AppPermission.FILES_MANAGE);
  const document = await withDatabaseRetry((client) =>
    getJobStructureDocumentForOpen(client, documentId),
  );

  if (process.platform !== "win32") {
    throw new Error("Opening files is supported on Windows only.");
  }

  const launch = await launchWindowsFile(document.filePath);

  return {
    success: true,
    path: document.filePath,
    launched: launch.launched,
    documentName: document.documentName,
  };
}

export async function openJobStructureSubmittalsFolder(
  jobStructureId: string,
): Promise<JobStructureExplorerOpenResult> {
  await requirePermission(AppPermission.FILES_MANAGE);
  const structure = await withDatabaseRetry((client) =>
    client.jobStructure.findUnique({
      where: { id: jobStructureId },
      include: { job: { select: { folderPath: true } } },
    }),
  );

  if (!structure) {
    throw new Error("Structure was not found.");
  }

  const jobFolderPath = structure.job?.folderPath?.trim();
  if (!jobFolderPath) {
    throw new Error("This job does not have a folder path yet.");
  }

  const folderPath = await withDatabaseRetry((client) =>
    getJobStructureSubmittalDir(client, jobStructureId),
  );
  assertPathUnderJobFolder(jobFolderPath, folderPath);

  if (process.platform !== "win32") {
    throw new Error("Opening folders is supported on Windows only.");
  }

  const launch = await launchFolder(folderPath, { allowedRoot: jobFolderPath });

  return { success: true, path: folderPath, launched: launch.launched };
}

export async function deleteJobStructureDocumentAction(documentId: string) {
  await requirePermission(AppPermission.JOBS_MANAGE);
  const document = await withDatabaseRetry((client) =>
    client.jobStructureDocument.findUnique({
      where: { id: documentId },
      include: {
        jobStructure: { select: { id: true, jobId: true, quoteId: true } },
      },
    }),
  );

  if (!document) {
    throw new Error("Document was not found.");
  }

  await withDatabaseRetry((client) =>
    deleteJobStructureDocument(client, documentId),
  );

  if (document.jobStructure.jobId) {
    revalidateJobStructurePaths(
      document.jobStructure.jobId,
      document.jobStructure.id,
      document.jobStructure.quoteId,
    );
  }
}

export async function toggleJobFavorite(
  jobId: string,
): Promise<{ favorited: boolean }> {
  const user = await requirePermission(AppPermission.JOBS_VIEW);
  const trimmedJobId = jobId.trim();

  if (!trimmedJobId) {
    throw new Error("Job id is required.");
  }

  const job = await prisma.job.findUnique({
    where: { id: trimmedJobId },
    select: { id: true },
  });

  if (!job) {
    throw new Error("Job not found.");
  }

  const existing = await prisma.jobFavorite.findUnique({
    where: {
      userId_jobId: {
        userId: user.id,
        jobId: trimmedJobId,
      },
    },
  });

  if (existing) {
    await prisma.jobFavorite.delete({ where: { id: existing.id } });
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${trimmedJobId}`);
    return { favorited: false };
  }

  await prisma.jobFavorite.create({
    data: {
      userId: user.id,
      jobId: trimmedJobId,
    },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${trimmedJobId}`);
  return { favorited: true };
}

export type JobFormCustomerOption = {
  id: string;
  name: string;
};

export async function searchCustomersForJobForm(
  query: string,
): Promise<JobFormCustomerOption[]> {
  await requirePermission(AppPermission.JOBS_MANAGE);

  const trimmed = query.trim();
  return withDatabaseRetry((client) =>
    client.customer.findMany({
      where: trimmed
        ? { name: { contains: trimmed, mode: "insensitive" } }
        : {},
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true },
    }),
  );
}
