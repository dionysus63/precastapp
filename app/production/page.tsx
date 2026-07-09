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

  const [
    approvedQueue,
    inProductionQueue,
    readyToShip,
    awaiting,
    needsSubmittal,
    skippableApproval,
    needsDrillSheet,
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
        // Genuinely approval-ready: excludes quote-only placeholders, which
        // get their own "Needs drill sheet" queue below.
        where: {
          status: "NOT_SUBMITTED",
          needsSubmittal: false,
          NOT: needsDrillSheetWhere,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: structureInclude,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { status: "NOT_SUBMITTED", ...needsDrillSheetWhere },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          ...structureInclude,
          quoteLineItems: {
            select: { structureConfigJson: true },
            take: 1,
          },
        },
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
        initialTab={tab}
      />
    </DashboardShell>
  );
}
