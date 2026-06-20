import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  ApproveStructuresPanel,
  ProductionQueue,
  type ProductionQueueItem,
} from "@/components/production/production-queue";
import { withDatabaseRetry } from "@/lib/prisma";

function mapStructure(row: {
  id: string;
  structureNumber: string | null;
  description: string | null;
  status: string;
  quantity: { toString(): string } | null;
  unit: string | null;
  job: { jobNumber: string; projectName: string } | null;
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
    jobNumber: row.job?.jobNumber ?? null,
    projectName: row.job?.projectName ?? null,
    quoteNumber: row.quote?.quoteNumber ?? null,
    productCode: row.product?.productCode ?? null,
    productName: row.product?.name ?? null,
  };
}

export default async function ProductionPage() {
  const [queue, awaiting] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: { in: ["APPROVED", "IN_PRODUCTION"] } },
        orderBy: [{ productionDate: "asc" }, { createdAt: "asc" }],
        include: {
          job: { select: { jobNumber: true, projectName: true } },
          quote: { select: { quoteNumber: true } },
          product: { select: { productCode: true, name: true } },
        },
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: { in: ["NOT_SUBMITTED", "SUBMITTED"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          job: { select: { jobNumber: true, projectName: true } },
          quote: { select: { quoteNumber: true } },
          product: { select: { productCode: true, name: true } },
        },
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
        <ApproveStructuresPanel pendingStructures={awaiting.map(mapStructure)} />
      </div>
    </DashboardShell>
  );
}
