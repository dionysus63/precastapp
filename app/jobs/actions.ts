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
import {
  getEnum,
  getOptionalDate,
  getOptionalString,
  getRequiredString,
} from "@/lib/server/form-data";

const JOB_STATUSES = Object.values(JobStatus);

function parseJobFormData(formData: FormData) {
  const projectName = getRequiredString(formData, "projectName", "Project name");
  const jobYearRaw = getRequiredString(formData, "jobYear", "Job year");

  const year = Number(jobYearRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2099) {
    throw new Error("Job year must be a valid year.");
  }

  const status = getEnum(formData, "status", JOB_STATUSES, {
    label: "job status",
    defaultValue: "QUOTING",
  });

  const customerId = getOptionalString(formData, "customerId");
  const manualCustomerName = String(formData.get("customerName") ?? "").trim();

  return {
    projectName,
    year,
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
  });

  let folderPath: string;
  try {
    folderPath = await createJobFoldersForJob({
      jobId: job.id,
      year: numbering.year,
      jobNumber: numbering.jobNumber,
      customerName: customer.customerName,
      projectName: data.projectName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown folder creation error.";
    throw new Error(
      `Job ${job.jobNumber} was saved, but job folder creation failed. ${message}`,
    );
  }

  await prisma.job.update({
    where: { id: job.id },
    data: { folderPath },
  });

  revalidatePath("/jobs");
  redirect("/jobs");
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

  await prisma.job.update({
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
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}/edit`);
  redirect("/jobs");
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

  const structure = await prisma.jobStructure.create({
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

  try {
    await launchWindowsFolder(folderPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Explorer error.";
    throw new Error(`Could not open job folder: ${message}`);
  }

  return { success: true as const, path: folderPath, jobNumber: job.jobNumber };
}

export async function createJobFolder(jobId: string) {
  await requirePermission(AppPermission.FILES_MANAGE);
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      year: true,
      jobNumber: true,
      customerName: true,
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
      customerName: job.customerName,
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

  await launchWindowsFile(document.filePath);

  return {
    success: true,
    path: document.filePath,
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

  await launchFolder(folderPath, { allowedRoot: jobFolderPath });

  return { success: true, path: folderPath };
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
