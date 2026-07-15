import { AppPermission } from "@/app/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureBulkImportForm } from "@/components/structures/structure-bulk-import-form";
import { requirePermission } from "@/lib/auth/session";

import { BackButton } from "@/components/dashboard/back-button";
export default async function StructureImportPage() {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  return (
    <DashboardShell
      title="Bulk Import"
      subtitle="Paste structure templates and pipe opening catalogs from Excel. Existing rows are updated by their natural key; new rows are created."
    >
      <BackButton href="/structures" label="Back to Structures" />

      <div className="mt-4">
        <StructureBulkImportForm />
      </div>
    </DashboardShell>
  );
}
