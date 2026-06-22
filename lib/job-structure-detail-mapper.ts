import type {
  JobStructure,
  JobStructureDocument,
  JobStructureDocumentType,
} from "@/app/generated/prisma/client";
import type { JobStatusVariant } from "@/components/jobs/job-utils";
import {
  structureStatusOptions,
  structureTypeOptions,
  type StructureStatus,
  type StructureType,
} from "@/components/structures/structure-utils";
import { formatJobStructureDocumentTypeLabel } from "@/lib/job-structure-documents-service";

const structureStatusLabels: Record<string, string> = Object.fromEntries(
  structureStatusOptions.map((option) => [option.value, option.label]),
);

const structureTypeLabels: Record<string, string> = Object.fromEntries(
  structureTypeOptions.map((option) => [
    option.value,
    option.label.split(" — ")[1] ?? option.label,
  ]),
);

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatQuantity(value: { toString(): string } | null | undefined): string {
  if (value == null) {
    return "—";
  }

  const amount = Number.parseFloat(value.toString());
  if (!Number.isFinite(amount)) {
    return "—";
  }

  return amount.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function structureStatusVariant(status: string): JobStatusVariant {
  switch (status) {
    case "MADE":
    case "SHIPPED":
      return "success";
    case "APPROVED":
    case "IN_PRODUCTION":
      return "info";
    case "SUBMITTED":
      return "warning";
    default:
      return "neutral";
  }
}

export type JobStructureDocumentRow = {
  id: string;
  documentName: string;
  documentTypeLabel: string;
  uploadedDate: string;
  fileSize: string;
};

export type JobStructureWorkflowStep = {
  status: StructureStatus;
  label: string;
  date: string;
  isComplete: boolean;
  isCurrent: boolean;
};

export type JobStructureDetailView = {
  id: string;
  jobId: string;
  jobNumber: string;
  projectName: string;
  quoteId: string | null;
  quoteNumber: string | null;
  structureNumber: string;
  description: string;
  typeLabel: string;
  quantity: string;
  unit: string;
  status: StructureStatus;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  needsSubmittal: boolean;
  needsCutSheet: boolean;
  notes: string;
  folderPath: string | null;
  submittedDate: string;
  approvedDate: string;
  productionDate: string;
  madeDate: string;
  shippedDate: string;
  jobSpecificSubmittalCount: number;
  documents: JobStructureDocumentRow[];
  workflowSteps: JobStructureWorkflowStep[];
};

const WORKFLOW_STATUSES: StructureStatus[] = [
  "NOT_SUBMITTED",
  "SUBMITTED",
  "APPROVED",
  "IN_PRODUCTION",
  "MADE",
];

const WORKFLOW_DATE_FIELDS: Record<
  StructureStatus,
  keyof Pick<
    JobStructure,
    "submittedDate" | "approvedDate" | "productionDate" | "madeDate"
  >
> = {
  NOT_SUBMITTED: "submittedDate",
  SUBMITTED: "submittedDate",
  APPROVED: "approvedDate",
  IN_PRODUCTION: "productionDate",
  MADE: "madeDate",
  SHIPPED: "madeDate",
};

function buildWorkflowSteps(
  structure: JobStructure,
  currentStatus: StructureStatus,
): JobStructureWorkflowStep[] {
  const currentIndex = WORKFLOW_STATUSES.indexOf(currentStatus);

  return WORKFLOW_STATUSES.map((status, index) => {
    const dateField = WORKFLOW_DATE_FIELDS[status];
    const date = structure[dateField];

    return {
      status,
      label: structureStatusLabels[status] ?? status,
      date: formatDate(date),
      isComplete: currentIndex > index || currentStatus === "SHIPPED",
      isCurrent:
        status === currentStatus ||
        (currentStatus === "SHIPPED" && status === "MADE"),
    };
  });
}

type JobStructureWithRelations = JobStructure & {
  job: {
    jobNumber: string;
    projectName: string;
    folderPath: string | null;
  } | null;
  quote: { quoteNumber: string } | null;
  documents: JobStructureDocument[];
};

export function mapJobStructureToDetailView(
  structure: JobStructureWithRelations,
): JobStructureDetailView {
  if (!structure.job) {
    throw new Error("Structure is not linked to a job.");
  }

  const status = structure.status as StructureStatus;
  const type = structure.structureType as StructureType;
  const jobSpecificSubmittalCount = structure.documents.filter(
    (document) => document.documentType === "JOB_SPECIFIC_SUBMITTAL",
  ).length;

  return {
    id: structure.id,
    jobId: structure.jobId!,
    jobNumber: structure.job.jobNumber,
    projectName: structure.job.projectName,
    quoteId: structure.quoteId,
    quoteNumber: structure.quote?.quoteNumber ?? null,
    structureNumber: structure.structureNumber ?? "—",
    description: structure.description ?? "—",
    typeLabel: structureTypeLabels[type] ?? structure.structureType,
    quantity: formatQuantity(structure.quantity),
    unit: structure.unit ?? "—",
    status,
    statusLabel: structureStatusLabels[status] ?? structure.status,
    statusVariant: structureStatusVariant(structure.status),
    needsSubmittal: structure.needsSubmittal,
    needsCutSheet: structure.needsCutSheet,
    notes: structure.notes ?? "",
    folderPath: structure.job.folderPath,
    submittedDate: formatDate(structure.submittedDate),
    approvedDate: formatDate(structure.approvedDate),
    productionDate: formatDate(structure.productionDate),
    madeDate: formatDate(structure.madeDate),
    shippedDate: formatDate(structure.shippedDate),
    jobSpecificSubmittalCount,
    documents: structure.documents.map((document) => ({
      id: document.id,
      documentName: document.documentName,
      documentTypeLabel: formatJobStructureDocumentTypeLabel(
        document.documentType as JobStructureDocumentType,
      ),
      uploadedDate: formatDate(document.uploadedAt),
      fileSize: formatFileSize(document.fileSize),
    })),
    workflowSteps: buildWorkflowSteps(structure, status),
  };
}

export function mapStructureForJobList(
  structure: JobStructure & { _count?: { documents: number } },
): {
  id: string;
  structureNumber: string;
  description: string;
  typeLabel: string;
  quantity: string;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  needsSubmittal: boolean;
  documentCount: number;
  submittedDate: string;
  madeDate: string;
  shippedDate: string;
  status: string;
} {
  const type = structure.structureType as StructureType;
  const status = structure.status as StructureStatus;

  return {
    id: structure.id,
    structureNumber: structure.structureNumber ?? "—",
    description: structure.description ?? "—",
    typeLabel: structureTypeLabels[type] ?? structure.structureType,
    quantity: formatQuantity(structure.quantity),
    status: structure.status,
    statusLabel: structureStatusLabels[status] ?? structure.status,
    statusVariant: structureStatusVariant(structure.status),
    needsSubmittal: structure.needsSubmittal,
    documentCount: structure._count?.documents ?? 0,
    submittedDate: formatDate(structure.submittedDate),
    madeDate: formatDate(structure.madeDate),
    shippedDate: formatDate(structure.shippedDate),
  };
}
