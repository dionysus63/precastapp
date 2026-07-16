import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  JobDetailContent,
  JobDetailTabSkeleton,
} from "@/components/jobs/job-detail-content";
import type { JobDetailTab } from "@/components/jobs/job-utils";
import { mapJobToDetailView } from "@/lib/job-detail-mapper";
import { getFavoriteJobIdsForUser } from "@/lib/job-favorites";
import { getCurrentUser } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import { JobTabContent } from "./job-tab-content";

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; category?: string; folderError?: string }>;
};

const VALID_TABS: JobDetailTab[] = [
  "overview",
  "bidding",
  "quotes",
  "deliveries",
  "progress",
  "production",
  "invoices",
  "construction-plans",
  "tax-exempt-cert",
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
  const { tab, category, folderError } = await searchParams;

  const activeTab = resolveTab(tab);
  const user = await getCurrentUser();

  // Lightweight always-on load: base job row, relation counts for the tab
  // badges, and the skinny relation slices needed by the stats cards and
  // overview summary. Full relations load per tab inside JobTabContent.
  const [job, favoriteJobIds, assignableCustomers] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.job.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              quotes: true,
              bidders: true,
              deliveryTickets: true,
              jobStructures: true,
              invoices: true,
            },
          },
          quotes: { select: { status: true, total: true } },
          bidders: {
            select: {
              isWinner: true,
              customer: { select: { name: true } },
              quotes: {
                orderBy: { updatedAt: "desc" },
                take: 1,
                select: { sentAt: true },
              },
            },
          },
          deliveryTickets: { select: { status: true } },
          jobStructures: { select: { status: true } },
          invoices: { select: { total: true } },
        },
      }),
    ),
    user ? getFavoriteJobIdsForUser(user.id) : Promise.resolve([]),
    // Options for the header's quick contractor select.
    withDatabaseRetry((prisma) =>
      prisma.customer.findMany({
        where: { status: { not: "INACTIVE" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
  ]);

  if (!job) {
    notFound();
  }

  const detail = mapJobToDetailView(job);

  return (
    <DashboardShell
      title={`${detail.jobNumber} — ${detail.projectName}`}
      subtitle="Everything you need to know about this job."
    >
      {folderError && !detail.folderPath ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The job was saved, but its folder could not be created. Use the
          &ldquo;Create Folder&rdquo; button below to retry.
        </div>
      ) : null}
      <JobDetailContent
        detail={detail}
        activeTab={activeTab}
        isFavorited={favoriteJobIds.includes(id)}
        assignableCustomers={assignableCustomers}
      >
        <Suspense
          key={`${activeTab}:${category ?? ""}`}
          fallback={<JobDetailTabSkeleton />}
        >
          <JobTabContent
            jobId={id}
            activeTab={activeTab}
            category={category}
            detail={detail}
            user={user}
          />
        </Suspense>
      </JobDetailContent>
    </DashboardShell>
  );
}
