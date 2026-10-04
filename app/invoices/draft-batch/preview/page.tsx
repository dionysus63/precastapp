import { DraftBatchPreviewContent } from "@/components/invoices/draft-batch-preview-content";
import { requireAuthForPath } from "@/lib/auth/session";

export default async function DraftBatchPreviewPage() {
  // Outside DashboardShell, so the route's permission is checked here.
  await requireAuthForPath("/invoices/draft-batch/preview");
  return <DraftBatchPreviewContent />;
}
