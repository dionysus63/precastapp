import type { JobFileWithJob } from "@/lib/job-files-service";

export type JobFileListRow = {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  projectName: string;
  fileName: string;
  folderCategory: string;
  updatedAt: string;
};

export type JobWithoutFolderRow = {
  id: string;
  jobNumber: string;
  customerName: string;
  projectName: string;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function mapJobFileToListRow(file: JobFileWithJob): JobFileListRow {
  return {
    id: file.id,
    jobId: file.jobId,
    jobNumber: file.job.jobNumber,
    customerName: file.job.customerName,
    projectName: file.job.projectName,
    fileName: file.fileName,
    folderCategory: file.folderCategory,
    updatedAt: formatDateTime(file.updatedAt),
  };
}

export function mapJobFileRecordToRow(
  file: {
    id: string;
    jobId: string;
    fileName: string;
    folderCategory: string;
    updatedAt: Date;
  },
  job: {
    jobNumber: string;
    customerName: string;
    projectName: string;
  },
): JobFileListRow {
  return {
    id: file.id,
    jobId: file.jobId,
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    projectName: job.projectName,
    fileName: file.fileName,
    folderCategory: file.folderCategory,
    updatedAt: formatDateTime(file.updatedAt),
  };
}
