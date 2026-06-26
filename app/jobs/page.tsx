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

  const status =
    statusParam && statusParam in JobStatus
      ? (statusParam as JobStatus)
      : undefined;
  const year = /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;

  const where: Prisma.JobWhereInput = {
    ...(status ? { status } : {}),
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

  const total = await withDatabaseRetry((prisma) =>
    prisma.job.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const favoriteJobIds = await getFavoriteJobIdsForUser(user.id);

  const [jobRecords, favoriteRecords, yearRows, customerRows] =
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
      ]),
    );

  const rows = jobRecords.map(mapJobToRow);

  const favoriteById = new Map(favoriteRecords.map((job) => [job.id, job]));
  const favoriteJobs = favoriteJobIds
    .map((id) => favoriteById.get(id))
    .filter((job): job is (typeof favoriteRecords)[number] => job != null)
    .map(mapJobToRow);

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
