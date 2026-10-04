import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  ProductionBoard,
  type ProductionQueueItem,
} from "@/components/production/production-board";
import { formatDateShort } from "@/lib/format";
import { resolveCreateDrillSheetHref } from "@/lib/needs-drill-sheet";
import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";
import { withDatabaseRetry } from "@/lib/prisma";

// Quote-only placeholders: quoted structures whose drill sheet hasn't been
// created yet. Scoped to CONFIGURABLE_PRODUCT — custom structures never get
// templates (their drawings are submittals).
const needsDrillSheetWhere = {
  needsCutSheet: true,
  structureTemplateId: null,
  structureType: "CONFIGURABLE_PRODUCT",
} as const;

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

const QUEUE_LIMIT = 250;

const structureInclude = {
  job: {
    select: {
      id: true,
      jobNumber: true,
      projectName: true,
      customerName: true,
    },
  },
  quote: { select: { id: true, quoteNumber: true } },
  product: { select: { productCode: true, name: true } },
} as const;

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  // Each queue loads at most QUEUE_LIMIT rows to keep the board fast; the
  // counts below are the true totals, so the board can say when a queue is
  // showing only part of its rows instead of silently dropping them.
  const approvedWhere = { status: "APPROVED" } as const;
  const inProductionWhere = { status: "IN_PRODUCTION" } as const;
  const readyToShipWhere = { status: "MADE" } as const;
  const awaitingWhere = { status: "SUBMITTED" } as const;
  const needsSubmittalWhere = {
    status: "NOT_SUBMITTED",
    needsSubmittal: true,
  } as const;
  // Genuinely approval-ready: excludes quote-only placeholders, which get
  // their own "Needs drill sheet" queue.
  const skippableApprovalWhere = {
    status: "NOT_SUBMITTED",
    needsSubmittal: false,
    NOT: needsDrillSheetWhere,
  } as const;
  const needsDrillSheetQueueWhere = {
    status: "NOT_SUBMITTED",
    ...needsDrillSheetWhere,
  } as const;

  const [
    approvedQueue,
    inProductionQueue,
    readyToShip,
    awaiting,
    needsSubmittal,
    skippableApproval,
    needsDrillSheet,
    totals,
  ] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: approvedWhere,
        orderBy: [{ approvedDate: "asc" }, { createdAt: "asc" }],
        take: QUEUE_LIMIT,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: inProductionWhere,
        orderBy: [{ productionDate: "asc" }, { createdAt: "asc" }],
        take: QUEUE_LIMIT,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: readyToShipWhere,
        orderBy: [{ madeDate: "asc" }, { createdAt: "asc" }],
        take: QUEUE_LIMIT,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: awaitingWhere,
        orderBy: { submittedDate: "desc" },
        take: QUEUE_LIMIT,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: needsSubmittalWhere,
        orderBy: { createdAt: "desc" },
        take: QUEUE_LIMIT,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: skippableApprovalWhere,
        orderBy: { createdAt: "desc" },
        take: QUEUE_LIMIT,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: needsDrillSheetQueueWhere,
        orderBy: { createdAt: "desc" },
        take: QUEUE_LIMIT,
        include: {
          ...structureInclude,
          quoteLineItems: {
            select: { structureConfigJson: true },
            take: 1,
          },
        },
      }),
    ),
    // One connection for all seven counts.
    withDatabaseRetry((prisma) =>
      prisma.$transaction([
        prisma.jobStructure.count({ where: approvedWhere }),
        prisma.jobStructure.count({ where: inProductionWhere }),
        prisma.jobStructure.count({ where: readyToShipWhere }),
        prisma.jobStructure.count({ where: needsSubmittalWhere }),
        prisma.jobStructure.count({ where: needsDrillSheetQueueWhere }),
        prisma.jobStructure.count({ where: awaitingWhere }),
        prisma.jobStructure.count({ where: skippableApprovalWhere }),
      ]),
    ),
  ]);
  const [
    approvedTotal,
    inProductionTotal,
    readyToShipTotal,
    needsSubmittalTotal,
    needsDrillSheetTotal,
    awaitingTotal,
    skippableApprovalTotal,
  ] = totals;

  const awaitingApproval: ProductionQueueItem[] = [
    ...awaiting.map(mapStructure),
    ...skippableApproval.map((row) => ({
      ...mapStructure(row),
      noSubmittalRequired: true,
    })),
  ];

  const needsDrillSheetItems: ProductionQueueItem[] = needsDrillSheet.map(
    (row) => {
      const configJson = row.quoteLineItems[0]?.structureConfigJson ?? null;
      const isRect = parseRectStructureConfigJson(configJson) != null;
      return {
        ...mapStructure(row),
        createDrillSheetHref: resolveCreateDrillSheetHref(
          row.id,
          row.quote?.id ?? null,
          configJson,
        ),
        // Rect placeholders can also be completed in bulk per quote.
        completeWorkbookHref:
          isRect && row.quote?.id
            ? `/quotes/${row.quote.id}/complete-drill-sheets`
            : null,
      };
    },
  );

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
        needsDrillSheet={needsDrillSheetItems}
        awaitingApproval={awaitingApproval}
        totals={{
          approved: approvedTotal,
          "in-production": inProductionTotal,
          "ready-to-ship": readyToShipTotal,
          "needs-submittal": needsSubmittalTotal,
          "needs-drill-sheet": needsDrillSheetTotal,
          "awaiting-approval": awaitingTotal + skippableApprovalTotal,
        }}
        initialTab={tab}
      />
    </DashboardShell>
  );
}
