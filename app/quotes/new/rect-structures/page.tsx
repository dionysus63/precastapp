import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RectStructureWorkbookPageClient } from "@/components/quotes/rect-structure-workbook/rect-structure-workbook-page-client";
import { requirePermission } from "@/lib/auth/session";
import { loadRectSheetFormOptions } from "@/lib/drill-sheet-options";

export default async function NewQuoteRectStructuresPage() {
  await requirePermission("QUOTES_MANAGE");

  const { templateOptions, castingOptions, openingSizes } =
    await loadRectSheetFormOptions();

  return (
    <DashboardShell
      title="Rectangular Structure Workbook"
      subtitle="Add rectangular structures (catch basins, boxes, leaching structures) to a new quote"
    >
      <RectStructureWorkbookPageClient
        returnPath="/quotes/new"
        templates={templateOptions}
        castings={castingOptions}
        openingSizes={openingSizes}
      />
    </DashboardShell>
  );
}
