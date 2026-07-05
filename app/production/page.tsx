import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  ApprovedNotInProductionPanel,
  ApproveStructuresPanel,
  InProductionPanel,
  NeedsSubmittalPanel,
  ReadyToShipPanel,
  type ProductionQueueItem,
} from "@/components/production/production-queue";
import { formatDateShort } from "@/lib/format";
import { withDatabaseRetry } from "@/lib/prisma";

function mapStructure(row: {
  id: string;
  structureNumber: string | null;
  description: string | null;
  status: string;
  needsSubmittal: boolean;
  usedGeneratedSubmittalForApproval: boolean;
  madeDate: Date | null;
  quantity: { toString(): string } | null;
  unit: string | null;
  structureTemplateId: string | null;
  job: { id: string; jobNumber: string; projectName: string } | null;
  quote: { quoteNumber: string } | null;
  product: { productCode: string; name: string } | null;
}): ProductionQueueItem {
  return {
    id: row.id,
    structureNumber: row.structureNumber,
    description: row.description,
    status: row.status,
    quantity: row.quantity?.toString() ?? null,
    unit: row.unit,
    jobId: row.job?.id ?? null,
    jobNumber: row.job?.jobNumber ?? null,
    projectName: row.job?.projectName ?? null,
    quoteNumber: row.quote?.quoteNumber ?? null,
    productCode: row.product?.productCode ?? null,
    productName: row.product?.name ?? null,
    needsSubmittal: row.needsSubmittal,
    usedGeneratedSubmittalForApproval: row.usedGeneratedSubmittalForApproval,
    madeDate: row.madeDate ? formatDateShort(row.madeDate) : null,
    drillSheetId: row.structureTemplateId ? row.id : null,
  };
}

const structureInclude = {
  job: { select: { id: true, jobNumber: true, projectName: true } },
  quote: { select: { quoteNumber: true } },
  product: { select: { productCode: true, name: true } },
} as const;

export default async function ProductionPage() {
  const [
    approvedQueue,
    inProductionQueue,
    readyToShip,
    awaiting,
    needsSubmittal,
    skippableApproval,
  ] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "APPROVED" },
        orderBy: [{ approvedDate: "asc" }, { createdAt: "asc" }],
        take: 200,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "IN_PRODUCTION" },
        orderBy: [{ productionDate: "asc" }, { createdAt: "asc" }],
        take: 200,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "MADE" },
        orderBy: [{ madeDate: "asc" }, { createdAt: "asc" }],
        take: 200,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "SUBMITTED" },
        orderBy: { submittedDate: "desc" },
        take: 20,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "NOT_SUBMITTED", needsSubmittal: true },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "NOT_SUBMITTED", needsSubmittal: false },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: structureInclude,
      }),
    ),
  ]);

  return (
    <DashboardShell
      title="Production"
      subtitle="Approve, track, and mark job-specific structures as made, and view structures ready to ship."
    >
      <div className="space-y-5">
        <ApprovedNotInProductionPanel
          items={approvedQueue.map(mapStructure)}
        />
        <InProductionPanel items={inProductionQueue.map(mapStructure)} />
        <ReadyToShipPanel items={readyToShip.map(mapStructure)} />
        <NeedsSubmittalPanel structures={needsSubmittal.map(mapStructure)} />
        <ApproveStructuresPanel
          pendingStructures={awaiting.map(mapStructure)}
          skippableStructures={skippableApproval.map(mapStructure)}
        />
      </div>
    </DashboardShell>
  );
}
