import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { QuotesPageContent } from "@/components/quotes/quotes-page-content";
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
  buildQuoteSummaryCards,
  buildRecentQuoteActivity,
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

  const and: Prisma.QuoteWhereInput[] = [];

  if (search) {
    and.push({
      OR: [
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { jobNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { projectName: { contains: search, mode: "insensitive" } },
        { scopeLabel: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (statusParam && statusParam in quoteStatusLabels) {
    and.push({ status: statusParam as QuoteStatus });
  }

  if (typeParam && typeParam in quoteTypeLabels) {
    and.push({ quoteType: typeParam as QuoteType });
  }

  if (estimatorParam) {
    and.push({ estimator: estimatorParam });
  }

  if (/^\d{4}$/.test(yearParam)) {
    const year = Number(yearParam);
    const jan1 = new Date(year, 0, 1);
    const nextJan1 = new Date(year + 1, 0, 1);
    // Row year = quoteDate's year, falling back to createdAt when null.
    and.push({
      OR: [
        { quoteDate: { gte: jan1, lt: nextJan1 } },
        { quoteDate: null, createdAt: { gte: jan1, lt: nextJan1 } },
      ],
    });
  }

  if (dueDateParam && dueDateParam !== "All") {
    const today = startOfToday();
    if (dueDateParam === "Overdue") {
      and.push({ bidDueDate: { lt: today } });
    } else if (dueDateParam === "Due This Week") {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      and.push({ bidDueDate: { gte: today, lte: weekEnd } });
    } else if (dueDateParam === "Next 30 Days") {
      const monthEnd = new Date(today);
      monthEnd.setDate(today.getDate() + 30);
      and.push({ bidDueDate: { gte: today, lte: monthEnd } });
    }
  }

  const where: Prisma.QuoteWhereInput = and.length ? { AND: and } : {};

  const today = startOfToday();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const total = await withDatabaseRetry((prisma) =>
    prisma.quote.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const [
    openQuotesCount,
    dueThisWeekCount,
    awaitingCustomerCount,
    wonThisMonthCount,
    wonThisMonthTotal,
    openQuotesTotal,
    recentQuotes,
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
      prisma.quote.findMany({
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: {
          id: true,
          quoteNumber: true,
          projectName: true,
          customerName: true,
          status: true,
          updatedAt: true,
        },
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

  const appSettings = await getAppSettings();

  const rows = quotes.map(mapQuoteToRow);
  const summaryCards = buildQuoteSummaryCards({
    openQuotesCount,
    dueThisWeekCount,
    awaitingCustomerCount,
    wonThisMonthCount,
    wonThisMonthTotal: Number(wonThisMonthTotal._sum.total ?? 0),
    openQuotesTotal: Number(openQuotesTotal._sum.total ?? 0),
  });
  const recentActivity = buildRecentQuoteActivity(recentQuotes);
  const estimatorFilterOptions = ["All", ...appSettings.estimators];

  return (
    <DashboardShell title="Quotes" subtitle="Manage bids, revisions, and quote status.">
      <QuotesPageContent
        quotes={rows}
        pageInfo={pageInfo}
        summaryCards={summaryCards}
        recentActivity={recentActivity}
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
    </DashboardShell>
  );
}
