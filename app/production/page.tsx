import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  ProductionBoard,
  type ProductionQueueItem,
} from "@/components/production/production-board";
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
  productionDate: Date | null;
  submittedDate: Date | null;
  quantity: { toString(): string } | null;
  unit: string | null;
  structureTemplateId: string | null;
  job: {
    id: string;
    jobNumber: string;
    projectName: string;
    customerName: string;
  } | null;
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
    customerName: row.job?.customerName ?? null,
    quoteNumber: row.quote?.quoteNumber ?? null,
    productCode: row.product?.productCode ?? null,
    productName: row.product?.name ?? null,
    needsSubmittal: row.needsSubmittal,
    usedGeneratedSubmittalForApproval: row.usedGeneratedSubmittalForApproval,
    madeDate: row.madeDate ? formatDateShort(row.madeDate) : null,
    productionDate: row.productionDate
      ? formatDateShort(row.productionDate)
      : null,
    submittedDate: row.submittedDate
      ? formatDateShort(row.submittedDate)
      : null,
    drillSheetId: row.structureTemplateId ? row.id : null,
  };
}

const structureInclude = {
  job: {
    select: {
      id: true,
      jobNumber: true,
      projectName: true,
      customerName: true,
    },
  },
  quote: { select: { quoteNumber: true } },
  product: { select: { productCode: true, name: true } },
} as const;

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

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
        take: 100,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "NOT_SUBMITTED", needsSubmittal: true },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "NOT_SUBMITTED", needsSubmittal: false },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: structureInclude,
      }),
    ),
  ]);

  const awaitingApproval: ProductionQueueItem[] = [
    ...awaiting.map(mapStructure),
    ...skippableApproval.map((row) => ({
      ...mapStructure(row),
      noSubmittalRequired: true,
    })),
  ];

  return (
    <DashboardShell
      title="Production"
      subtitle="Approve, track, and mark job-specific structures as made, and view structures ready to ship."
    >
      <ProductionBoard
        approved={approvedQueue.map(mapStructure)}
        inProduction={inProductionQueue.map(mapStructure)}
        readyToShip={readyToShip.map(mapStructure)}
        needsSubmittal={needsSubmittal.map(mapStructure)}
        awaitingApproval={awaitingApproval}
        initialTab={tab}
      />
    </DashboardShell>
  );
}
