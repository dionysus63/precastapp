import type { JobRow } from "@/components/jobs/job-utils";
import { jobStatusLabels } from "@/components/jobs/job-utils";

export type JobRecord = {
  id: string;
  jobNumber: string;
  year: number;
  customerName: string;
  projectName: string;
  projectAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  bidDate: Date | null;
  awardedDate: Date | null;
  folderPath: string | null;
  updatedAt: Date;
};

function statusVariant(status: string): JobRow["statusVariant"] {
  switch (status) {
    case "ACTIVE":
    case "AWARDED":
    case "COMPLETE":
      return "success";
    case "QUOTING":
    case "SUBMITTED":
    case "LEAD":
      return "info";
    case "ON_HOLD":
    case "LOST":
      return "warning";
    default:
      return "neutral";
  }
}

function formatJobDate(date: Date | null | undefined) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatProjectAddress(job: JobRecord) {
  const parts = [
    job.projectAddress,
    [job.city, job.state].filter(Boolean).join(", "),
    job.zip,
  ].filter((part) => part && part.trim() !== "");

  return parts.join(", ") || "—";
}

export function mapJobToRow(job: JobRecord): JobRow {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    projectName: job.projectName,
    customer: job.customerName,
    projectAddress: formatProjectAddress(job),
    status: jobStatusLabels[job.status] ?? job.status,
    statusVariant: statusVariant(job.status),
    year: job.year,
    bidDate: formatJobDate(job.bidDate),
    awardedDate: formatJobDate(job.awardedDate),
    folderPath: job.folderPath,
    lastActivity: formatJobDate(job.updatedAt),
  };
}
