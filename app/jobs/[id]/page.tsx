import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  JobDetailContent,
} from "@/components/jobs/job-detail-content";
import { mapFilesForBrowser } from "@/lib/job-file-mapper";
import type { JobDetailTab } from "@/components/jobs/job-utils";
import { getJobFilesForBrowser } from "@/app/files/actions";
import { mapJobToDetailView } from "@/lib/job-detail-mapper";
import { getFavoriteJobIdsForUser } from "@/lib/job-favorites";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { AppPermission } from "@/app/generated/prisma/client";
import { withDatabaseRetry } from "@/lib/prisma";
import { listCustomersForBidList } from "@/app/jobs/bid-actions";

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; category?: string }>;
};

const CONSTRUCTION_PLANS_CATEGORY = "01 Construction Plans";

const VALID_TABS: JobDetailTab[] = [
  "overview",
  "bidding",
  "quotes",
  "deliveries",
  "production",
  "invoices",
  "construction-plans",
  "files",
];

function resolveTab(tab?: string): JobDetailTab {
  return VALID_TABS.includes(tab as JobDetailTab)
    ? (tab as JobDetailTab)
    : "overview";
}

export default async function JobDetailPage({
  params,
  searchParams,
}: JobDetailPageProps) {
  const { id } = await params;
  const { tab, category } = await searchParams;

  const activeTab = resolveTab(tab);
  const user = await getCurrentUser();

  const [job, favoriteJobIds, bidListCustomers] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.job.findUnique({
        where: { id },
        include: {
          quotes: {
            orderBy: { updatedAt: "desc" },
            include: { _count: { select: { lineItems: true } } },
          },
          bidders: {
            orderBy: { sortOrder: "asc" },
            include: {
              customer: {
                include: {
                  contacts: {
                    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
                  },
                },
              },
              quotes: { orderBy: { updatedAt: "desc" }, take: 1 },
            },
          },
          deliveryTickets: {
            orderBy: { updatedAt: "desc" },
            include: { invoice: { select: { id: true } } },
          },
          jobStructures: {
            orderBy: { updatedAt: "desc" },
            include: { _count: { select: { documents: true } } },
          },
          invoices: {
            orderBy: { updatedAt: "desc" },
            include: { deliveryTicket: { select: { ticketNumber: true } } },
          },
        },
      }),
    ),
    user ? getFavoriteJobIdsForUser(user.id) : Promise.resolve([]),
    user && hasPermission(user, AppPermission.JOBS_MANAGE)
      ? listCustomersForBidList()
      : Promise.resolve([]),
  ]);

  if (!job) {
    notFound();
  }

  const detail = mapJobToDetailView(job);

  const fileCategory = category ?? "All";
  let files: ReturnType<typeof mapFilesForBrowser> = [];

  if (
    (activeTab === "files" || activeTab === "construction-plans") &&
    job.folderPath
  ) {
    const requestedCategory =
      activeTab === "construction-plans"
        ? CONSTRUCTION_PLANS_CATEGORY
        : fileCategory !== "All"
          ? fileCategory
          : undefined;

    const result = await getJobFilesForBrowser(id, requestedCategory);
    files = mapFilesForBrowser(result.files);
  }

  return (
    <DashboardShell
      title={`${detail.jobNumber} — ${detail.projectName}`}
      subtitle="Everything you need to know about this job."
    >
      <JobDetailContent
        detail={detail}
        activeTab={activeTab}
        files={files}
        fileCategory={fileCategory}
        isFavorited={favoriteJobIds.includes(id)}
        bidListCustomers={bidListCustomers.map((customer) => ({
          id: customer.id,
          name: customer.name,
        }))}
      />
    </DashboardShell>
  );
}
