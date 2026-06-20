import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { OpenFileButton } from "@/components/files/open-file-button";
import { CreateJobFolderButton } from "@/components/jobs/create-job-folder-button";
import { OpenJobFolderButton } from "@/components/jobs/open-job-folder-button";
import type { JobFileListRow } from "@/lib/job-file-mapper";

type JobFilesPreviewProps = {
  jobId: string;
  folderPath: string | null;
  recentFiles: JobFileListRow[];
};

export function JobFilesPreview({
  jobId,
  folderPath,
  recentFiles,
}: JobFilesPreviewProps) {
  return (
    <SectionCard
      title="Job Files"
      description="Project documents stored in the Windows job folder."
      action={
        folderPath ? (
          <Link
            href={`/files/jobs/${jobId}`}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Manage files
          </Link>
        ) : null
      }
    >
      {!folderPath ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">
            Create a job folder before uploading project files.
          </p>
          <CreateJobFolderButton jobId={jobId} />
        </div>
      ) : (
        <div className="space-y-4">
          <OpenJobFolderButton jobId={jobId} folderPath={folderPath} />
          {recentFiles.length === 0 ? (
            <p className="text-xs text-slate-500">No files indexed yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {recentFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-slate-900">{file.fileName}</p>
                    <p className="text-slate-500">{file.folderCategory}</p>
                  </div>
                  <OpenFileButton fileId={file.id} fileName={file.fileName} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  );
}
