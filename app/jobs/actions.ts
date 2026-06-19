"use server";

import { randomUUID } from "crypto";
import { access } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createJobFoldersForJob } from "@/lib/job-folders";
import { launchWindowsFolder } from "@/lib/open-windows-folder";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

const JOB_STATUSES = [
  "LEAD",
  "QUOTING",
  "SUBMITTED",
  "AWARDED",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETE",
  "LOST",
  "CANCELLED",
] as const;

type JobStatus = (typeof JOB_STATUSES)[number];

function parseOptionalDate(formData: FormData, field: string) {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field}.`);
  }

  return date;
}

function parseJobFormData(formData: FormData) {
  const projectName = String(formData.get("projectName") ?? "").trim();
  if (!projectName) {
    throw new Error("Project name is required.");
  }

  const jobYearRaw = String(formData.get("jobYear") ?? "").trim();
  if (!jobYearRaw) {
    throw new Error("Job year is required.");
  }

  const year = Number(jobYearRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2099) {
    throw new Error("Job year must be a valid year.");
  }

  const status = String(formData.get("status") ?? "QUOTING").trim();
  if (!JOB_STATUSES.includes(status as JobStatus)) {
    throw new Error("Invalid job status.");
  }

  const customerId = String(formData.get("customerId") ?? "").trim() || null;
  const manualCustomerName = String(formData.get("customerName") ?? "").trim();

  return {
    projectName,
    year,
    status: status as JobStatus,
    customerId,
    manualCustomerName,
    projectAddress: String(formData.get("projectAddress") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    state: String(formData.get("state") ?? "").trim() || null,
    zip: String(formData.get("zip") ?? "").trim() || null,
    bidDate: parseOptionalDate(formData, "bidDate"),
    awardedDate: parseOptionalDate(formData, "awardedDate"),
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    contactEmail: String(formData.get("contactEmail") ?? "").trim() || null,
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

function parseJobUpdateFormData(formData: FormData) {
  const projectName = String(formData.get("projectName") ?? "").trim();
  if (!projectName) {
    throw new Error("Project name is required.");
  }

  const status = String(formData.get("status") ?? "QUOTING").trim();
  if (!JOB_STATUSES.includes(status as JobStatus)) {
    throw new Error("Invalid job status.");
  }

  const customerId = String(formData.get("customerId") ?? "").trim() || null;
  const manualCustomerName = String(formData.get("customerName") ?? "").trim();

  return {
    projectName,
    status: status as JobStatus,
    customerId,
    manualCustomerName,
    projectAddress: String(formData.get("projectAddress") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    state: String(formData.get("state") ?? "").trim() || null,
    zip: String(formData.get("zip") ?? "").trim() || null,
    bidDate: parseOptionalDate(formData, "bidDate"),
    awardedDate: parseOptionalDate(formData, "awardedDate"),
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    contactEmail: String(formData.get("contactEmail") ?? "").trim() || null,
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
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
    throw new Error("Select a customer or enter a customer name.");
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

export async function openJobFolder(jobId: string) {
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
    await access(folderPath);
  } catch {
    throw new Error(`Job folder not found: ${folderPath}`);
  }

  if (process.platform !== "win32") {
    throw new Error("Opening job folders is supported on Windows only.");
  }

  try {
    await launchWindowsFolder(folderPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Explorer error.";
    throw new Error(`Could not open job folder: ${message}`);
  }

  return { jobNumber: job.jobNumber, folderPath };
}

export async function createJobFolder(jobId: string) {
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

  revalidatePath("/jobs");

  return { jobNumber: job.jobNumber, folderPath };
}
