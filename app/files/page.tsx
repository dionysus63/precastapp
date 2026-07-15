import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FilesHub } from "@/components/files/files-hub";
import { listJobsMissingFolders, listRecentFiles } from "@/app/files/actions";
import { mapJobFileToListRow } from "@/lib/job-file-mapper";

import { BackButton } from "@/components/dashboard/back-button";
type FilesPageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const category =
    params.category && params.category !== "All" ? params.category : "";

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
      <BackButton href="/jobs" label="Browse jobs" />

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
