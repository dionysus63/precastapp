import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  ApproveStructuresPanel,
  NeedsSubmittalPanel,
  ProductionQueue,
  type ProductionQueueItem,
} from "@/components/production/production-queue";
import { withDatabaseRetry } from "@/lib/prisma";

function mapStructure(row: {
  id: string;
  structureNumber: string | null;
  description: string | null;
  status: string;
  needsSubmittal: boolean;
  quantity: { toString(): string } | null;
  unit: string | null;
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
  };
}

const structureInclude = {
  job: { select: { id: true, jobNumber: true, projectName: true } },
  quote: { select: { quoteNumber: true } },
  product: { select: { productCode: true, name: true } },
} as const;

export default async function ProductionPage() {
  const [queue, awaiting, needsSubmittal, skippableApproval] =
    await Promise.all([
      withDatabaseRetry((prisma) =>
        prisma.jobStructure.findMany({
          where: { status: { in: ["APPROVED", "IN_PRODUCTION"] } },
          orderBy: [{ productionDate: "asc" }, { createdAt: "asc" }],
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
      subtitle="Approve, track, and mark job-specific structures as made."
    >
      <div className="space-y-5">
        <ProductionQueue items={queue.map(mapStructure)} />
        <NeedsSubmittalPanel structures={needsSubmittal.map(mapStructure)} />
        <ApproveStructuresPanel
          pendingStructures={awaiting.map(mapStructure)}
          skippableStructures={skippableApproval.map(mapStructure)}
        />
      </div>
    </DashboardShell>
  );
}
