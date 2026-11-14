import { describeBackupHealth, getBackupHealth } from "@/lib/backup-status";

const toneClassNames = {
  red: "border-red-300 bg-red-50 text-red-900",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
} as const;

/**
 * The strip under the page header that tells an admin the server's nightly
 * backup has stopped, failed, or is not leaving the server. Nothing is shown
 * while the backup is healthy. The shell renders this for admins only.
 */
export async function BackupWarning() {
  const now = new Date();
  const notice = describeBackupHealth(await getBackupHealth(now), now);
  if (!notice) {
    return null;
  }

  return (
    <div
      role="alert"
      data-backup-warning={notice.tone}
      className={`border-b px-5 py-2.5 text-sm print:hidden ${toneClassNames[notice.tone]}`}
    >
      <p className="font-semibold">{notice.headline}</p>
      <p className="mt-0.5">{notice.detail}</p>
    </div>
  );
}
