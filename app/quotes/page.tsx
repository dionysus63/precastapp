import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { QuotesPageContent } from "@/components/quotes/quotes-page-content";
import { QuotesSummarySection } from "@/components/quotes/quotes-page-sections";
import { getAppSettings } from "@/lib/app-settings";
import { mapQuoteToRow } from "@/lib/quote-mapper";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import {
  buildQuoteStatTiles,
  CLOSED_STATUSES,
  OPEN_STATUSES,
} from "@/lib/quotes/list-summary";
import {
  quoteStatusLabels,
  quoteTypeLabels,
  type QuoteStatus,
  type QuoteType,
} from "@/components/quotes/quote-utils";
import type { Prisma } from "@/app/generated/prisma/client";

const QUOTE_LIST_SELECT = {
  id: true,
  quoteNumber: true,
  revisionNumber: true,
  jobId: true,
  jobNumber: true,
  projectName: true,
  scopeLabel: true,
  customerName: true,
  quoteType: true,
  status: true,
  bidDueDate: true,
  total: true,
  estimator: true,
  updatedAt: true,
  quoteDate: true,
  createdAt: true,
} satisfies Prisma.QuoteSelect;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * The status param accepts pseudo-values for the pipeline tabs (OPEN, CLOSED,
 * ALL) alongside single statuses (e.g. the dashboard's ?status=DRAFT link).
 * Bare /quotes defaults to the open pipeline — won/closed live behind tabs.
 */
function statusWhereFor(statusParam: string): Prisma.QuoteWhereInput | null {
  if (statusParam === "ALL" || statusParam === "All") {
    return null;
  }
  if (statusParam === "CLOSED") {
    return { status: { in: CLOSED_STATUSES } };
  }
  if (statusParam && statusParam in quoteStatusLabels) {
    return { status: statusParam as QuoteStatus };
  }
  return { status: { in: OPEN_STATUSES } };
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const search = parseStringParam(params.q);
  const statusParam = parseStringParam(params.status);
  const estimatorParam = parseStringParam(params.estimator);
  const yearParam = parseStringParam(params.year);
  const typeParam = parseStringParam(params.type);
  const dueDateParam = parseStringParam(params.due);
  const requestedPage = parsePageParam(params.page);

  // Every filter except status — the tab counts are computed over this base
  // so each tab shows what it would contain under the current filters.
  const baseAnd: Prisma.QuoteWhereInput[] = [];

  if (search) {
    baseAnd.push({
      OR: [
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { jobNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { projectName: { contains: search, mode: "insensitive" } },
        { scopeLabel: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (typeParam && typeParam in quoteTypeLabels) {
    baseAnd.push({ quoteType: typeParam as QuoteType });
  }

  if (estimatorParam) {
    baseAnd.push({ estimator: estimatorParam });
  }

  if (/^\d{4}$/.test(yearParam)) {
    const year = Number(yearParam);
    const jan1 = new Date(year, 0, 1);
    const nextJan1 = new Date(year + 1, 0, 1);
    // Row year = quoteDate's year, falling back to createdAt when null.
    baseAnd.push({
      OR: [
        { quoteDate: { gte: jan1, lt: nextJan1 } },
        { quoteDate: null, createdAt: { gte: jan1, lt: nextJan1 } },
      ],
    });
  }

  if (dueDateParam && dueDateParam !== "All") {
    const today = startOfToday();
    if (dueDateParam === "Overdue") {
      baseAnd.push({ bidDueDate: { lt: today } });
    } else if (dueDateParam === "Due This Week") {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      baseAnd.push({ bidDueDate: { gte: today, lte: weekEnd } });
    } else if (dueDateParam === "Next 30 Days") {
      const monthEnd = new Date(today);
      monthEnd.setDate(today.getDate() + 30);
      baseAnd.push({ bidDueDate: { gte: today, lte: monthEnd } });
    }
  }

  const baseWhere: Prisma.QuoteWhereInput = baseAnd.length
    ? { AND: baseAnd }
    : {};
  const statusWhere = statusWhereFor(statusParam);
  const where: Prisma.QuoteWhereInput = statusWhere
    ? { AND: [...baseAnd, statusWhere] }
    : baseWhere;

  const today = startOfToday();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Settings don't depend on the count — run in parallel.
  const [total, appSettings] = await Promise.all([
    withDatabaseRetry((prisma) => prisma.quote.count({ where })),
    getAppSettings(),
  ]);
  const pageInfo = buildPageInfo(total, requestedPage);

  const [
    openQuotesCount,
    dueThisWeekCount,
    awaitingCustomerCount,
    wonThisMonthCount,
    wonThisMonthTotal,
    openQuotesTotal,
    statusGroups,
    quotes,
  ] = await withDatabaseRetry((prisma) =>
    Promise.all([
      prisma.quote.count({ where: { status: { in: OPEN_STATUSES } } }),
      prisma.quote.count({
        where: {
          status: { in: OPEN_STATUSES },
          bidDueDate: { gte: today, lte: weekEnd },
        },
      }),
      prisma.quote.count({ where: { status: "SENT" } }),
      prisma.quote.count({
        where: {
          status: "WON",
          updatedAt: { gte: monthStart, lt: nextMonthStart },
        },
      }),
      prisma.quote.aggregate({
        where: {
          status: "WON",
          updatedAt: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { total: true },
      }),
      prisma.quote.aggregate({
        where: { status: { in: OPEN_STATUSES } },
        _sum: { total: true },
      }),
      prisma.quote.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: baseWhere,
      }),
      prisma.quote.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        select: QUOTE_LIST_SELECT,
        skip: pageInfo.skip,
        take: pageInfo.take,
      }),
    ]),
  );

  const rows = quotes.map(mapQuoteToRow);
  const statTiles = buildQuoteStatTiles({
    openQuotesCount,
    dueThisWeekCount,
    awaitingCustomerCount,
    wonThisMonthCount,
    wonThisMonthTotal: Number(wonThisMonthTotal._sum.total ?? 0),
    openQuotesTotal: Number(openQuotesTotal._sum.total ?? 0),
  });

  const countByStatus = new Map(
    statusGroups.map((group) => [group.status, group._count._all]),
  );
  const sumStatuses = (statuses: QuoteStatus[]) =>
    statuses.reduce((acc, status) => acc + (countByStatus.get(status) ?? 0), 0);
  const tabCounts = {
    open: sumStatuses(OPEN_STATUSES),
    won: countByStatus.get("WON") ?? 0,
    closed: sumStatuses(CLOSED_STATUSES),
    all: statusGroups.reduce((acc, group) => acc + group._count._all, 0),
  };

  const estimatorFilterOptions = ["All", ...appSettings.estimators];

  return (
    <DashboardShell title="Quotes" subtitle="Manage bids, revisions, and quote status.">
      <div className="space-y-4">
        <QuotesSummarySection tiles={statTiles} />
        <QuotesPageContent
          quotes={rows}
          pageInfo={pageInfo}
          tabCounts={tabCounts}
          estimatorFilterOptions={estimatorFilterOptions}
          filters={{
            search,
            status: statusParam,
            estimator: estimatorParam,
            year: yearParam,
            type: typeParam,
            due: dueDateParam,
          }}
        />
      </div>
    </DashboardShell>
  );
}
