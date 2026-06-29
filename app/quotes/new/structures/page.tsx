import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureWorkbookPageClient } from "@/components/quotes/structure-workbook/structure-workbook-page-client";
import { requirePermission } from "@/lib/auth/session";
import { loadDrillSheetFormOptions } from "@/lib/drill-sheet-options";

export default async function NewQuoteStructuresPage() {
  await requirePermission("QUOTES_MANAGE");

  const {
    templateOptions,
    castingOptions,
    pipeOpeningSizes,
    diameterConfigs,
  } = await loadDrillSheetFormOptions();

  return (
    <DashboardShell
      title="Circular Structure Workbook"
      subtitle="Add configurable circular structures to a new quote"
    >
      <StructureWorkbookPageClient
        returnPath="/quotes/new"
        templates={templateOptions}
        castings={castingOptions}
        pipeOpeningSizes={pipeOpeningSizes}
        diameterConfigs={diameterConfigs}
      />
    </DashboardShell>
  );
}
