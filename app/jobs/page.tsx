import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { JobsList } from "@/components/jobs/jobs-list";
import { getFavoriteJobIdsForUser } from "@/lib/job-favorites";
import { mapJobToRow } from "@/lib/job-mapper";
import { getCurrentUser } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import {
  CLOSED_JOB_STATUSES,
  OPEN_JOB_STATUSES,
} from "@/components/jobs/job-utils";
import { JobStatus, type Prisma } from "@/app/generated/prisma/client";

const JOB_LIST_SELECT = {
  id: true,
  jobNumber: true,
  year: true,
  customerName: true,
  projectName: true,
  projectAddress: true,
  city: true,
  state: true,
  zip: true,
  status: true,
  bidDate: true,
  awardedDate: true,
  folderPath: true,
  updatedAt: true,
} satisfies Prisma.JobSelect;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const params = await searchParams;
  const search = parseStringParam(params.q);
  const statusParam = parseStringParam(params.status);
  const yearParam = parseStringParam(params.year);
  const customerParam = parseStringParam(params.customer);
  const requestedPage = parsePageParam(params.page);

  // The status param accepts pseudo-values for the pipeline tabs (OPEN,
  // CLOSED, ALL) alongside single statuses (e.g. the dashboard's
  // ?status=ACTIVE link). Bare /jobs defaults to the open pipeline.
  const statusWhere: Prisma.JobWhereInput | null =
    statusParam === "ALL" || statusParam === "All"
      ? null
      : statusParam === "CLOSED"
        ? { status: { in: [...CLOSED_JOB_STATUSES] } }
        : statusParam && statusParam in JobStatus
          ? { status: statusParam as JobStatus }
          : { status: { in: [...OPEN_JOB_STATUSES] } };
  const year = /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;

  // Every filter except status — the tab counts are computed over this base
  // so each tab shows what it would contain under the current filters.
  const baseWhere: Prisma.JobWhereInput = {
    ...(year ? { year } : {}),
    ...(customerParam ? { customerName: customerParam } : {}),
    ...(search
      ? {
          OR: [
            { jobNumber: { contains: search, mode: "insensitive" } },
            { projectName: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
            { projectAddress: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
            { state: { contains: search, mode: "insensitive" } },
            { zip: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const where: Prisma.JobWhereInput = statusWhere
    ? { AND: [baseWhere, statusWhere] }
    : baseWhere;

  // Independent — run in parallel.
  const [total, favoriteJobIds] = await Promise.all([
    withDatabaseRetry((prisma) => prisma.job.count({ where })),
    getFavoriteJobIdsForUser(user.id),
  ]);
  const pageInfo = buildPageInfo(total, requestedPage);

  const [jobRecords, favoriteRecords, yearRows, customerRows, statusGroups] =
    await withDatabaseRetry((prisma) =>
      Promise.all([
        prisma.job.findMany({
          where,
          orderBy: [{ year: "desc" }, { sequenceNumber: "desc" }],
          select: JOB_LIST_SELECT,
          skip: pageInfo.skip,
          take: pageInfo.take,
        }),
        favoriteJobIds.length
          ? prisma.job.findMany({
              where: { id: { in: favoriteJobIds } },
              select: JOB_LIST_SELECT,
            })
          : Promise.resolve([]),
        prisma.job.findMany({
          distinct: ["year"],
          select: { year: true },
          orderBy: { year: "desc" },
        }),
        prisma.job.findMany({
          distinct: ["customerName"],
          select: { customerName: true },
          orderBy: { customerName: "asc" },
        }),
        prisma.job.groupBy({
          by: ["status"],
          _count: { _all: true },
          where: baseWhere,
        }),
      ]),
    );

  const rows = jobRecords.map(mapJobToRow);

  const favoriteById = new Map(favoriteRecords.map((job) => [job.id, job]));
  const favoriteJobs = favoriteJobIds
    .map((id) => favoriteById.get(id))
    .filter((job): job is (typeof favoriteRecords)[number] => job != null)
    .map(mapJobToRow);

  const countByStatus = new Map(
    statusGroups.map((group) => [group.status, group._count._all]),
  );
  const sumStatuses = (statuses: readonly JobStatus[]) =>
    statuses.reduce((acc, status) => acc + (countByStatus.get(status) ?? 0), 0);
  const tabCounts = {
    open: sumStatuses([...OPEN_JOB_STATUSES]),
    complete: countByStatus.get("COMPLETE") ?? 0,
    closed: sumStatuses([...CLOSED_JOB_STATUSES]),
    all: statusGroups.reduce((acc, group) => acc + group._count._all, 0),
  };

  const yearOptions = ["All", ...yearRows.map((row) => String(row.year))];
  const customerOptions = [
    "All",
    ...customerRows.map((row) => row.customerName),
  ];

  return (
    <DashboardShell
      title="Jobs"
      subtitle="Track projects, bids, and job folders across your precast operation."
    >
      <JobsList
        jobs={rows}
        favoriteJobs={favoriteJobs}
        favoriteJobIds={favoriteJobIds}
        pageInfo={pageInfo}
        tabCounts={tabCounts}
        filters={{
          search,
          status: statusParam,
          year: yearParam,
          customer: customerParam,
        }}
        yearOptions={yearOptions}
        customerOptions={customerOptions}
      />
    </DashboardShell>
  );
}
