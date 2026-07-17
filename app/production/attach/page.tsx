import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  BulkAttachBoard,
  type BulkAttachJobGroup,
  type BulkAttachMode,
  type BulkAttachTarget,
} from "@/components/production/bulk-attach-board";
import { structureNeedsDrillSheet } from "@/components/structures/structure-utils";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function BulkAttachPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const initialMode: BulkAttachMode =
    mode === "approvals" ? "approvals" : "submittals";

  // Everything pre-approval on a job: submittals can be added to any of
  // these, approvals only to the subset the approve action would accept.
  const structures = await withDatabaseRetry((prisma) =>
    prisma.jobStructure.findMany({
      where: {
        jobId: { not: null },
        status: { in: ["NOT_SUBMITTED", "SUBMITTED"] },
      },
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            projectName: true,
            customerName: true,
            folderPath: true,
          },
        },
        documents: {
          where: { documentType: "JOB_SPECIFIC_SUBMITTAL" },
          select: { id: true },
        },
      },
    }),
  );

  const groupsByJobId = new Map<string, BulkAttachJobGroup>();
  for (const structure of structures) {
    if (!structure.job) continue;

    let group = groupsByJobId.get(structure.job.id);
    if (!group) {
      group = {
        jobId: structure.job.id,
        jobNumber: structure.job.jobNumber,
        projectName: structure.job.projectName,
        customerName: structure.job.customerName,
        hasFolder: Boolean(structure.job.folderPath?.trim()),
        submittalTargets: [],
        approvalTargets: [],
      };
      groupsByJobId.set(structure.job.id, group);
    }

    const target: BulkAttachTarget = {
      id: structure.id,
      structureNumber: structure.structureNumber,
      description: structure.description,
      quantityLabel: structure.quantity
        ? `${structure.quantity.toString()} ${structure.unit ?? ""}`.trim()
        : null,
      status: structure.status,
      needsSubmittal: structure.needsSubmittal,
      submittalCount: structure.documents.length,
    };

    group.submittalTargets.push(target);

    // Same gate as approveJobStructureForProduction: submitted, or skipping
    // submittals entirely — and never while the drill sheet is missing.
    const approvable =
      (structure.status === "SUBMITTED" ||
        (structure.status === "NOT_SUBMITTED" && !structure.needsSubmittal)) &&
      !structureNeedsDrillSheet(structure);
    if (approvable) {
      group.approvalTargets.push(target);
    }
  }

  const compareStructures = (a: BulkAttachTarget, b: BulkAttachTarget) =>
    (a.structureNumber ?? "").localeCompare(b.structureNumber ?? "", undefined, {
      numeric: true,
    });
  const groups = [...groupsByJobId.values()]
    .sort((a, b) =>
      b.jobNumber.localeCompare(a.jobNumber, undefined, { numeric: true }),
    )
    .map((group) => ({
      ...group,
      submittalTargets: [...group.submittalTargets].sort(compareStructures),
      approvalTargets: [...group.approvalTargets].sort(compareStructures),
    }));

  return (
    <DashboardShell
      title="Attach Submittals"
      subtitle="Drag files onto structures to add submittals in bulk, or drop signed returns to approve them for production."
    >
      <BulkAttachBoard groups={groups} initialMode={initialMode} />
    </DashboardShell>
  );
}
