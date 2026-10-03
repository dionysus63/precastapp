import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { JobStructureDetailContent } from "@/components/jobs/job-structure-detail-content";
import { mapJobStructureToDetailView } from "@/lib/job-structure-detail-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

type JobStructureDetailPageProps = {
  params: Promise<{ id: string; structureId: string }>;
};

export default async function JobStructureDetailPage({
  params,
}: JobStructureDetailPageProps) {
  const { id: jobId, structureId } = await params;

  const structure = await withDatabaseRetry((prisma) =>
    prisma.jobStructure.findFirst({
      where: { id: structureId, jobId },
      include: {
        job: {
          select: {
            jobNumber: true,
            projectName: true,
            folderPath: true,
          },
        },
        quote: { select: { quoteNumber: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
      },
    }),
  );

  if (!structure || !structure.job) {
    notFound();
  }

  const detail = mapJobStructureToDetailView(structure);

  return (
    <DashboardShell
      title={`${detail.structureNumber} — Production`}
      subtitle={`${detail.jobNumber} · ${detail.description}`}
    >
      <JobStructureDetailContent detail={detail} />
    </DashboardShell>
  );
}
