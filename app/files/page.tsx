import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FilesHub } from "@/components/files/files-hub";
import { listJobsMissingFolders, listRecentFiles } from "@/app/files/actions";
import { mapJobFileToListRow } from "@/lib/job-file-mapper";
import { syncAllJobFilesFromDisk } from "@/lib/job-files-service";
import { withDatabaseRetry } from "@/lib/prisma";

type FilesPageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const category =
    params.category && params.category !== "All" ? params.category : "";

  await withDatabaseRetry((client) => syncAllJobFilesFromDisk(client));

  const [rawFiles, jobsMissingFolders] = await Promise.all([
    listRecentFiles({
      search: search || undefined,
      folderCategory: category || undefined,
    }),
    listJobsMissingFolders(),
  ]);

  const files = rawFiles.map(mapJobFileToListRow);

  return (
    <DashboardShell
      title="Files"
      subtitle="Job project files indexed from Windows job folders."
    >
      <Link
        href="/jobs"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Browse jobs
      </Link>

      <div className="mt-4">
        <FilesHub
          files={files}
          jobsMissingFolders={jobsMissingFolders}
          initialSearch={search}
          initialCategory={category || "All"}
        />
      </div>
    </DashboardShell>
  );
}
