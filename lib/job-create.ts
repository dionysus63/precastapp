import { randomUUID } from "crypto";
import type { JobStatus, Prisma } from "@/app/generated/prisma/client";
import { createJobFoldersForJob } from "@/lib/job-folders";
import { prisma } from "@/lib/prisma";
import { translatePrismaError } from "@/lib/server/action-errors";

export type NewJobRecordInput = {
  year: number;
  customerId: string | null;
  customerName: string;
  projectName: string;
  projectAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: JobStatus;
  bidDate: Date | null;
  awardedDate: Date | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
};

export async function resolveCustomerName(
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

/**
 * Creates the job row (with the next job number for its year) and, when a
 * customer record is picked, its bid-list entry. Job folders are created
 * separately by `createJobFolders` so a file-share failure never loses the
 * job itself.
 */
export async function createJobRecord(data: NewJobRecordInput) {
  const customer = await resolveCustomerName(
    data.customerId,
    data.customerName,
  );

  return prisma
    .$transaction(async (tx) => {
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

      return job;
    })
    .catch((error) => {
      throw translatePrismaError(error);
    });
}

/**
 * Creates the job's folders on the file share and stores the path. Returns
 * false (job left without a folder) when the share can't be reached; the
 * job page offers a "Create Folder" retry.
 */
export async function createJobFolders(job: {
  id: string;
  year: number;
  jobNumber: string;
  projectName: string;
}): Promise<boolean> {
  let folderPath: string;
  try {
    folderPath = await createJobFoldersForJob({
      jobId: job.id,
      year: job.year,
      jobNumber: job.jobNumber,
      projectName: job.projectName,
    });
  } catch {
    return false;
  }

  await prisma.job.update({
    where: { id: job.id },
    data: { folderPath },
  });
  return true;
}
