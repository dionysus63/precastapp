import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import type {
  JobStructureDocumentType,
  PrismaClient,
} from "@/app/generated/prisma/client";
import { getSubmittalsJobSubfolder } from "@/lib/app-settings";
import { assertPathUnderJobFolder } from "@/lib/job-path-security";
import { sanitizeFilenamePart } from "@/lib/quote-pdf-path";
import { assertUploadAllowed } from "@/lib/upload-validation";
import {
  resolveUniqueFilePath,
  sanitizeFileName,
} from "@/lib/file-upload-utils";

const VALID_DOCUMENT_TYPES = new Set<JobStructureDocumentType>([
  "CUT_SHEET",
  "JOB_SPECIFIC_SUBMITTAL",
  "APPROVED_SUBMITTAL",
  "PRODUCTION_DRAWING",
  "FIELD_SKETCH",
  "OTHER",
]);

export const JOB_STRUCTURE_SUBMITTAL_DOCUMENT_TYPES: JobStructureDocumentType[] =
  ["JOB_SPECIFIC_SUBMITTAL", "APPROVED_SUBMITTAL"];

const DOCUMENT_TYPE_LABELS: Record<JobStructureDocumentType, string> = {
  CUT_SHEET: "Cut Sheet",
  JOB_SPECIFIC_SUBMITTAL: "Job-Specific Submittal",
  APPROVED_SUBMITTAL: "Approved Submittal",
  PRODUCTION_DRAWING: "Production Drawing",
  FIELD_SKETCH: "Field Sketch",
  OTHER: "Other",
};

function normalizePath(value: string) {
  return path.normalize(value.trim());
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function assertJobStructureWithFolder(
  client: PrismaClient,
  jobStructureId: string,
) {
  const structure = await client.jobStructure.findUnique({
    where: { id: jobStructureId },
    include: {
      job: {
        select: { id: true, folderPath: true, jobNumber: true },
      },
    },
  });

  if (!structure) {
    throw new Error("Structure was not found.");
  }

  const folderPath = structure.job?.folderPath?.trim();
  if (!folderPath) {
    throw new Error(
      "This job does not have a folder yet. Create a job folder before uploading documents.",
    );
  }

  return { structure, jobFolderPath: folderPath };
}

function structureFolderName(structure: {
  structureNumber: string | null;
  id: string;
}) {
  const name = sanitizeFilenamePart(structure.structureNumber ?? structure.id);
  if (!name) {
    throw new Error("Structure number is required to resolve the submittals folder.");
  }
  return name;
}

export async function getJobStructureSubmittalDir(
  client: PrismaClient,
  jobStructureId: string,
) {
  const { structure, jobFolderPath } = await assertJobStructureWithFolder(
    client,
    jobStructureId,
  );
  const submittalsSubfolder = await getSubmittalsJobSubfolder();
  const structureDir = structureFolderName(structure);
  return path.join(jobFolderPath, submittalsSubfolder, structureDir);
}

function parseDocumentType(value: string): JobStructureDocumentType {
  const trimmed = value.trim().toUpperCase() as JobStructureDocumentType;
  if (!VALID_DOCUMENT_TYPES.has(trimmed)) {
    throw new Error(`Invalid document type: ${value}`);
  }
  return trimmed;
}

export function formatJobStructureDocumentTypeLabel(
  documentType: JobStructureDocumentType,
) {
  return DOCUMENT_TYPE_LABELS[documentType] ?? documentType;
}

export async function uploadJobStructureDocument(
  client: PrismaClient,
  jobStructureId: string,
  documentType: string,
  file: File,
) {
  assertUploadAllowed(file);

  const { structure, jobFolderPath } = await assertJobStructureWithFolder(
    client,
    jobStructureId,
  );
  const parsedType = parseDocumentType(documentType);
  const structureDir = await getJobStructureSubmittalDir(client, jobStructureId);

  await mkdir(structureDir, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const outputPath = normalizePath(
    await resolveUniqueFilePath(structureDir, safeName),
  );
  assertPathUnderJobFolder(jobFolderPath, outputPath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  const existing = await client.jobStructureDocument.findFirst({
    where: { jobStructureId, filePath: outputPath },
  });

  if (existing) {
    return client.jobStructureDocument.update({
      where: { id: existing.id },
      data: {
        documentName: path.basename(outputPath),
        documentType: parsedType,
        fileSize: buffer.length,
        mimeType: file.type || null,
        updatedAt: new Date(),
      },
    });
  }

  return client.jobStructureDocument.create({
    data: {
      jobStructureId,
      documentType: parsedType,
      documentName: path.basename(outputPath),
      filePath: outputPath,
      fileSize: buffer.length,
      mimeType: file.type || null,
    },
  });
}

export async function getJobStructureDocumentForOpen(
  client: PrismaClient,
  documentId: string,
) {
  const document = await client.jobStructureDocument.findUnique({
    where: { id: documentId },
    include: {
      jobStructure: {
        include: {
          job: { select: { folderPath: true } },
        },
      },
    },
  });

  if (!document) {
    throw new Error("Document was not found.");
  }

  const jobFolderPath = document.jobStructure.job?.folderPath?.trim();
  if (!jobFolderPath) {
    throw new Error("Job folder path is missing for this document.");
  }

  assertPathUnderJobFolder(jobFolderPath, document.filePath);

  if (!(await pathExists(document.filePath))) {
    throw new Error(`File not found on disk: ${document.documentName}`);
  }

  return document;
}

export async function deleteJobStructureDocument(
  client: PrismaClient,
  documentId: string,
) {
  const document = await getJobStructureDocumentForOpen(client, documentId);

  try {
    await unlink(document.filePath);
  } catch {
    // File may already be gone on disk; still remove the DB row.
  }

  await client.jobStructureDocument.delete({ where: { id: documentId } });
}

export async function countJobSpecificSubmittals(
  client: PrismaClient,
  jobStructureId: string,
) {
  return client.jobStructureDocument.count({
    where: {
      jobStructureId,
      documentType: "JOB_SPECIFIC_SUBMITTAL",
    },
  });
}
